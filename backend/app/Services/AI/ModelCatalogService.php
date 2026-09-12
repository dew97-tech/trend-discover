<?php

namespace App\Services\AI;

use App\Models\SystemSetting;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Discovers the best working gateway models automatically so the app never
 * dies with the allowlist (OpenCode rotates its roster without notice).
 *
 * Reality checks baked in:
 *  - general-tier free models (*-free, big-pickle) are API-blocked — only the
 *    Go endpoint is used, which is covered by the Go subscription (cost 0).
 *  - the roster listing contains non-working ids (wrong API format / upstream
 *    errors), so candidates are PROBED, never trusted blindly.
 *  - all roster `created` timestamps are identical, so ranking is heuristic
 *    (family + version + lightweight variant) and latency decides the winners.
 */
class ModelCatalogService
{
    public const SETTING_AUTO_MODELS = 'ai.auto_models';

    public const SETTING_AUTO_DISCOVER = 'ai.auto_discover';

    public const SETTING_HEALTH = 'ai.model_health';

    public const SETTING_REFRESHED_AT = 'ai.models_refreshed_at';

    /**
     * Live gateway roster ids (10-minute cache).
     *
     * @return list<string>
     */
    public function roster(): array
    {
        return Cache::remember('ai.gateway_roster', now()->addMinutes(10), function (): array {
            try {
                $response = Http::baseUrl(self::apiRoot())
                    ->timeout(15)
                    ->withToken((string) config('ai.providers.opencode_go.api_key'))
                    ->get('/models');

                if ($response->failed()) {
                    Log::channel('pipeline')->warning('[ModelCatalog] roster fetch failed', [
                        'status' => $response->status(),
                    ]);

                    return [];
                }

                return collect($response->json('data', []))
                    ->pluck('id')
                    ->filter()
                    ->unique()
                    ->values()
                    ->all();
            } catch (\Throwable $e) {
                Log::channel('pipeline')->warning('[ModelCatalog] roster fetch error', [
                    'error' => (string) str($e->getMessage())->limit(160),
                ]);

                return [];
            }
        });
    }

    public function autoDiscoverEnabled(): bool
    {
        return (bool) SystemSetting::get(
            self::SETTING_AUTO_DISCOVER,
            config('ai.auto_discover.enabled', true),
        );
    }

    /**
     * @return list<array{id: string, label: string, score: float, latency_ms: int, checked_at: string}>
     */
    public function autoModels(): array
    {
        $stored = SystemSetting::get(self::SETTING_AUTO_MODELS, []);

        if (! is_array($stored)) {
            return [];
        }

        return array_values(array_filter(
            $stored,
            fn ($model) => is_array($model) && ! empty($model['id']),
        ));
    }

    /**
     * Heuristic ranking: cheap/fast-first per product decision.
     *
     * @param  list<string>  $ids
     * @return array<string, float> id => score, highest first
     */
    public function rank(array $ids): array
    {
        $weights = config('ai.auto_discover.family_weights', []);
        $variants = config('ai.auto_discover.variant_bonus', []);
        $excluded = config('ai.auto_discover.exclude_patterns', []);

        $scored = [];

        foreach ($ids as $id) {
            if (! is_string($id) || $id === '') {
                continue;
            }

            $lower = mb_strtolower($id);

            foreach ($excluded as $pattern) {
                if ($pattern !== '' && str_contains($lower, (string) $pattern)) {
                    continue 2;
                }
            }

            $score = (float) ($weights[self::familyOf($lower)] ?? 15.0);

            // Version bonus: largest numeric version in the id, capped.
            if (preg_match_all('/\d+(?:\.\d+)?/', $lower, $matches) > 0) {
                $versions = array_map('floatval', $matches[0]);
                $score += min(8.0, max($versions) * 1.5);
            }

            // Variant bonus: best matching lightweight/heavy keyword.
            $bonus = 0;

            foreach ($variants as $keyword => $value) {
                if (str_contains($lower, (string) $keyword)) {
                    $bonus = max($bonus, (int) $value);
                }
            }

            $scored[$id] = $score + $bonus;
        }

        arsort($scored);

        return $scored;
    }

    /**
     * Tiny structured probe used by both discovery and `ai:check-models`.
     *
     * @param  array<string, mixed>|null  $profile
     * @return array{ok: bool, latency_ms: int, error: ?string}
     */
    public function probe(string $model, ?array $profile = null): array
    {
        // glm rejects max_tokens <= 1024 while thinking; 1200+ is safe and cheap.
        $maxTokens = (int) ($profile['max_output'] ?? 1200);
        $maxTokens = max(1200, min(2048, $maxTokens));

        $body = [
            'model' => $model,
            'messages' => [['role' => 'user', 'content' => 'Return JSON {"ok":true}']],
            'max_tokens' => $maxTokens,
            'response_format' => ['type' => 'json_object'],
        ];

        if ($profile !== null && ($profile['reasoning'] ?? false)) {
            $body['reasoning_effort'] = (string) ($profile['effort'] ?? 'low');
        }

        $started = now()->getTimestampMs();

        try {
            $response = Http::baseUrl(self::apiRoot())
                ->timeout(60)
                ->withToken((string) config('ai.providers.opencode_go.api_key'))
                ->withHeaders(['x-opencode-session' => self::sessionId()])
                ->post('/chat/completions', $body);
        } catch (\Throwable $e) {
            return [
                'ok' => false,
                'latency_ms' => max(0, now()->getTimestampMs() - $started),
                'error' => (string) str($e->getMessage())->limit(160),
            ];
        }

        $latency = max(0, now()->getTimestampMs() - $started);

        if ($response->failed()) {
            return [
                'ok' => false,
                'latency_ms' => $latency,
                'error' => "HTTP {$response->status()} ".str($response->body())->limit(90),
            ];
        }

        $content = trim((string) ($response->json('choices.0.message.content') ?? ''));

        if ($content === '') {
            return [
                'ok' => false,
                'latency_ms' => $latency,
                'error' => 'empty content (reasoning exhausted budget)',
            ];
        }

        return ['ok' => true, 'latency_ms' => $latency, 'error' => null];
    }

    /**
     * Rank -> probe -> keep the fastest working models, excluding the
     * configured allowlist; persists the result for the provider fallback.
     *
     * @return list<array{id: string, label: string, score: float, latency_ms: int, checked_at: string}>
     */
    public function refreshBest(): array
    {
        $roster = $this->roster();

        if ($roster === []) {
            Log::channel('pipeline')->warning('[ModelCatalog] refresh skipped — empty roster');

            return $this->autoModels();
        }

        $allowlist = array_keys(config('ai.providers.opencode_go.allowed_models', []));
        $candidates = array_values(array_diff($roster, $allowlist));

        $ranked = $this->rank($candidates);
        $top = array_slice(
            $ranked,
            0,
            max(1, (int) config('ai.auto_discover.probe_candidates', 10)),
            true,
        );

        $working = [];
        $health = [];

        foreach ($top as $id => $score) {
            $result = $this->probe($id);

            $health[$id] = [
                'ok' => $result['ok'],
                'latency_ms' => $result['latency_ms'],
                'error' => $result['error'],
                'checked_at' => now()->toIso8601String(),
            ];

            Log::channel('pipeline')->info('[ModelCatalog] probe', [
                'model' => $id,
                'score' => $score,
                'ok' => $result['ok'],
                'latency_ms' => $result['latency_ms'],
                'error' => $result['error'],
            ]);

            if ($result['ok']) {
                $working[] = [
                    'id' => $id,
                    'label' => $this->label($id),
                    'score' => $score,
                    'latency_ms' => $result['latency_ms'],
                    'checked_at' => now()->toIso8601String(),
                ];
            }
        }

        // Cheap/fast decision: shortest latency first, quality as tiebreaker.
        usort($working, fn (array $a, array $b) => [$a['latency_ms'], -$a['score']] <=> [$b['latency_ms'], -$b['score']]);

        $chosen = array_slice($working, 0, max(1, (int) config('ai.auto_discover.keep', 3)));

        SystemSetting::put(self::SETTING_AUTO_MODELS, $chosen, group: 'ai');
        SystemSetting::put(self::SETTING_HEALTH, $health, group: 'ai');
        SystemSetting::put(self::SETTING_REFRESHED_AT, now()->toIso8601String(), group: 'ai');

        Log::channel('pipeline')->info('[ModelCatalog] refreshed', [
            'roster' => count($roster),
            'probed' => count($top),
            'chosen' => array_column($chosen, 'id'),
        ]);

        return $chosen;
    }

    public function health(): array
    {
        $stored = SystemSetting::get(self::SETTING_HEALTH, []);

        return is_array($stored) ? $stored : [];
    }

    public function refreshedAt(): ?string
    {
        $value = SystemSetting::get(self::SETTING_REFRESHED_AT);

        return is_string($value) ? $value : null;
    }

    public function label(string $id): string
    {
        return (string) Str::of($id)->replace(['-', '.', '_'], ' ')->title();
    }

    private static function familyOf(string $id): string
    {
        $first = preg_split('/[-.]/', $id)[0] ?? $id;

        // "qwen3" -> "qwen", "hy4" -> "hy"
        return (string) preg_replace('/[0-9]+/', '', $first);
    }

    /**
     * Users may paste either the API root or the full endpoint.
     */
    public static function apiRoot(): string
    {
        $url = rtrim(trim((string) config('ai.providers.opencode_go.base_url')), '/');

        if (str_ends_with($url, '/chat/completions')) {
            $url = substr($url, 0, -strlen('/chat/completions'));
        }

        return rtrim($url, '/');
    }

    /**
     * Stable routing session for the gateway (prompt-cache affinity).
     * Priority: env override -> persisted UUID -> generate + persist once.
     */
    public static function sessionId(): string
    {
        $configured = trim((string) config('ai.providers.opencode_go.session_id'));

        if ($configured !== '') {
            return $configured;
        }

        $stored = SystemSetting::get('ai.session_id');

        if (is_string($stored) && trim($stored) !== '') {
            return $stored;
        }

        $generated = (string) Str::uuid();

        SystemSetting::put('ai.session_id', $generated, group: 'ai');

        Log::channel('pipeline')->info('[ModelCatalog] generated gateway session id', [
            'session_id' => $generated,
        ]);

        return $generated;
    }
}
