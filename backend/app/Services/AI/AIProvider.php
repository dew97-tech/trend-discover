<?php

namespace App\Services\AI;

interface AIProvider
{
    /**
     * Single primitive: send a system+user pair, get structured JSON back.
     * All higher-level operations (research, post generation, judging,
     * snippets, image prompts) are composed in services via PromptRegistry.
     */
    public function complete(string $systemPrompt, string $userPrompt): AiResponse;
}
