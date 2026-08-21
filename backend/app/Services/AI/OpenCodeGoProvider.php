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

        $response = Http::baseUrl((string) $config['base_url'])
            ->timeout((int) $config['timeout'])
            ->withToken((string) $config['api_key'])
            ->retry((int) $config['max_retries'], 1000, throw: false)
            ->post('/chat/completions', [
                'model' => $model,
                'messages' => [
                    ['role' => 'system', 'content' => $systemPrompt],
                    ['role' => 'user', 'content' => $userPrompt],
                ],
                'temperature' => 0.7,
                'response_format' => ['type' => 'json_object'],
                'max_tokens' => (int) config('ai.max_tokens_per_call', 2000),
            ]);

        $durationMs = max(0, now()->getTimestampMs() - $started);

        if ($response->failed()) {
            Log::warning('OpenCode Go request failed', ['status' => $response->status()]);

            throw new ConnectionException(
                "OpenCode Go request failed: {$response->status()} ".str($response->body())->limit(160),
            );
        }

        $payload = $response->json();

        $content = json_decode(
            (string) ($payload['choices'][0]['message']['content'] ?? '{}'),
            true,
        );

        if (! is_array($content)) {
            throw new \RuntimeException('OpenCode Go returned non-JSON content.');
        }

        return new AiResponse(
            data: $content,
            durationMs: $durationMs,
            tokensIn: $payload['usage']['prompt_tokens'] ?? null,
            tokensOut: $payload['usage']['completion_tokens'] ?? null,
            model: $model,
        );
    }
}
