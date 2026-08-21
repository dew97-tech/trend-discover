<?php

namespace App\Services\AI;

use App\Models\Trend;

interface AIProvider
{
    /**
     * Structured technical research for a trend.
     *
     * @return AiResponse data: {context, key_points[], tradeoffs[], practical_angle, confidence, facts_to_avoid[]}
     */
    public function research(Trend $trend, string $renderedPrompt): AiResponse;

    /**
     * Generate a LinkedIn post from research + spec.
     *
     * @return AiResponse data: {title, hook, body}
     */
    public function generatePost(string $renderedPrompt): AiResponse;

    /**
     * Rubric quality judgment for a drafted post.
     *
     * @return AiResponse data: {technical_accuracy, novelty, practical_value,
     *                         readability, engagement_potential, source_confidence, issues[]}
     */
    public function judgeQuality(string $renderedPrompt): AiResponse;
}
