<?php

namespace App\Services\AI;

use App\Enums\PostStatus;
use App\Models\ContentPost;
use App\Services\AI\Concerns\LogsAiGenerations;

/**
 * Two-layer quality gate:
 *  1. deterministic rule checks (length, emoji density, banned openers, bare numbers)
 *  2. LLM rubric (6 dimensions + issues)
 *
 * Routing: composite ≥80 → READY · ≥60 → REVIEW · below → DRAFT (issues attached).
 */
class QualityGateService
{
    use LogsAiGenerations;

    private const BANNED_OPENERS = [
        'did you know', 'in today\'s', 'excited to announce', 'game-changer',
        'let that sink in', 'hot take', 'unpopular opinion',
    ];

    public function __construct(
        private readonly AIManager $manager,
        private readonly PromptRegistry $prompts,
    ) {}

    /**
     * @return array{status: PostStatus, total: float, breakdown: array, issues: array}
     */
    public function evaluate(ContentPost $post, array $research = []): array
    {
        $ruleIssues = $this->ruleIssues($post);
        $rubric = $this->llmRubric($post, $research);

        $weights = [
            'technical_accuracy' => 0.25,
            'novelty' => 0.15,
            'practical_value' => 0.20,
            'readability' => 0.15,
            'engagement_potential' => 0.15,
            'source_confidence' => 0.10,
        ];

        $total = 0.0;

        foreach ($weights as $dimension => $weight) {
            $total += $weight * (float) ($rubric[$dimension] ?? 50);
        }

        // Deterministic violations subtract directly.
        $total -= 8.0 * count($ruleIssues);

        $total = round(max(0.0, min(100.0, $total)), 2);

        $breakdown = [
            ...collect($weights)->map(fn ($w, $k) => (float) ($rubric[$k] ?? 50))->all(),
            'rule_violations' => count($ruleIssues),
            'composite' => $total,
        ];

        $issues = [
            ...$ruleIssues,
            ...array_values($rubric['issues'] ?? []),
        ];

        $status = match (true) {
            $total >= 80.0 => PostStatus::Ready,
            $total >= 60.0 => PostStatus::Review,
            default => PostStatus::Draft,
        };

        return ['status' => $status, 'total' => $total, 'breakdown' => $breakdown, 'issues' => $issues];
    }

    /**
     * @return list<string>
     */
    private function ruleIssues(ContentPost $post): array
    {
        $body = trim($post->body);
        $issues = [];

        $length = mb_strlen($body);

        if ($length < 300) {
            $issues[] = "Too short for LinkedIn ($length chars) — aim for 900–1600.";
        } elseif ($length > 3000) {
            $issues[] = "Too long for LinkedIn ($length chars) — trim to under 3000.";
        }

        $emojiCount = preg_match_all('/[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}\x{2B50}]/u', $body)
            ?: 0;

        if ($emojiCount > 3) {
            $issues[] = "$emojiCount emojis — maximum is 3, prefer zero.";
        }

        $opener = mb_strtolower(mb_substr($body, 0, 60));

        foreach (self::BANNED_OPENERS as $banned) {
            if (str_starts_with($opener, $banned)) {
                $issues[] = "Banned opener pattern: \"$banned…\".";
                break;
            }
        }

        // Bare percentages with no source hint are the classic AI hallucination tell.
        if (preg_match_all('/\b\d+(\.\d+)?%/', $body, $matches) >= 1
            && ! str_contains(mb_strtolower($body), 'according to')
            && ! str_contains(mb_strtolower($body), 'benchmark')
            && ! str_contains(mb_strtolower($body), 'our ')
        ) {
            $issues[] = 'Contains percentage figures without a source context.';
        }

        return $issues;
    }

    private function llmRubric(ContentPost $post, array $research): array
    {
        $researchSummary = collect([
            $research['context'] ?? '',
            'Key points:',
            ...array_map(fn ($p) => "- $p", $research['key_points'] ?? []),
            'Trade-offs:',
            ...array_map(fn ($t) => "- $t", $research['tradeoffs'] ?? []),
        ])->filter()->implode("\n");

        $prompt = $this->prompts->render('quality.user', [
            'post_body' => $post->hook !== null ? $post->hook."\n\n".$post->body : $post->body,
            'research_summary' => $researchSummary,
        ]);

        try {
            $response = $this->manager->provider()->complete(
                $this->prompts->get('quality.system'),
                $prompt,
            );

            $this->logGeneration(
                provider: class_basename($this->manager->provider()),
                kind: 'quality',
                idempotencyKey: hash('sha256', 'quality|'.$post->id.'|'.$post->updated_at?->getTimestampMs()),
                requestHash: hash('sha256', substr($post->body, 0, 2000)),
                response: $response,
                postId: $post->id,
            );

            return $response->data;
        } catch (\Throwable $e) {
            $this->logFailure($this->manager, 'quality', hash('sha256', substr($post->body, 0, 2000)), $e, postId: $post->id);

            // Never block the pipeline on judge failure — conservative neutral score.
            report($e);

            return [
                'technical_accuracy' => 65, 'novelty' => 65, 'practical_value' => 65,
                'readability' => 65, 'engagement_potential' => 65, 'source_confidence' => 65,
                'issues' => ['Quality judge unavailable — scored conservatively.'],
            ];
        }
    }
}
