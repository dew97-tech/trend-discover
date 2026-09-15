<?php

namespace App\Services;

use App\Models\Trend;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Keeps the trend list bounded: soft-deletes trends with no recent activity.
 *
 * Soft delete only — generated posts stay in the library and the trend can be
 * restored. Source items are detached first so they are free to re-cluster
 * into fresh trends (same contract as the manual delete endpoint).
 */
class TrendCleanupService
{
    /**
     * Trends whose last activity (or creation, when never re-seen) is before
     * the cutoff.
     */
    public function staleQuery(CarbonInterface $cutoff): Builder
    {
        return Trend::query()->where(function (Builder $query) use ($cutoff): void {
            $query->where('last_seen_at', '<=', $cutoff)
                ->orWhere(function (Builder $query) use ($cutoff): void {
                    $query->whereNull('last_seen_at')
                        ->where('created_at', '<=', $cutoff);
                });
        });
    }

    public function staleCount(int $days): int
    {
        return $this->staleQuery(now()->subDays($days))->count();
    }

    /**
     * @return int number of trends removed
     */
    public function cleanup(int $days): int
    {
        $removed = 0;

        $this->staleQuery(now()->subDays($days))
            ->chunkById(100, function ($trends) use (&$removed): void {
                foreach ($trends as $trend) {
                    DB::transaction(function () use ($trend): void {
                        $trend->sourceItems()->detach();
                        $trend->delete();
                    });

                    $removed++;
                }
            });

        return $removed;
    }
}
