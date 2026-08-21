<?php

namespace App\Jobs;

use App\Domain\Trending\Clustering\TrendClusterer;
use App\Models\JobRun;
use App\Repositories\Contracts\JobRunRepositoryInterface;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Collection;

class DetectTrendsJob implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $tries = 2;

    public array $backoff = [60];

    public function uniqueId(): string
    {
        return 'detect-trends';
    }

    public function uniqueFor(): int
    {
        return 600;
    }

    public function __construct() {}

    public function handle(TrendClusterer $clusterer, JobRunRepositoryInterface $runs): void
    {
        $run = $runs->start(static::class);

        try {
            /** @var Collection<int, int> $trendIds */
            $trendIds = $clusterer->cluster();

            // Score every touched trend — queued individually so one bad
            // trend can't block the rest.
            $trendIds->each(fn (int $id) => CalculateTrendScoreJob::dispatch($id));

            $runs->finish($run, JobRun::STATUS_SUCCESS, meta: [
                'trends_touched' => $trendIds->count(),
                'items_clustered' => \App\Models\SourceItem::query()
                    ->whereHas('trends')
                    ->where('created_at', '>=', now()->subDay())
                    ->count(),
            ]);
        } catch (\Throwable $e) {
            $runs->finish($run, JobRun::STATUS_FAILED, error: $e->getMessage());

            throw $e;
        }
    }
}
