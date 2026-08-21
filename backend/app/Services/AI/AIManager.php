<?php

namespace App\Services\AI;

use Illuminate\Support\Facades\Log;

/**
 * Resolves the active provider. Falls back to MockProvider when the
 * OpenCode Go key is absent so development never blocks on credentials.
 */
class AIManager
{
    public function __construct(private readonly PromptRegistry $prompts) {}

    public function provider(): AIProvider
    {
        $default = (string) config('ai.default_provider', 'opencode_go');

        if ($default === 'mock') {
            return new MockProvider($this->prompts);
        }

        $key = (string) config('ai.providers.opencode_go.api_key');

        if (trim($key) === '') {
            Log::warning('AI: OPENCODE_GO_API_KEY empty — falling back to MockProvider.');

            return new MockProvider($this->prompts);
        }

        return new OpenCodeGoProvider($this->prompts);
    }
}
