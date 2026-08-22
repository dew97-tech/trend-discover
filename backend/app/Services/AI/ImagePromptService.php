<?php

namespace App\Services\AI;

use App\Enums\ImageType;
use App\Models\ContentImage;
use App\Models\ContentPost;
use App\Models\SystemSetting;
use App\Services\AI\Concerns\LogsAiGenerations;

/**
 * Writes a detailed, post-aware image-generation prompt the user copies
 * into any external tool (Midjourney/DALL-E/etc). Cost-capped per post.
 *
 * Async since Phase 7.6: controller creates a PENDING row and queues
 * GenerateImagePromptJob; this service performs the AI call and the job
 * fills the row. Limit counting considers READY rows only.
 */
class ImagePromptService
{
    use LogsAiGenerations;

    public function __construct(
        private readonly AIManager $manager,
        private readonly PromptRegistry $prompts,
    ) {}

    public function limitReached(ContentPost $post): bool
    {
        return ContentImage::query()
            ->where('content_post_id', $post->id)
            ->where('type', ImageType::Prompt->value)
            ->where('status', 'ready')
            ->count() >= self::maxPerPost();
    }

    /**
     * Pure AI call — no database writes.
     *
     * @return array{prompt_text: string, negative_prompt: string}
     */
    public function buildPrompt(ContentPost $post): array
    {
        // Re-use research as grounding so the prompt stays relevant to content.
        ['research' => $research] = app(ResearchService::class)->getOrGenerate($post->trend);

        $prompt = $this->prompts->render('image_prompt.user', [
            'post_summary' => str(($post->hook ?? '').' '.($post->title ?? '').' '.mb_substr($post->body, 0, 800)),
            'key_points' => $research['key_points'] ?? [],
        ]);

        $started = now()->getTimestampMs();

        try {
            $response = $this->manager->provider()->complete(
                $this->prompts->get('image_prompt.system'),
                $prompt,
            );
        } catch (\Throwable $e) {
            $this->logFailure($this->manager, 'image_prompt', hash('sha256', 'image_prompt|'.$post->id), $e, postId: $post->id, durationMs: max(0, now()->getTimestampMs() - $started));

            throw $e;
        }

        $data = $response->data;

        $this->logGeneration(
            provider: class_basename($this->manager->provider()),
            kind: 'image_prompt',
            idempotencyKey: hash('sha256', 'image_prompt|'.$post->id.'|'.uniqid()),
            requestHash: hash('sha256', implode('|', [
                'image_prompt',
                $post->id,
                md5($post->body),
            ])),
            response: $response,
            postId: $post->id,
        );

        return [
            'prompt_text' => str((string) ($data['prompt_text'] ?? ''))->limit(2000),
            'negative_prompt' => (string) ($data['negative_prompt'] ?? ''),
        ];
    }

    public static function maxPerPost(): int
    {
        $limits = SystemSetting::get('generation.limits', []) ?? [];

        return (int) ($limits['max_image_prompts_per_post'] ?? 2);
    }
}
