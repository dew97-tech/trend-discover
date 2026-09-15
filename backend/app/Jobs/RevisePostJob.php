<?php

namespace App\Jobs;

use App\Models\JobRun;
use App\Models\PostRevision;
use App\Repositories\Contracts\JobRunRepositoryInterface;
use App\Services\AI\PostGenerationService;
use App\Services\AI\RevisionService;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

/**
 * Produces one AI revision proposal for a post. The proposal is stored on the
 * revision row — the post itself is only touched when the author applies it.
 */
class RevisePostJob implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $tries = 2;

    public array $backoff = [30];

    public int $timeout = 600;

    public function uniqueId(): string
    {
        return "revision-{$this->revisionId}";
    }

    public function __construct(public readonly int $revisionId) {}

    public function handle(RevisionService $service, JobRunRepositoryInterface $runs): void
    {
        $run = $runs->start(static::class);
        $log = $runs->logger($run);

        $revision = PostRevision::query()->find($this->revisionId);

        if ($revision === null) {
            $log->warning('skipped — revision no longer exists');
            $runs->finish($run, JobRun::STATUS_SUCCESS, meta: ['skipped' => 'revision deleted']);

            return;
        }

        if ($revision->status !== PostRevision::STATUS_PENDING) {
            $log->info('skipped — revision already '.$revision->status);
            $runs->finish($run, JobRun::STATUS_SUCCESS, meta: ['skipped' => $revision->status]);

            return;
        }

        if (PostGenerationService::dailyBudgetRemaining() <= 0) {
            $revision->forceFill([
                'status' => PostRevision::STATUS_FAILED,
                'error' => 'Daily AI call budget exhausted — try again tomorrow.',
            ])->save();

            $log->error('blocked — daily AI call budget exhausted');
            $runs->finish($run, JobRun::STATUS_FAILED, error: 'Daily AI call budget exhausted.');

            return;
        }

        try {
            $result = $service->revise($revision);

            $revision->forceFill([
                'hook_after' => $result['hook'],
                'body_after' => $result['body'],
                'notes' => $result['notes'],
                'status' => PostRevision::STATUS_READY,
                'error' => null,
            ])->save();

            $log->info('revision ready', [
                'post_id' => $revision->content_post_id,
                'target' => $revision->target,
                'chars_before' => mb_strlen((string) $revision->body_before),
                'chars_after' => $result['body'] !== null ? mb_strlen($result['body']) : null,
                'hook_chars' => $result['hook'] !== null ? mb_strlen($result['hook']) : null,
            ]);

            $runs->finish($run, JobRun::STATUS_SUCCESS, meta: [
                'revision_id' => $revision->id,
                'post_id' => $revision->content_post_id,
                'target' => $revision->target,
            ]);
        } catch (Throwable $e) {
            $revision->forceFill([
                'status' => PostRevision::STATUS_FAILED,
                'error' => (string) str($e->getMessage())->limit(500),
            ])->save();

            $log->error('revision failed', ['error' => $e->getMessage(), 'attempt' => $this->attempts()]);

            $runs->finish($run, JobRun::STATUS_FAILED, error: $e->getMessage());

            throw $e;
        }
    }
}
