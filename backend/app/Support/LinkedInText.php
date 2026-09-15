<?php

namespace App\Support;

/**
 * Conservative LinkedIn-safe normalizer for AI output.
 *
 * LinkedIn does not render markdown, so display markers are stripped while
 * code content (inline spans and fenced blocks) is preserved verbatim.
 * Fence lines are removed but the code inside survives.
 */
final class LinkedInText
{
    /**
     * First non-empty line — the hook by convention.
     */
    public static function hook(string $body): string
    {
        foreach (preg_split('/\R/u', $body) ?: [] as $line) {
            $line = trim($line);

            if ($line !== '') {
                return $line;
            }
        }

        return '';
    }

    /**
     * Remove the hook line from the body when the body still duplicates it
     * (pre-separation posts). Returns the body untouched when the first
     * non-empty line differs from the hook.
     */
    public static function stripLeadingHookLine(string $body, ?string $hook): string
    {
        $hook = trim((string) $hook);

        if ($hook === '') {
            return $body;
        }

        $lines = explode("\n", str_replace(["\r\n", "\r"], "\n", $body));
        $index = null;

        foreach ($lines as $i => $line) {
            if (trim($line) !== '') {
                $index = $i;

                break;
            }
        }

        if ($index === null || self::normalizeForComparison($lines[$index]) !== self::normalizeForComparison($hook)) {
            return $body;
        }

        $rest = array_slice($lines, $index + 1);

        while ($rest !== [] && trim($rest[0]) === '') {
            array_shift($rest);
        }

        return trim(implode("\n", $rest));
    }

    private static function normalizeForComparison(string $value): string
    {
        return mb_strtolower(trim(preg_replace('/\s+/u', ' ', $value) ?? $value));
    }

    public static function normalize(string $text): string
    {
        $lines = preg_split('/\R/u', str_replace(["\r\n", "\r"], "\n", $text)) ?: [];
        $out = [];
        $fence = [];
        $inFence = false;

        foreach ($lines as $line) {
            if (preg_match('/^\s*```/', $line) === 1) {
                if ($inFence) {
                    // Closing fence: keep the code lines, drop the fence itself.
                    array_push($out, ...$fence);
                    $fence = [];
                }

                $inFence = ! $inFence;

                continue;
            }

            if ($inFence) {
                $fence[] = $line;

                continue;
            }

            $out[] = self::normalizeLine($line);
        }

        // Unclosed fence at the end: still keep what was inside.
        array_push($out, ...$fence);

        $normalized = preg_replace("/\n{3,}/u", "\n\n", implode("\n", $out)) ?? implode("\n", $out);

        return trim($normalized);
    }

    private static function normalizeLine(string $line): string
    {
        // Protect inline code spans before touching emphasis markers.
        $code = [];
        $line = preg_replace_callback(
            '/`([^`]+)`/u',
            function (array $m) use (&$code): string {
                $code[] = $m[1];

                return "\x00".(count($code) - 1)."\x00";
            },
            $line,
        ) ?? $line;

        // Headings: "### Text" → "Text"
        $line = preg_replace('/^\s{0,3}#{1,6}\s+/u', '', $line) ?? $line;

        // Bold / italic markers.
        $line = preg_replace('/\*\*(.+?)\*\*/u', '$1', $line) ?? $line;
        $line = preg_replace('/__(.+?)__/u', '$1', $line) ?? $line;
        $line = preg_replace('/(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])/u', '$1', $line) ?? $line;
        $line = preg_replace('/(?<![\w_])_(?!\s)(.+?)(?<!\s)_(?![\w_])/u', '$1', $line) ?? $line;

        // Markdown links: [text](url) → text (url)
        $line = preg_replace('/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/u', '$1 ($2)', $line) ?? $line;

        return preg_replace_callback(
            '/\x00(\d+)\x00/',
            fn (array $m): string => $code[(int) $m[1]] ?? '',
            $line,
        ) ?? $line;
    }
}
