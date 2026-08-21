<?php

namespace App\Services\AI;

use App\Domain\Trending\Clustering\TitleSimilarity;
use App\Models\Trend;

/**
 * Deterministic zero-cost provider for development and tests.
 * Produces structurally valid output so the entire pipeline is
 * exercisable without an API key.
 */
final class MockProvider implements AIProvider
{
    public function __construct(private readonly PromptRegistry $prompts) {}

    public function research(Trend $trend, string $renderedPrompt): AiResponse
    {
        return new AiResponse(
            data: [
                'context' => "Mock research context for: {$trend->title}. This topic surfaced from recent cross-source activity.",
                'key_points' => [
                    'Primary mechanism explained in concrete engineering terms',
                    'Measured impact in a representative workload',
                    'Common misconfiguration that causes the problem',
                ],
                'tradeoffs' => [
                    'Added complexity vs the performance gained',
                    'Operational burden of the alternative approach',
                ],
                'practical_angle' => 'What a working engineer should check in their own stack today.',
                'confidence' => 'medium',
                'facts_to_avoid' => [],
            ],
            durationMs: 40,
            tokensIn: null,
            tokensOut: null,
            model: 'mock',
        );
    }

    public function generatePost(string $renderedPrompt): AiResponse
    {
        // Extract a hint of format/tone for slightly varied mock output.
        str_contains($renderedPrompt, 'Before → After') ? $flavor = 'before-after' : $flavor = 'insight';

        $body = $flavor === 'before-after'
            ? "Our query took 2,400ms. After one index change: 90ms.\n\nSame data, same hardware — the execution plan had quietly flipped to a full scan.\n\nWhat changed:\n- Added a composite index matching the actual filter order\n- Rewrote the OR clause as a UNION so the planner could use it\n\nThe fix was 15 minutes. Finding it took two days because nothing looked wrong on the dashboard.\n\nIf your API latency creeps up under load, check the plan, not the hardware."
            : "Most teams don't have a performance problem. They have a visibility problem.\n\nWe spent a week optimizing queries that were fine. The real bottleneck sat in a place nobody had instrumentation on: serialization before the cache layer.\n\nThree things I now check first:\n1. Where bytes get converted, not where CPU spikes\n2. Cache hit ratio per key family, not global\n3. What the p99 actually waits on\n\nMeasure the path, not the parts.";

        return new AiResponse(
            data: [
                'title' => '[MOCK] Engineering post draft',
                'hook' => strtok($body, "\n"),
                'body' => $body,
            ],
            durationMs: 25,
            tokensIn: null,
            tokensOut: null,
            model: 'mock',
        );
    }

    public function judgeQuality(string $renderedPrompt): AiResponse
    {
        return new AiResponse(
            data: [
                'technical_accuracy' => 88,
                'novelty' => 82,
                'practical_value' => 90,
                'readability' => 92,
                'engagement_potential' => 80,
                'source_confidence' => 85,
                'issues' => ['[MOCK JUDGE] Verify claims against sources before publishing.'],
            ],
            durationMs: 15,
            tokensIn: null,
            tokensOut: null,
            model: 'mock',
        );
    }
}
