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
            'saturation_score' => $saturation,
        ];

        $composite =
            $weights['freshness'] * $dimensions['freshness_score']
            + $weights['momentum'] * $dimensions['momentum_score']
            + $weights['technical_relevance'] * $dimensions['relevance_score']
            + $weights['practical_usefulness'] * $dimensions['usefulness_score']
            + $weights['novelty'] * $dimensions['novelty_score']
            + $weights['developer_interest'] * DimensionScorers::interest($trend)
            + $weights['discussion_potential'] * DimensionScorers::discussion($trend)
            + $weights['source_reliability'] * DimensionScorers::sourceReliability($trend);

        $dimensions['trend_score'] = round(
            max(0.0, min(100.0, $composite - $weights['saturation_penalty_weight'] * $saturation)),
            2,
        );

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
            'freshness' => 0.18,
            'momentum' => 0.14,
            'technical_relevance' => 0.18,
            'practical_usefulness' => 0.15,
            'novelty' => 0.20,
            'developer_interest' => 0.05,
            'discussion_potential' => 0.05,
            'source_reliability' => 0.05,
            'saturation_penalty_weight' => 0.25,
        ];

        return array_merge(
            $defaults,
            SystemSetting::get('scoring.weights.default', []) ?? [],
        );
    }
}
