<?php

namespace App\Support;

/**
 * Normalizes hashtags coming from the AI or user edits into LinkedIn-safe
 * tags: no '#', no spaces, alphanumeric only, unique, max 8, max 30 chars.
 */
final class Hashtags
{
    public const MAX_TAGS = 8;

    public const MAX_LENGTH = 30;

    /**
     * @return list<string>
     */
    public static function sanitize(mixed $input): array
    {
        $raw = match (true) {
            is_string($input) => preg_split('/[,\s]+/', $input) ?: [],
            is_array($input) => $input,
            default => [],
        };

        $seen = [];
        $tags = [];

        foreach ($raw as $item) {
            if (! is_string($item)) {
                continue;
            }

            $parts = preg_split('/[\s\-_]+/', ltrim(trim($item), '#')) ?: [];
            $parts = array_filter($parts, fn (string $p) => $p !== '');

            if ($parts === []) {
                continue;
            }

            $joined = implode('', array_map(fn (string $p) => ucfirst($p), $parts));
            $clean = (string) preg_replace('/[^A-Za-z0-9]/', '', $joined);

            if ($clean === '' || mb_strlen($clean) > self::MAX_LENGTH) {
                continue;
            }

            $key = mb_strtolower($clean);

            if (isset($seen[$key])) {
                continue;
            }

            $seen[$key] = true;
            $tags[] = $clean;

            if (count($tags) >= self::MAX_TAGS) {
                break;
            }
        }

        return $tags;
    }

    /**
     * @param list<string> $tags
     */
    public static function toText(array $tags): string
    {
        return implode(' ', array_map(fn (string $tag) => '#'.$tag, $tags));
    }
}
