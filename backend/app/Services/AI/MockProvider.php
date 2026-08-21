<?php

namespace App\Services\AI;

use App\Models\Trend;

/**
 * Deterministic zero-cost provider for development and tests.
 * Dispatches on distinctive markers in the rendered user prompt so each
 * pipeline stage receives a structurally valid fake response.
 */
final class MockProvider implements AIProvider
{
    public function complete(string $systemPrompt, string $userPrompt): AiResponse
    {
        return new AiResponse(
            data: $this->fakeFor($userPrompt),
            durationMs: 30,
            tokensIn: null,
            tokensOut: null,
            model: 'mock',
        );
    }

    private function fakeFor(string $userPrompt): array
    {
        // Research
        if (str_contains($userPrompt, '"context":')) {
            $title = $this->between($userPrompt, 'Title:', 'Summary:') ?: 'the topic';

            return [
                'context' => "Mock research context for ".trim($title).". Surfaced from recent cross-source activity.",
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
            ];
        }

        // Snippet suggestion
        if (str_contains($userPrompt, '"code":')) {
            return [
                'code' => "<?php\n\n// [MOCK] The change that made the difference\n\$query->forceIndex('status_created_at_idx')\n       ->where('status', 'active')\n       ->orderByDesc('created_at')\n       ->limit(50)\n       ->get();",
                'language' => 'php',
                'title' => 'The index hint fix',
            ];
        }

        // Image prompt generation
        if (str_contains($userPrompt, '"prompt_text":')) {
            return [
                'prompt_text' => '[MOCK] Minimal isometric technical diagram of a database query plan branching into an optimized path, flat vector style, deep blue #0a66c2 and dark slate palette, single warm amber accent, no text, clean geometry, editorial illustration quality.',
                'negative_prompt' => 'stock photos, humans at desks, text inside image, gradients with noise',
            ];
        }

        // Quality rubric
        if (str_contains($userPrompt, '"technical_accuracy"')) {
            return [
                'technical_accuracy' => 88,
                'novelty' => 82,
                'practical_value' => 90,
                'readability' => 92,
                'engagement_potential' => 80,
                'source_confidence' => 85,
                'issues' => ['[MOCK JUDGE] Verify claims against sources before publishing.'],
            ];
        }

        // LinkedIn post (default)
        $flavor = str_contains($userPrompt, 'Before → After') ? 'before-after' : 'insight';

        $body = $flavor === 'before-after'
            ? "Our query took 2,400ms. After one index change: 90ms.\n\nSame data, same hardware — the execution plan had quietly flipped to a full scan.\n\nWhat changed:\n- Added a composite index matching the actual filter order\n- Rewrote the OR clause as a UNION so the planner could use it\n\nThe fix was 15 minutes. Finding it took two days because nothing looked wrong on the dashboard.\n\nIf your API latency creeps up under load, check the plan, not the hardware."
            : "Most teams don't have a performance problem. They have a visibility problem.\n\nWe spent a week optimizing queries that were fine. The real bottleneck sat in a place nobody had instrumentation on: serialization before the cache layer.\n\nThree things I now check first:\n1. Where bytes get converted, not where CPU spikes\n2. Cache hit ratio per key family, not global\n3. What the p99 actually waits on\n\nMeasure the path, not the parts.";

        return [
            'title' => '[MOCK] Engineering post draft',
            'hook' => strtok($body, "\n"),
            'body' => $body,
        ];
    }

    private function between(string $haystack, string $start, string $end): string
    {
        $from = strpos($haystack, $start);

        if ($from === false) {
            return '';
        }

        $from += strlen($start);
        $to = strpos($haystack, $end, $from);

        return $to !== false ? substr($haystack, $from, $to - $from) : '';
    }
}
