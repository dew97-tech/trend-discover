<?php

namespace App\Services\AI;

use App\Models\SystemSetting;
use Illuminate\Support\Facades\View;

/**
 * Resolves prompt templates dynamically:
 * system_settings('ai.prompts') overrides → config/prompts.php fallback.
 *
 * Templates are plain text with {{placeholder}} tokens — rendered via a tiny
 * blade-free replacer so prompts stay data, not code.
 */
class PromptRegistry
{
    public function get(string $key): string
    {
        $overrides = SystemSetting::get('ai.prompts', []) ?? [];

        return $overrides[$key] ?? config("prompts.$key")
            ?? throw new \InvalidArgumentException(
                "Unknown prompt template [$key]. If you just added it, note that long-running ".
                'queue workers cache config in memory — run `php artisan queue:restart` and retry.',
            );
    }

    /**
     * @param array<string, string|null> $vars
     */
    public function render(string $key, array $vars = []): string
    {
        $template = $this->get($key);

        // Optional nested persona inclusion: "{{persona}}" pulls the shared block.
        if (str_contains($template, '{{persona}}')) {
            $template = str_replace('{{persona}}', $this->get('persona'), $template);
        }

        foreach ($vars as $var => $value) {
            $template = str_replace(
                '{{'.$var.'}}',
                self::stringify($value),
                $template,
            );
        }

        return $template;
    }

    private static function stringify(mixed $value): string
    {
        return match (true) {
            is_array($value) => collect($value)
                ->map(fn ($line) => '- '.self::stringify($line))
                ->implode("\n"),
            $value === null => 'not provided',
            default => (string) $value,
        };
    }
}
