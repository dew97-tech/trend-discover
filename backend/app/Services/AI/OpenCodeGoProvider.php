<?php

namespace App\Services\AI;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * OpenAI-compatible chat-completions client for the OpenCode Go gateway.
 *
 * Two layers of resilience:
 *   1. WITHIN a model: hybrid-thinking models can burn the token budget on
 *      invisible reasoning (finish_reason=length, empty content) — escalate
 *      reasoning effort / double the budget once.
 *   2. ACROSS models: gateway 5xx or unsupported-model errors switch to the
 *      next cheapest model in the configured fallback chain (product rule:
 *      "if alpha errors, move on to the next cheapest").
 */
final class OpenCodeGoProvider implements AIProvider
{
    public function complete(string $systemPrompt, string $userPrompt): AiResponse
    {
        $config = config('ai.providers.opencode_go');
        $profiles = $config['allowed_models'];

        $catalog = app(ModelCatalogService::class);
        $autoModels = $catalog->autoDiscoverEnabled()
            ? array_values(array_filter(array_column($catalog->autoModels(), 'id')))
            : [];

        $isUsable = fn (string $id): bool => isset($profiles[$id])
            || in_array($id, $autoModels, true);

        // Settings UI override wins over .env so models are swappable at runtime.
        $active = (string) (
            \App\Models\SystemSetting::get('ai.model')
            ?? $config['model']
        );

        // A stored model can outlive its gateway (dead/renamed id). Self-heal:
        // log, then prefer the config default, then the best discovered model.
        if (! $isUsable($active)) {
            Log::channel('pipeline')->warning('[OpenCodeGoProvider] active model no longer usable — self-healing', [
                'stored' => $active,
                'default' => $config['model'],
                'auto' => $autoModels,
            ]);

            $active = $isUsable((string) $config['model'])
                ? (string) $config['model']
                : (string) ($autoModels[0] ?? '');
        }

        if ($active === '') {
            throw new \RuntimeException(
                'No usable model: the allowlist ids are gone from the gateway and no auto-discovered '.
                'fallbacks are stored. Run `php artisan ai:refresh-models`.',
            );
        }

        // Candidate chain: active -> configured fallbacks -> auto-discovered.
        $chain = [$active];

        foreach (($config['fallback_order'] ?? []) as $candidate) {
            if ($candidate !== $active && isset($profiles[$candidate])) {
                $chain[] = $candidate;
            }
        }

        foreach ($autoModels as $candidate) {
            if ($candidate !== $active && ! in_array($candidate, $chain, true)) {
                $chain[] = $candidate;
            }
        }

        $started = now()->getTimestampMs();
        $tried = [];
        $lastError = null;

        foreach ($chain as $model) {
            try {
                [$response, $rawContent] = $this->completeOnModel(
                    $model,
                    $profiles[$model] ?? [
                        'reasoning' => false,
                        'max_output' => (int) config('ai.max_tokens_per_call', 4096),
                    ],
                    $systemPrompt,
                    $userPrompt,
                );
            } catch (ConnectionException $e) {
                Log::channel('pipeline')->warning("[OpenCodeGoProvider] {$model} failed — trying next in chain", [
                    'error' => str($e->getMessage())->limit(160),
                ]);

                $tried[] = $model.': '.str($e->getMessage())->limit(80);
                $lastError = $e;

                continue;
            }

            if ($response->failed()) {
                Log::channel('pipeline')->warning("[OpenCodeGoProvider] {$model} failed — trying next in chain", [
                    'status' => $response->status(),
                ]);

                $tried[] = "{$model}: HTTP {$response->status()}";
                $lastError = new ConnectionException(
                    "OpenCode Go request failed on {$model}: {$response->status()} ".
                    str($response->body())->limit(120),
                );

                continue;
            }

            if (trim($rawContent) === '') {
                Log::channel('pipeline')->warning("[OpenCodeGoProvider] {$model} returned empty content after escalation", []);

                $tried[] = "{$model}: empty content (reasoning exhausted budget)";
                $lastError = new ConnectionException(
                    "Model [{$model}] spent its entire token budget on reasoning without output.",
                );

                continue;
            }

            if ($tried !== []) {
                Log::channel('pipeline')->info('[OpenCodeGoProvider] succeeded via fallback', [
                    'model' => $model,
                    'earlier_failures' => $tried,
                ]);
            }

            $payload = $response->json();

            return new AiResponse(
                data: $this->decodeJson($rawContent),
                durationMs: max(0, now()->getTimestampMs() - $started),
                tokensIn: $payload['usage']['prompt_tokens'] ?? null,
                tokensOut: $payload['usage']['completion_tokens'] ?? null,
                model: $model,
            );
        }

        // Self-healing: the whole chain died, so refresh the discovered
        // fallbacks in the background for the next call (unique per hour).
        if ($catalog->autoDiscoverEnabled()) {
            \App\Jobs\RefreshAiModelsJob::dispatch();
        }

        throw new \RuntimeException(
            'All models failed. Attempts: '.implode(' | ', $tried).
            '. Last error: '.($lastError?->getMessage() ?? 'unknown').
            '. A model-catalog refresh was queued — verify with `php artisan ai:refresh-models`.',
        );
    }

    /**
     * Single-model attempt with reasoning-aware escalation:
     * hybrid-thinking models that exhaust max_tokens on invisible reasoning
     * get ONE retry with the output budget doubled.
     *
     * @return array{0: \Illuminate\Http\Client\Response, 1: string}
     */
    private function completeOnModel(
        string $model,
        array $profile,
        string $systemPrompt,
        string $userPrompt,
    ): array {
        $reasoning = (bool) ($profile['reasoning'] ?? false);
        $maxTokens = (int) ($profile['max_output'] ?? config('ai.max_tokens_per_call', 4096));

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
            // OpenAI-standard control recognized by Hy3/MiMo serving stacks.
            $body['reasoning_effort'] = (string) ($profile['effort'] ?? 'low');
        }

        $response = $this->request($body);

        $rawContent = (string) ($response->json('choices.0.message.content') ?? '');

        // Escalation: budget doubled once when reasoning ate everything.
        if (! $response->failed() && trim($rawContent) === '' && $response->json('choices.0.finish_reason') === 'length') {
            Log::channel('pipeline')->warning("[OpenCodeGoProvider] {$model} empty content — doubling budget", [
                'from_tokens' => $maxTokens,
                'to_tokens' => $maxTokens * 2,
            ]);

            $body['max_tokens'] = $maxTokens * 2;

            $response = $this->request($body);

            $rawContent = (string) ($response->json('choices.0.message.content') ?? '');
        }

        return [$response, $rawContent];
    }

    /**
     * One authenticated call to /chat/completions. The Go gateway requires
     * x-opencode-session on every request — without it all models fail.
     */
    private function request(array $body): \Illuminate\Http\Client\Response
    {
        return Http::baseUrl($this->apiRoot())
            ->timeout((int) config('ai.providers.opencode_go.timeout'))
            ->withToken((string) config('ai.providers.opencode_go.api_key'))
            ->withHeaders(['x-opencode-session' => ModelCatalogService::sessionId()])
            ->retry(
                (int) config('ai.providers.opencode_go.max_retries'),
                1000,
                throw: false,
                when: fn ($exception, $request) => $exception !== null
                    || in_array($request?->status() ?? 0, [429, 500, 502, 503, 504], true),
            )
            ->post('/chat/completions', $body);
    }

    /**
     * Users may paste either the API root or the full endpoint.
     */
    private function apiRoot(): string
    {
        return ModelCatalogService::apiRoot();
    }

    /**
     * Models often wrap JSON in markdown fences or prepend prose.
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
