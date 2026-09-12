<?php

namespace App\Domain\Trending\Clustering;

use App\Models\Technology;

/**
 * Shared technology/category matching for clustering and reclassification.
 *
 * Matching is word-boundary based (not substring): aliases like "git" must
 * not match inside "Arrayref" (the documented Phase-3 misclassification bug).
 */
final class TechnologyClassifier
{
    /**
     * @return array{0: ?int, 1: list<int>} category id + technology ids
     */
    public function classify(string $text): array
    {
        $haystack = mb_strtolower($text);

        $technologies = Technology::query()
            ->where('is_active', true)
            ->get(['id', 'name', 'slug', 'aliases', 'category_id']);

        $matched = $technologies->filter(function (Technology $tech) use ($haystack) {
            $names = [$tech->name, str_replace('-', ' ', $tech->slug), ...($tech->aliases ?? [])];

            foreach ($names as $name) {
                if (self::containsWord($haystack, mb_strtolower($name))) {
                    return true;
                }
            }

            return false;
        });

        return [
            $matched->first()?->category_id,
            $matched->pluck('id')->take(6)->all(),
        ];
    }

    /**
     * Word-boundary substring test — works for multi-word ("app router") and
     * dotted ("next.js") aliases; ignores matches inside larger words.
     */
    public static function containsWord(string $haystack, string $needle): bool
    {
        if ($needle === '') {
            return false;
        }

        return preg_match(
            '/(?<![\p{L}\p{N}])'.preg_quote($needle, '/').'(?![\p{L}\p{N}])/u',
            $haystack,
        ) === 1;
    }
}
