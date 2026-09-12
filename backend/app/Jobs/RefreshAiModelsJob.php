<?php

namespace App\Jobs;

use App\Models\JobRun;
use App\Repositories\Contracts\JobRunRepositoryInterface;
use App\Services\AI\ModelCatalogService;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

/**
 * Re-discovers the best working cheap/fast models and refreshes
 * system_settings('ai.auto_models'). Dispatched from Settings ("Refresh now")
 * and automatically when the entire provider fallback chain fails.
 */
class RefreshAiModelsJob implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public int $timeout = 420;

    /** Collapse refresh storms into one run per hour. */
    public int $uniqueFor = 3600;

    public function uniqueId(): string
    {
        return 'ai-refresh-models';
    }

    public function handle(ModelCatalogService $catalog, JobRunRepositoryInterface $runs): void
    {
        $run = $runs->start(static::class);
        $log = $runs->logger($run);

        try {
            $log->info('refreshing model catalog', [
                'roster' => count($catalog->roster()),
            ]);

            $chosen = $catalog->refreshBest();

            $log->info('model catalog refreshed', [
                'chosen' => array_column($chosen, 'id'),
            ]);

            $runs->finish($run, JobRun::STATUS_SUCCESS, meta: [
                'chosen' => array_column($chosen, 'id'),
            ]);
        } catch (Throwable $e) {
            $log->error('model catalog refresh failed', ['error' => $e->getMessage()]);

            $runs->finish($run, JobRun::STATUS_FAILED, error: $e->getMessage());

            throw $e;
        }
    }
}
