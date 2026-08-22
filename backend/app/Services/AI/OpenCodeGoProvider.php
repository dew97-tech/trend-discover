<?php

namespace App\Services\AI;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * OpenAI-compatible chat-completions client for the OpenCode Go gateway.
 *
 * Model is hard-restricted to the configured allowlist (product decision),
 * and each model carries a capability profile:
 *   - reasoning models stream chain-of-thought into reasoning_content;
 *     if max_tokens is exhausted by thinking, `content` comes back EMPTY
 *     with finish_reason=length. We counter that with an escalation
 *     ladder: lower reasoning effort, then double the budget.
 */
final class OpenCodeGoProvider implements AIProvider
{
    public function complete(string $systemPrompt, string $userPrompt): AiResponse
    {
        $config = config('ai.providers.opencode_go');

        // Settings UI override wins over .env so models are swappable at runtime.
        $model = (string) (
            \App\Models\SystemSetting::get('ai.model')
            ?? $config['model']
        );

        $profile = $config['allowed_models'][$model]
            ?? throw new \RuntimeException(
                "Model [$model] is not in the approved allowlist. Allowed: ".
                implode(', ', array_keys($config['allowed_models'])),
            );

        $started = now()->getTimestampMs();

        [$response, $rawContent] = $this->completeWithEscalation($model, $profile, $systemPrompt, $userPrompt);

        $durationMs = max(0, now()->getTimestampMs() - $started);

        if ($response->failed()) {
            Log::warning('OpenCode Go request failed', ['status' => $response->status(), 'model' => $model]);

            throw new ConnectionException(
                "OpenCode Go request failed: {$response->status()} ".str($response->body())->limit(160),
            );
        }

        if (trim($rawContent) === '') {
            // Escalation exhausted and still nothing visible.
            throw new \RuntimeException(
                "Model [{$model}] spent its entire token budget on reasoning without ".
                'producing output (finish_reason=length). Escalated retries exhausted — '.
                'consider switching to a non-reasoning model for this task.',
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
     * Documented pattern for hybrid-thinking models (Tencent Hunyuan 3 et al):
     * when finish_reason=length && content empty, lower reasoning_effort one
     * step and/or double the output budget rather than retrying identically.
     *
     * @return array{0: \Illuminate\Http\Client\Response, 1: string}
     */
    private function completeWithEscalation(
        string $model,
        array $profile,
        string $systemPrompt,
        string $userPrompt,
    ): array {
        $reasoning = (bool) ($profile['reasoning'] ?? false);
        $efforts = ['none', 'low', 'medium', 'high'];
        $effort = (string) ($profile['effort'] ?? ($reasoning ? 'low' : 'none'));
        $maxTokens = (int) ($profile['max_output'] ?? config('ai.max_tokens_per_call', 4096));

        $response = null;
        $rawContent = '';
        $finishReason = null;

        for ($attempt = 1; $attempt <= 3; $attempt++) {
            $body = [
                'model' => $model,
                'messages' => [
                    ['role' => 'system', 'content' => $systemPrompt],
                    ['role' => 'user', 'content' => $userPrompt],
                ],
                'temperature' => 0.7,
                'response_format' => ['type' => 'json_object'],
                'max_tokens' => $maxTokens,
            ];

            if ($reasoning) {
                // OpenAI-standard control recognized by Hy3 serving stacks.
                $body['reasoning_effort'] = $effort;
            }

            $response = Http::baseUrl($this->apiRoot())
                ->timeout((int) config('ai.providers.opencode_go.timeout'))
                ->withToken((string) config('ai.providers.opencode_go.api_key'))
                ->retry(
                    (int) config('ai.providers.opencode_go.max_retries'),
                    1000,
                    throw: false,
                    when: fn ($exception, $request) => $exception !== null
                        || in_array($request?->status() ?? 0, [429, 500, 502, 503, 504], true),
                )
                ->post('/chat/completions', $body);

            if ($response->failed()) {
                break; // HTTP failure — handled upstream, no escalation helps.
            }

            $rawContent = (string) ($response->json('choices.0.message.content') ?? '');
            $finishReason = (string) ($response->json('choices.0.finish_reason') ?? '');

            if (trim($rawContent) !== '') {
                break;
            }

            Log::warning('OpenCode Go empty content — escalating', [
                'model' => $model,
                'attempt' => $attempt,
                'finish_reason' => $finishReason,
                'next_max_tokens' => $maxTokens * 2,
            ]);

            // Ladder step: reduce thinking depth, then grow the budget.
            if ($reasoning && in_array($effort, ['high', 'medium'])) {
                $effort = $effort === 'high' ? 'low' : 'none';
            } else {
                $maxTokens *= 2;
            }
        }

        return [$response, $rawContent];
    }

    /**
     * Users may paste either the API root or the full endpoint.
     * Accept both — strip a trailing /chat/completions plus slashes.
     */
    private function apiRoot(): string
    {
        $url = rtrim(trim((string) config('ai.providers.opencode_go.base_url')), '/');

        if (str_ends_with($url, '/chat/completions')) {
            $url = substr($url, 0, -strlen('/chat/completions'));
        }

        return rtrim($url, '/');
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
}
