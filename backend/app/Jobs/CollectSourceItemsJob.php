<?php

namespace App\Jobs;

use App\Domain\Trending\Collectors\CollectorFactory;
use App\Models\JobRun;
use App\Models\Source;
use App\Repositories\Contracts\JobRunRepositoryInterface;
use App\Repositories\Contracts\SourceItemRepositoryInterface;
use Illuminate\Bus\Batchable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Fetches one source.
 *
 * Not unique on purpose: the daily pipeline batches one job per source, and a
 * ShouldBeUnique job that is locked is silently dropped — which would leave
 * the batch pending forever. Duplicate runs are harmless (insertOrIgnore).
 */
class CollectSourceItemsJob implements ShouldQueue
{
    use Batchable, Queueable;

    public int $tries = 3;

    public array $backoff = [30, 120, 600];

    public int $timeout = 180;

    public function __construct(
        public readonly Source $source,
        /** Pipeline batches dispatch detection themselves after ALL sources finish. */
        public readonly bool $chainDetection = true,
    ) {}

    public function handle(
        CollectorFactory $factory,
        SourceItemRepositoryInterface $items,
        JobRunRepositoryInterface $runs,
    ): void {
        $run = $runs->start(static::class);
        $log = $runs->logger($run);

        try {
            $rawItems = $factory->make($this->source)->collect($this->source);

            $rows = $rawItems
                ->map(fn ($item) => $item->toRow($this->source->id))
                ->all();

            $inserted = $items->insertUniqueBatch($rows);

            $this->source->forceFill([
                'last_collected_at' => now(),
                'consecutive_failures' => 0,
            ])->save();

            $runs->finish($run, JobRun::STATUS_SUCCESS, meta: [
                'fetched' => count($rows),
                'inserted' => $inserted,
                'duplicates_skipped' => max(0, count($rows) - $inserted),
            ]);

            // Auto-chain: newly inserted items flow straight into
            // clustering + scoring. Pipeline batches disable this and trigger
            // detection once, after every source finished.
            if ($inserted > 0 && $this->chainDetection) {
                DetectTrendsJob::dispatch();
            }

            $log->info('collection finished', [
                'source' => $this->source->name,
                'fetched' => count($rows),
                'inserted' => $inserted,
            ]);
        } catch (Throwable $e) {
            $this->source->increment('consecutive_failures');

            $runs->finish($run, JobRun::STATUS_FAILED, error: $e->getMessage(), meta: [
                'source' => $this->source->name,
                'attempt' => $this->attempts(),
            ]);

            throw $e;
        }
    }

    public function failed(Throwable $exception): void
    {
        Log::channel('pipeline')->error('CollectSourceItemsJob permanently failed', [
            'source_id' => $this->source->id,
            'error' => $exception->getMessage(),
        ]);
    }
}
