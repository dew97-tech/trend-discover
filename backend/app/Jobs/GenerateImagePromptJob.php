<?php

namespace App\Jobs;

use App\Models\ContentImage;
use App\Models\ContentPost;
use App\Models\JobRun;
use App\Repositories\Contracts\JobRunRepositoryInterface;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

/**
 * Generates a post-aware image prompt in a worker (AI calls can exceed web
 * request limits). The ContentImage row is created as `pending` by the
 * controller before dispatch; this job fills prompt_text and flips status.
 */
class GenerateImagePromptJob implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $tries = 2;

    public array $backoff = [30];

    public int $timeout = 600;

    public function uniqueId(): string
    {
        return "image-prompt-{$this->postId}";
    }

    public function __construct(public readonly int $postId) {}

    public function handle(\App\Services\AI\ImagePromptService $service, JobRunRepositoryInterface $runs): void
    {
        $run = $runs->start(static::class);
        $log = $runs->logger($run);

        $post = ContentPost::query()->find($this->postId);

        if ($post === null) {
            $log->warning('skipped — post no longer exists');
            $runs->finish($run, JobRun::STATUS_SUCCESS, meta: ['skipped' => 'post deleted']);

            return;
        }

        // Authoritative re-check: other jobs may have consumed the cap
        // between the controller's fast validation and this execution.
        if ($service->limitReached($post)) {
            $log->error('blocked — image-prompt limit reached for this post');

            ContentImage::query()
                ->where('content_post_id', $this->postId)
                ->where('type', \App\Enums\ImageType::Prompt->value)
                ->where('status', 'pending')
                ->delete();

            $runs->finish($run, JobRun::STATUS_FAILED, error: 'Image-prompt limit reached for this post.');

            return;
        }

        try {
            $log->info('generating image prompt', ['post_id' => $post->id]);

            $built = $service->buildPrompt($post);

            $image = ContentImage::query()
                ->where('content_post_id', $this->postId)
                ->where('type', \App\Enums\ImageType::Prompt->value)
                ->where('status', 'pending')
                ->orderByDesc('id')
                ->first();

            if ($image === null) {
                $image = ContentImage::query()->create([
                    'content_post_id' => $this->postId,
                    'type' => \App\Enums\ImageType::Prompt->value,
                    'status' => 'ready',
                ]);
            }

            $image->forceFill([
                'status' => 'ready',
                'prompt_text' => $built['prompt_text'],
                'spec' => [
                    'negative_prompt' => $built['negative_prompt'],
                    'suggested_style' => 'flat vector / isometric technical diagram',
                ],
                'generated_at' => now(),
            ])->save();

            $log->info('image prompt ready', [
                'prompt_preview' => str($built['prompt_text'])->limit(100),
            ]);

            $runs->finish($run, JobRun::STATUS_SUCCESS, meta: [
                'image_id' => $image->id,
            ]);
        } catch (Throwable $e) {
            ContentImage::query()
                ->where('content_post_id', $this->postId)
                ->where('type', \App\Enums\ImageType::Prompt->value)
                ->where('status', 'pending')
                ->update(['status' => 'failed']);

            $log->error('image-prompt generation failed', ['error' => $e->getMessage()]);

            $runs->finish($run, JobRun::STATUS_FAILED, error: $e->getMessage());

            throw $e;
        }
    }
}
