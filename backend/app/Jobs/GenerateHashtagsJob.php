<?php

namespace App\Jobs;

use App\Models\ContentPost;
use App\Models\JobRun;
use App\Repositories\Contracts\JobRunRepositoryInterface;
use App\Services\AI\HashtagService;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

/**
 * On-demand hashtag generation for one post (AI calls are worker-only).
 * Used by the editor's "Suggest hashtags" and the backfill command.
 */
class GenerateHashtagsJob implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $tries = 2;

    public array $backoff = [30];

    public int $timeout = 600;

    public function uniqueId(): string
    {
        return "hashtags-{$this->postId}";
    }

    public function __construct(public readonly int $postId) {}

    public function handle(HashtagService $service, JobRunRepositoryInterface $runs): void
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
            $tags = $service->generate($post);

            $post->forceFill(['hashtags' => $tags === [] ? null : $tags])->save();

            $log->info('hashtags ready', ['count' => count($tags), 'tags' => $tags]);

            $runs->finish($run, JobRun::STATUS_SUCCESS, meta: [
                'post_id' => $post->id,
                'count' => count($tags),
            ]);
        } catch (Throwable $e) {
            $log->error('hashtag generation failed', ['error' => $e->getMessage()]);

            $runs->finish($run, JobRun::STATUS_FAILED, error: $e->getMessage());

            throw $e;
        }
    }
}
