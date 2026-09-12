<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Source;
use App\Models\SystemSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class SettingController extends Controller
{
    private const WEIGHT_KEYS = [
        'freshness', 'momentum', 'technical_relevance', 'practical_usefulness',
        'novelty', 'developer_interest', 'discussion_potential', 'source_reliability',
        'topic_focus',
    ];

    public function __construct(private readonly \App\Services\AI\PromptRegistry $prompts) {}

    public function index(): JsonResponse
    {
        return response()->json([
            // Merged through WEIGHT_KEYS so non-dimension keys stored in the
            // JSON (e.g. legacy min_ranking_score) never reach the UI sliders.
            'weights' => $this->mergeWeights(SystemSetting::get('scoring.weights.default', []) ?? []),
            'limits' => SystemSetting::get('generation.limits', []),
            'model' => SystemSetting::get('ai.model', config('ai.providers.opencode_go.model')),
            'allowed_models' => config('ai.providers.opencode_go.allowed_models'),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'weights' => ['sometimes', 'array'],
            'weights.*' => ['numeric', 'between:0,1'],
            'limits.max_generations_per_trend' => ['sometimes', 'integer', 'between:1,10'],
            'limits.max_image_prompts_per_post' => ['sometimes', 'integer', 'between:0,5'],
            'limits.daily_ai_call_budget' => ['sometimes', 'integer', 'between:1,5000'],
            'model' => ['sometimes', 'string', \Illuminate\Validation\Rule::in(
                array_keys(config('ai.providers.opencode_go.allowed_models', [])),
            )],
        ]);

        if (isset($validated['weights'])) {
            $weights = $this->mergeWeights($validated['weights']);

            $positiveSum = collect($weights)
                ->except('saturation_penalty_weight')
                ->sum();

            if (abs($positiveSum - 1.0) > 0.05) {
                return response()->json([
                    'message' => 'Dimension weights must sum to ~1.00 (got '.round($positiveSum, 3).').',
                    'errors' => ['weights' => ["Sum is {$positiveSum}, expected ≈ 1.00."]],
                ], 422);
            }

            SystemSetting::put('scoring.weights.default', $weights, group: 'scoring');
        }

        if (isset($validated['limits'])) {
            $current = SystemSetting::get('generation.limits', []) ?? [];

            SystemSetting::put(
                'generation.limits',
                array_merge($current, $validated['limits']),
                group: 'cost_control',
            );
        }

        if (isset($validated['model'])) {
            SystemSetting::put('ai.model', $validated['model'], group: 'ai');
        }

        \Illuminate\Support\Facades\Cache::forget('taxonomy:categories-technologies');

        return $this->index();
    }

    /**
     * Model catalogue with capability profiles, intersected with the gateway's
     * live /models listing. Falls back gracefully when unreachable.
     */
    public function models(): JsonResponse
    {
        $profiles = config('ai.providers.opencode_go.allowed_models', []);

        try {
            $response = Http::baseUrl($this->apiRoot())
                ->timeout(10)
                ->withToken((string) config('ai.providers.opencode_go.api_key'))
                ->get('/models');

            $gatewayIds = collect($response->json('data', []))
                ->pluck('id')
                ->filter()
                ->all();
        } catch (\Throwable) {
            $gatewayIds = [];
        }

        return response()->json([
            'models' => collect($profiles)->map(fn (array $profile, string $id) => [
                'id' => $id,
                'label' => $profile['label'] ?? $id,
                'reasoning' => (bool) ($profile['reasoning'] ?? false),
                'on_gateway' => in_array($id, $gatewayIds, true),
            ])->values()->all(),
            'active' => SystemSetting::get('ai.model', config('ai.providers.opencode_go.model')),
            'gateway_reachable' => $gatewayIds !== [],
        ]);
    }

    private function mergeWeights(array $incoming): array
    {
        $current = SystemSetting::get('scoring.weights.default', []) ?? [];
        $merged = [];

        foreach (self::WEIGHT_KEYS as $key) {
            $merged[$key] = (float) ($incoming[$key] ?? $current[$key] ?? 0);
        }

        $merged['saturation_penalty_weight'] = (float) (
            $incoming['saturation_penalty_weight']
            ?? $current['saturation_penalty_weight']
            ?? 0.25
        );

        return $merged;
    }

    private function apiRoot(): string
    {
        $url = rtrim(trim((string) config('ai.providers.opencode_go.base_url')), '/');

        if (str_ends_with($url, '/chat/completions')) {
            $url = substr($url, 0, -strlen('/chat/completions'));
        }

        return rtrim($url, '/');
    }
}
