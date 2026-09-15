<?php

namespace App\Jobs;

use App\Models\JobRun;
use App\Repositories\Contracts\JobRunRepositoryInterface;
use App\Services\TrendCleanupService;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

/**
 * Final step of the daily pipeline: hides trends with no activity for
 * (config) trending.cleanup.days. Soft delete only — posts survive and every
 * trend can be restored.
 */
class CleanupOldTrendsJob implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $tries = 2;

    public array $backoff = [60];

    public int $timeout = 300;

    public function uniqueId(): string
    {
        return 'cleanup-old-trends';
    }

    public function uniqueFor(): int
    {
        return 3600;
    }

    public function handle(TrendCleanupService $cleanup, JobRunRepositoryInterface $runs): void
    {
        $run = $runs->start(static::class);
        $log = $runs->logger($run);

        $days = (int) config('trending.cleanup.days', 2);

        try {
            $log->info('cleanup started', ['older_than_days' => $days]);

            $removed = $cleanup->cleanup($days);

            $log->info('cleanup finished', ['removed' => $removed, 'older_than_days' => $days]);

            $runs->finish($run, JobRun::STATUS_SUCCESS, meta: [
                'removed' => $removed,
                'older_than_days' => $days,
            ]);
        } catch (Throwable $e) {
            $log->error('cleanup failed', ['error' => $e->getMessage()]);

            $runs->finish($run, JobRun::STATUS_FAILED, error: $e->getMessage());

            throw $e;
        }
    }
}
