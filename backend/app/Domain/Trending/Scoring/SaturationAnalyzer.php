<?php

namespace App\Domain\Trending\Scoring;

use App\Models\Trend;
use App\Domain\Trending\Clustering\TitleSimilarity;
use Illuminate\Support\Collection;

/**
 * Estimates how "already everywhere" a topic is, using only our own corpus:
 *
 *  A. breadth        — share of active sources covering the trend (40%)
 *  B. sibling density— other trends with near-identical titles (40%)
 *  C. item repetition— cluster size vs corpus norm (20%)
 */
class SaturationAnalyzer
{
    public function __construct(
        private readonly float $siblingThreshold = 0.45,
        private readonly int $windowDays = 14,
    ) {}

    public function analyze(Trend $trend): float
    {
        $breadth = $this->breadthScore($trend);
        $siblings = $this->siblingDensity($trend);
        $repetition = $this->repetitionScore($trend);

        return round(
            0.40 * $breadth + 0.40 * $siblings + 0.20 * $repetition,
            2,
        );
    }

    private function breadthScore(Trend $trend): float
    {
        $covering = $trend->signals()->distinct('source_id')->count('source_id');
        $activeSources = max(1, (int) \App\Models\Source::query()->where('is_enabled', true)->count());

        return min(100.0, ($covering / $activeSources) * 100.0);
    }

    private function siblingDensity(Trend $trend): float
    {
        $peers = Trend::query()
            ->active()
            ->whereKeyNot($trend->id)
            ->where('first_seen_at', '>=', now()->subDays($this->windowDays))
            ->limit(300)
            ->get(['id', 'title']);

        if ($peers->isEmpty()) {
            return 0.0;
        }

        $similar = $peers->filter(
            fn (Trend $peer) => TitleSimilarity::similarity($trend->title, $peer->title) >= $this->siblingThreshold,
        )->count();

        return round(min(100.0, ($similar / max(5, $peers->count())) * 400.0), 2);
    }

    private function repetitionScore(Trend $trend): float
    {
        $avgItems = (float) \App\Models\Trend::query()
            ->active()
            ->where('first_seen_at', '>=', now()->subDays($this->windowDays))
            ->avg('item_count');

        if ($avgItems <= 0) {
            return 0.0;
        }

        return round(min(100.0, (($trend->item_count - $avgItems) / max(1.0, $avgItems)) * 50.0 + 30.0), 2);
    }
}
