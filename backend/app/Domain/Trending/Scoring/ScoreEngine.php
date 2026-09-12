<?php

namespace App\Domain\Trending\Scoring;

use App\Models\SystemSetting;
use App\Models\Trend;
use Illuminate\Support\Collection;

/**
 * Composite trend score = Σ(weight × dimension) − penalty × saturation.
 * Weights are hot-loaded from system_settings — editable without redeploy.
 */
class ScoreEngine
{
    public function __construct(
        private readonly SaturationAnalyzer $saturation = new SaturationAnalyzer(),
    ) {}

    /**
     * @return array<string, float> all persisted dimension scores incl. composite
     */
    public function score(Trend $trend): array
    {
        $weights = $this->weights();

        // Aggregate comment totals once for the discussion scorer.
        if (! isset($trend->metrics['total_comments'])) {
            $trend->metrics = [
                ...($trend->metrics ?? []),
                'total_comments' => (int) $trend->signals()
                    ->get(['value'])
                    ->sum(fn ($signal) => (int) ($signal->value['metrics']['comments'] ?? 0)),
            ];
        }

        $saturation = $this->saturation->analyze($trend);

        $novelty = round(max(0.0, min(100.0,
            100.0 - 0.7 * $saturation + 0.3 * DimensionScorers::freshness($trend),
        )), 2);

        $dimensions = [
            'freshness_score' => DimensionScorers::freshness($trend),
            'momentum_score' => DimensionScorers::momentum($trend),
            'relevance_score' => DimensionScorers::relevance($trend),
            'usefulness_score' => DimensionScorers::usefulness($trend),
            'novelty_score' => $novelty,
            'focus_score' => DimensionScorers::focus($trend),
            'saturation_score' => $saturation,
        ];

        // Weighted sum normalized by the weights actually present, so legacy
        // stored weight sets (sum ≈ 1) and future keys (topic_focus) both
        // produce a 0–100 composite without rebalancing the settings JSON.
        $weighted = [
            'freshness' => $dimensions['freshness_score'],
            'momentum' => $dimensions['momentum_score'],
            'technical_relevance' => $dimensions['relevance_score'],
            'practical_usefulness' => $dimensions['usefulness_score'],
            'novelty' => $dimensions['novelty_score'],
            'topic_focus' => $dimensions['focus_score'],
            'developer_interest' => DimensionScorers::interest($trend),
            'discussion_potential' => DimensionScorers::discussion($trend),
            'source_reliability' => DimensionScorers::sourceReliability($trend),
        ];

        $composite = 0.0;
        $weightTotal = 0.0;

        foreach ($weighted as $key => $value) {
            $weight = (float) ($weights[$key] ?? 0);
            $composite += $weight * $value;
            $weightTotal += $weight;
        }

        $composite = $weightTotal > 0.0 ? $composite / $weightTotal : 0.0;

        $dimensions['trend_score'] = round(
            max(0.0, min(100.0, $composite - $weights['saturation_penalty_weight'] * $saturation)),
            2,
        );

        // Hack-style badge is derived metadata, not a score input.
        $trend->metrics = [
            ...($trend->metrics ?? []),
            'hack_style' => DimensionScorers::hackHits($trend) >=
                (int) config('trending.hack_style_min_hits', 2),
        ];

        $trend->forceFill($dimensions)->save();

        $trend->signals()->create([
            'type' => 'score_breakdown',
            'weight' => 0,
            'value' => [
                'dimensions' => $dimensions,
                'weights' => $weights,
                'scored_at' => now()->toIso8601String(),
            ],
            'detected_at' => now(),
        ]);

        return $dimensions;
    }

    /** @return array<string, float> */
    private function weights(): array
    {
        $defaults = [
            'freshness' => 0.16,
            'momentum' => 0.13,
            'technical_relevance' => 0.16,
            'practical_usefulness' => 0.14,
            'novelty' => 0.18,
            'developer_interest' => 0.05,
            'discussion_potential' => 0.05,
            'source_reliability' => 0.05,
            'topic_focus' => 0.08,
            'saturation_penalty_weight' => 0.25,
        ];

        return array_merge(
            $defaults,
            SystemSetting::get('scoring.weights.default', []) ?? [],
        );
    }
}
