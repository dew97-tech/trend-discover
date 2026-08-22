<?php

namespace App\Jobs;

use App\Enums\ImageType;
use App\Models\ContentImage;
use App\Models\ContentPost;
use App\Models\JobRun;
use App\Repositories\Contracts\JobRunRepositoryInterface;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

/**
 * Runs snippet derivation in a worker (AI calls take 30–90s+ — far beyond
 * web-request limits). The ContentImage row is created as `pending` by the
 * controller before dispatch; this job fills it and flips status to ready.
 */
class SuggestSnippetJob implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $tries = 2;

    public array $backoff = [30];

    public int $timeout = 600;

    public function uniqueId(): string
    {
        return "snippet-{$this->postId}";
    }

    public function __construct(public readonly int $postId, public readonly bool $force = false) {}

    public function handle(\App\Services\AI\SnippetService $service, JobRunRepositoryInterface $runs): void
    {
        $run = $runs->start(static::class);
        $log = $runs->logger($run);

        $post = ContentPost::query()->find($this->postId);

        if ($post === null) {
            $log->warning('skipped — post no longer exists');
            $runs->finish($run, JobRun::STATUS_SUCCESS, meta: ['skipped' => 'post deleted']);

            return;
        }

        try {
            $log->info('suggesting snippet', [
                'post_id' => $post->id,
                'force' => $this->force,
            ]);

            $spec = $service->buildSpec($post);

            $image = ContentImage::query()->updateOrCreate(
                [
                    'content_post_id' => $this->postId,
                    'type' => ImageType::CodeSnippet->value,
                ],
                [
                    'status' => 'ready',
                    'spec' => $spec,
                    'generated_at' => now(),
                ],
            );

            $log->info('snippet ready', [
                'language' => $spec['language'],
                'title' => $spec['title'],
            ]);

            $runs->finish($run, JobRun::STATUS_SUCCESS, meta: [
                'image_id' => $image->id,
                'language' => $spec['language'],
            ]);
        } catch (Throwable $e) {
            ContentImage::query()
                ->where('content_post_id', $this->postId)
                ->where('type', ImageType::CodeSnippet->value)
                ->update(['status' => 'failed']);

            $log->error('snippet suggestion failed', ['error' => $e->getMessage()]);

            $runs->finish($run, JobRun::STATUS_FAILED, error: $e->getMessage());

            throw $e;
        }
    }
}
