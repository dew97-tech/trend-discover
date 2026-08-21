<?php

namespace App\Services\AI;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * OpenAI-compatible chat-completions client for the OpenCode Go gateway.
 * Model is hard-restricted to the configured allowlist (product decision).
 */
final class OpenCodeGoProvider implements AIProvider
{
    public function complete(string $systemPrompt, string $userPrompt): AiResponse
    {
        $config = config('ai.providers.opencode_go');
        $model = (string) $config['model'];

        if (! in_array($model, $config['allowed_models'], true)) {
            throw new \RuntimeException(
                "Model [$model] is not in the approved allowlist. Allowed: ".
                implode(', ', $config['allowed_models']),
            );
        }

        $started = now()->getTimestampMs();

        // Reasoning models can return EMPTY visible content when the token
        // budget is consumed by invisible chain-of-thought (finish_reason
        // = length). One silent re-attempt smooths over that transient.
        $response = null;
        $rawContent = '';

        for ($attempt = 0; $attempt < 2; $attempt++) {
            $response = Http::baseUrl($this->apiRoot((string) $config['base_url']))
                ->timeout((int) $config['timeout'])
                ->withToken((string) $config['api_key'])
                ->retry(
                    (int) $config['max_retries'],
                    1000,
                    throw: false,
                    // 4xx (except 429) are deterministic — retrying wastes quota.
                    when: fn ($exception, $request) => $exception !== null
                        || in_array($request?->status() ?? 0, [429, 500, 502, 503, 504], true),
                )
                ->post('/chat/completions', [
                    'model' => $model,
                    'messages' => [
                        ['role' => 'system', 'content' => $systemPrompt],
                        ['role' => 'user', 'content' => $userPrompt],
                    ],
                    'temperature' => 0.7,
                    'response_format' => ['type' => 'json_object'],
                    'max_tokens' => (int) config('ai.max_tokens_per_call', 4096),
                ]);

            if ($response->failed()) {
                break;
            }

            $rawContent = (string) ($response->json('choices.0.message.content') ?? '');

            if (trim($rawContent) !== '') {
                break;
            }

            Log::warning('OpenCode Go empty content — re-attempting', [
                'attempt' => $attempt + 1,
                'finish_reason' => $response->json('choices.0.finish_reason'),
            ]);
        }

        $durationMs = max(0, now()->getTimestampMs() - $started);

        if ($response->failed()) {
            Log::warning('OpenCode Go request failed', ['status' => $response->status()]);

            throw new ConnectionException(
                "OpenCode Go request failed: {$response->status()} ".str($response->body())->limit(160),
            );
        }

        $payload = $response->json();

        $content = $this->decodeJson($rawContent);

        return new AiResponse(
            data: $content,
            durationMs: $durationMs,
            tokensIn: $payload['usage']['prompt_tokens'] ?? null,
            tokensOut: $payload['usage']['completion_tokens'] ?? null,
            model: $model,
        );
    }

    /**
     * Models often wrap JSON in markdown fences or prepend prose.
     * Decode defensively: direct → fenced → brace-extracted.
     */
    private function decodeJson(string $raw): array
    {
        $direct = json_decode($raw, true);

        if (is_array($direct)) {
            return $direct;
        }

        if (preg_match('/```(?:json)?\s*(.+?)\s*```/s', $raw, $fence)) {
            $fenced = json_decode($fence[1], true);

            if (is_array($fenced)) {
                return $fenced;
            }
        }

        $start = strpos($raw, '{');
        $end = strrpos($raw, '}');

        if ($start !== false && $end !== false && $end > $start) {
            $extracted = json_decode(substr($raw, $start, $end - $start + 1), true);

            if (is_array($extracted)) {
                return $extracted;
            }
        }

        Log::warning('OpenCode Go non-JSON content', ['preview' => str($raw)->limit(300)]);

        throw new \RuntimeException(
            'OpenCode Go returned non-JSON content: '.str($raw)->limit(180),
        );
    }

    /**
     * Users may paste either the API root or the full endpoint.
     * Accept both — strip a trailing /chat/completions plus slashes.
     */
    private function apiRoot(string $baseUrl): string
    {
        $url = rtrim(trim($baseUrl), '/');

        if (str_ends_with($url, '/chat/completions')) {
            $url = substr($url, 0, -strlen('/chat/completions'));
        }

        return rtrim($url, '/');
    }
}
