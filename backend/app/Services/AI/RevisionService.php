<?php

namespace App\Services\AI;

use App\Enums\AiGenerationKind;
use App\Models\ContentPost;
use App\Models\PostRevision;
use App\Services\AI\Concerns\LogsAiGenerations;
use App\Support\LinkedInText;
use RuntimeException;

/**
 * Applies an author's correction to an existing post (hook or body) with the
 * trend's research as ground truth. Output is always re-synced so the hook is
 * the body's first line and no markdown markers leak onto LinkedIn.
 */
class RevisionService
{
    use LogsAiGenerations;

    private const LINKEDIN_LIMIT = 3000;

    private const HOOK_LIMIT = 210;

    public function __construct(
        private readonly AIManager $manager,
        private readonly PromptRegistry $prompts,
    ) {}

    /**
     * @return array{hook: ?string, body: ?string, notes: ?string}
     */
    public function revise(PostRevision $revision): array
    {
        $post = $revision->post()->with('trend')->first();

        if ($post === null) {
            throw new RuntimeException('Post no longer exists.');
        }

        $research = $this->researchFor($post);
        $isHook = $revision->target === PostRevision::TARGET_HOOK;

        $prompt = $this->prompts->render('revise.user', [
            'target' => $revision->target,
            'target_rule' => $this->targetRule($revision->target),
            'length_rule' => $this->lengthRule($revision->target, (string) $revision->body_before),
            'output_schema' => $isHook
                ? '  "hook": "the revised first line",'
                : '  "body": "the revised post content (without the hook)",',
            'hook' => (string) ($revision->hook_before ?? ''),
            'body' => (string) $revision->body_before,
            'char_count' => mb_strlen((string) $revision->body_before),
            'word_count' => str_word_count((string) $revision->body_before),
            'instruction' => (string) $revision->instruction,
            'reference' => $revision->reference !== null && trim($revision->reference) !== ''
                ? $revision->reference
                : 'not provided',
            'research_context' => $research['context'] ?? 'not provided',
            'research_points' => $research['key_points'] ?? [],
            'research_tradeoffs' => $research['tradeoffs'] ?? [],
        ]);

        $requestHash = hash('sha256', implode('|', [
            'revision',
            $post->id,
            $revision->target,
            md5((string) $revision->instruction),
            md5((string) $revision->reference),
            md5((string) $revision->body_before),
        ]));

        $started = now()->getTimestampMs();

        try {
            $response = $this->manager->provider()->complete(
                $this->prompts->get('revise.system'),
                $prompt,
            );
        } catch (\Throwable $e) {
            $this->logFailure(
                $this->manager,
                AiGenerationKind::Revision->value,
                $requestHash,
                $e,
                postId: $post->id,
                durationMs: max(0, now()->getTimestampMs() - $started),
            );

            throw $e;
        }

        $this->logGeneration(
            provider: class_basename($this->manager->provider()),
            kind: AiGenerationKind::Revision->value,
            idempotencyKey: hash('sha256', "revision|{$revision->id}|".uniqid()),
            requestHash: $requestHash,
            response: $response,
            postId: $post->id,
        );

        $data = $response->data;
        $notes = trim((string) ($data['notes'] ?? '')) ?: null;

        if ($isHook) {
            $hook = LinkedInText::normalize(trim((string) ($data['hook'] ?? '')));

            if ($hook === '') {
                throw new RuntimeException('The revision came back without a hook — try again.');
            }

            if (mb_strlen($hook) > self::HOOK_LIMIT) {
                $hook = mb_substr($hook, 0, self::HOOK_LIMIT);
            }

            return ['hook' => $hook, 'body' => null, 'notes' => $notes];
        }

        $body = LinkedInText::normalize((string) ($data['body'] ?? ''));

        if ($body === '') {
            throw new RuntimeException('The revision came back without a body — try again.');
        }

        if (mb_strlen($body) > self::LINKEDIN_LIMIT) {
            throw new RuntimeException(
                'The revision came back over LinkedIn\'s 3000-character limit — try a more specific instruction.',
            );
        }

        return ['hook' => null, 'body' => $body, 'notes' => $notes];
    }

    /**
     * Ground truth for the revision. Cached research is normally free — it was
     * produced when the post was generated. If research is unavailable we still
     * revise, but the prompt's accuracy rules keep claims conservative.
     *
     * @return array<string, mixed>
     */
    private function researchFor(ContentPost $post): array
    {
        $trend = $post->trend;

        if ($trend === null) {
            return [];
        }

        try {
            ['research' => $research] = app(ResearchService::class)->getOrGenerate($trend);

            return is_array($research) ? $research : [];
        } catch (\Throwable) {
            return [];
        }
    }

    private function targetRule(string $target): string
    {
        return match ($target) {
            PostRevision::TARGET_HOOK => 'Rewrite only the hook (the first line). The body stays exactly as it is.',
            default => 'Rewrite only the body content. The hook stays exactly as it is and is not part of the body.',
        };
    }

    private function lengthRule(string $target, string $body): string
    {
        if ($target === PostRevision::TARGET_HOOK) {
            return 'The hook must be at most 210 characters and stay close to the current hook length.';
        }

        return 'Keep the body within ±15% of the current length (~'.mb_strlen($body).' characters) and never exceed 3000 characters.';
    }
}
