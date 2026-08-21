<?php

namespace App\Jobs;

use App\Domain\Trending\Collectors\CollectorFactory;
use App\Models\JobRun;
use App\Models\Source;
use App\Repositories\Contracts\JobRunRepositoryInterface;
use App\Repositories\Contracts\SourceItemRepositoryInterface;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Throwable;

class CollectSourceItemsJob implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public array $backoff = [30, 120, 600];

    public int $timeout = 180;

    public function uniqueId(): string
    {
        return (string) $this->source->id;
    }

    public function __construct(public readonly Source $source) {}

    public function handle(
        CollectorFactory $factory,
        SourceItemRepositoryInterface $items,
        JobRunRepositoryInterface $runs,
    ): void {
        $run = $runs->start(static::class);

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

            Log::info('Collection finished', [
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
        Log::error('CollectSourceItemsJob permanently failed', [
            'source_id' => $this->source->id,
            'error' => $exception->getMessage(),
        ]);
    }
}
