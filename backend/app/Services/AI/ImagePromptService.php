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
 */
class ImagePromptService
{
    use LogsAiGenerations;

    public function __construct(
        private readonly AIManager $manager,
        private readonly PromptRegistry $prompts,
    ) {}

    /**
     * @return array{image: ContentImage, cached: bool}
     */
    public function generateFor(ContentPost $post): array
    {
        $existingCount = ContentImage::query()
            ->where('content_post_id', $post->id)
            ->where('type', ImageType::Prompt->value)
            ->count();

        if ($existingCount >= $this->maxPerPost()) {
            abort(422, 'Image-prompt limit reached for this post (max '.$this->maxPerPost().').');
        }

        // Re-use research as grounding so the prompt stays relevant to content.
        ['research' => $research] = app(ResearchService::class)->getOrGenerate($post->trend);

        $prompt = $this->prompts->render('image_prompt.user', [
            'post_summary' => str(($post->hook ?? '').' '.($post->title ?? '').' '.mb_substr($post->body, 0, 800)),
            'key_points' => $research['key_points'] ?? [],
        ]);

        $response = $this->manager->provider()->complete(
            $this->prompts->get('image_prompt.system'),
            $prompt,
        );

        $data = $response->data;

        $image = ContentImage::query()->create([
            'content_post_id' => $post->id,
            'type' => ImageType::Prompt->value,
            'status' => 'ready',
            'prompt_text' => str((string) ($data['prompt_text'] ?? ''))->limit(2000),
            'spec' => [
                'negative_prompt' => (string) ($data['negative_prompt'] ?? ''),
                'suggested_style' => 'flat vector / isometric technical diagram',
            ],
            'generated_at' => now(),
        ]);

        $this->logGeneration(
            provider: class_basename($this->manager->provider()),
            kind: 'image_prompt',
            idempotencyKey: hash('sha256', "image_prompt|{$post->id}|".uniqid()),
            requestHash: hash('sha256', implode('|', [
                'image_prompt',
                $post->id,
                md5($post->body),
                $existingCount,
            ])),
            response: $response,
            postId: $post->id,
        );

        return ['image' => $image, 'cached' => false];
    }

    private function maxPerPost(): int
    {
        $limits = SystemSetting::get('generation.limits', []) ?? [];

        return (int) ($limits['max_image_prompts_per_post'] ?? 2);
    }
}
