<?php

namespace App\Domain\Trending\Clustering;

/**
 * Lexical title similarity via word-bigram shingles + Jaccard coefficient.
 * Deterministic, free, fast — no AI calls in the clustering path.
 */
final class TitleSimilarity
{
    private const STOPWORDS = [
        'the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'for',
        'with', 'at', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
        'it', 'its', 'this', 'that', 'these', 'those', 'as', 'your', 'you',
        'how', 'why', 'what', 'new', 'vs', 'into', 'about', 'after', 'before',
    ];

    public static function shingles(string $title): array
    {
        $tokens = self::tokenize($title);

        if (count($tokens) < 2) {
            return $tokens !== [] ? [$tokens[0]] : [];
        }

        $shingles = [];

        for ($i = 0; $i < count($tokens) - 1; $i++) {
            $shingles[] = $tokens[$i].' '.$tokens[$i + 1];
        }

        return array_unique($shingles);
    }

    /** @return float 0.0 – 1.0 */
    public static function similarity(string $titleA, string $titleB): float
    {
        $a = self::shingles($titleA);
        $b = self::shingles($titleB);

        if ($a === [] || $b === []) {
            return 0.0;
        }

        $intersection = count(array_intersect($a, $b));
        $union = count(array_unique(array_merge($a, $b)));

        return $union > 0 ? $intersection / $union : 0.0;
    }

    /**
     * Short titles produce few shingles, inflating Jaccard on weak overlaps.
     * Require a proportionally higher score for them.
     */
    public static function passesThreshold(string $titleA, string $titleB, float $threshold): bool
    {
        $minTokens = min(
            count(self::tokenize($titleA)),
            count(self::tokenize($titleB)),
        );

        $effective = match (true) {
            $minTokens <= 3 => max($threshold, 0.80),
            $minTokens <= 5 => max($threshold, 0.65),
            default => $threshold,
        };

        return self::similarity($titleA, $titleB) >= $effective;
    }

    /** @return list<string> */
    private static function tokenize(string $title): array
    {
        // Collector-added source tags like "[Dev.to/php]" or "[Laravel News]"
        // would otherwise pollute the shingles and block cross-source merges.
        $stripped = preg_replace('/\[[^\]]*\]/', ' ', $title) ?? $title;
        $normalized = mb_strtolower(preg_replace('/[^a-z0-9\s]/i', ' ', $stripped) ?? '');

        return array_values(array_filter(
            explode(' ', $normalized),
            fn (string $word) => $word !== '' && ! in_array($word, self::STOPWORDS, true),
        ));
    }
}
