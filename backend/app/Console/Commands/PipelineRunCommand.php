<?php

namespace App\Console\Commands;

use App\Jobs\CleanupOldTrendsJob;
use App\Jobs\CollectSourceItemsJob;
use App\Jobs\DetectTrendsJob;
use App\Models\Source;
use Illuminate\Bus\Batch;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * The whole daily workflow in one command:
 *
 *   fetch every enabled source in parallel
 *     → after ALL of them finish: find/group new trends + score them
 *       → cleanup stale trends
 *
 * Only `schedule:work` and `queue:work` need to run for this to happen every
 * day; each job keeps its own per-job log.
 */
class PipelineRunCommand extends Command
{
    protected $signature = 'pipeline:run {--dry-run : Show the sources that would be fetched}';

    protected $description = 'Run the full daily pipeline (fetch → find trends → score → cleanup)';

    public function handle(): int
    {
        $sources = Source::query()->enabled()->orderBy('name')->get();

        if ($sources->isEmpty()) {
            $this->warn('No enabled sources — enable at least one in Settings.');

            return self::SUCCESS;
        }

        if ($this->option('dry-run')) {
            $this->info('Dry run — would fetch '.$sources->count().' source(s):');

            foreach ($sources as $source) {
                $this->line("  • {$source->name} ({$source->type->value})");
            }

            $this->line('Then: find trends → score → cleanup stale trends.');

            return self::SUCCESS;
        }

        /** @var array<int, CollectSourceItemsJob> $jobs */
        $jobs = $sources
            ->map(fn (Source $source) => new CollectSourceItemsJob($source, chainDetection: false))
            ->all();

        Bus::batch($jobs)
            ->name('daily-pipeline')
            ->allowFailures()
            ->then(function (Batch $batch): void {
                DetectTrendsJob::dispatch();

                Log::channel('pipeline')->info('[pipeline:run] sources finished — detection queued', [
                    'batch_id' => $batch->id,
                    'sources' => $batch->totalJobs,
                    'failed' => $batch->failedJobs,
                ]);
            })
            ->catch(function (Batch $batch, Throwable $e): void {
                Log::channel('pipeline')->error('[pipeline:run] batch error', [
                    'batch_id' => $batch->id,
                    'error' => $e->getMessage(),
                ]);
            })
            ->dispatch();

        $this->info("Pipeline started — {$sources->count()} source(s) queued.");
        $this->line('Detection runs after all sources finish, then scoring and cleanup.');
        $this->line('Watch progress in Automation (or `php artisan queue:work`).');

        return self::SUCCESS;
    }
}
