<?php

namespace App\Domain\Trending\Scoring;

use App\Models\Trend;

/**
 * Dimension scorers produce 0–100 values. Pure functions of the trend
 * + corpus context; no I/O beyond the passed models.
 */
final class DimensionScorers
{
    /** Exponential decay, half-life 36h, floor 5. */
    public static function freshness(Trend $trend): float
    {
        $newest = $trend->last_seen_at ?? $trend->created_at;

        if ($newest === null) {
            return 5.0;
        }

        $ageHours = max(0.0, $newest->diffInHours(now(), false));

        return max(5.0, round(100.0 * pow(0.5, $ageHours / 36.0), 2));
    }

    /** Engagement velocity (per hour since first seen), log-scaled to 100 @ ~100/h. */
    public static function momentum(Trend $trend): float
    {
        $first = $trend->first_seen_at ?? $trend->created_at;

        if ($first === null) {
            return 0.0;
        }

        $hours = max(1.0, $first->diffInHours(now(), false));
        $velocity = ($trend->metrics['total_engagement'] ?? 0) / $hours;

        return round(min(100.0, 50.0 * log10(1 + $velocity)), 2);
    }

    /** Registry matches: category presence + matched technology count. */
    public static function relevance(Trend $trend): float
    {
        $techCount = $trend->technologies()->count();
        $hasCategory = $trend->category_id !== null;

        return (float) min(100, 20 + 25 * $techCount + ($hasCategory ? 15 : 0));
    }

    /** Practical-usefulness heuristics until the Phase-5 LLM judge arrives. */
    public static function usefulness(Trend $trend): float
    {
        $flags = $trend->metrics['flags'] ?? [];

        // Junk dampeners — star-farmed/promo repos must not rank as useful.
        if (isset($flags['repo_no_description'])) {
            return 25.0;
        }

        $text = mb_strtolower($trend->title.' '.($trend->summary ?? ''));

        $signals = [
            'optimiz', 'performance', 'benchmark', 'debug', 'how to', 'guide',
            'deep dive', 'internals', 'refactor', 'scaling', 'profiling',
            'migration', 'security', 'vulnerab', 'best practice', 'lesson',
        ];

        $hits = 0;

        foreach ($signals as $signal) {
            if (str_contains($text, $signal)) {
                $hits++;
            }
        }

        $score = min(100, 55 + 15 * $hits);

        if (isset($flags['emoji_heavy'])) {
            $score = min($score, 45.0);
        }

        if (isset($flags['suspect_velocity'])) {
            $score = min($score, 30.0);
        }

        return (float) $score;
    }

    /** Raw engagement volume, log-scaled to 100 @ ~1000 points. */
    public static function interest(Trend $trend): float
    {
        $total = (int) ($trend->metrics['total_engagement'] ?? 0);

        return round(min(100.0, (100.0 / 3.0) * log10(1 + $total)), 2);
    }

    /** Comment share of total engagement — discussion-heavy topics score high. */
    public static function discussion(Trend $trend): float
    {
        $comments = (int) ($trend->metrics['total_comments'] ?? 0);
        $engagement = max(1, (int) ($trend->metrics['total_engagement'] ?? 1));

        $ratio = min(1.0, $comments / max(1, $engagement));

        return round(min(100.0, $ratio * 200.0), 2);
    }

    /** Source trust: official API sources are uniformly reliable in our registry. */
    public static function sourceReliability(Trend $trend): float
    {
        $sources = $trend->signals()->distinct('source_id')->count('source_id');

        return (float) min(100, 65 + 10 * $sources);
    }
}
