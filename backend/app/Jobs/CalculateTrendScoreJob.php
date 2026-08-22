<?php

namespace App\Jobs;

use App\Domain\Trending\Scoring\ScoreEngine;
use App\Models\JobRun;
use App\Models\Trend;
use App\Repositories\Contracts\JobRunRepositoryInterface;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class CalculateTrendScoreJob implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $tries = 2;

    public array $backoff = [30];

    public function uniqueId(): string
    {
        return 'score-trend-'.$this->trendId;
    }

    public function uniqueFor(): int
    {
        return 300;
    }

    public function __construct(public readonly int $trendId) {}

    public function handle(ScoreEngine $engine, JobRunRepositoryInterface $runs): void
    {
        $run = $runs->start(static::class);
        $log = $runs->logger($run);

        try {
            $trend = Trend::query()->find($this->trendId);

            if ($trend === null) {
                $log->warning('skipped — trend no longer exists');
                $runs->finish($run, JobRun::STATUS_SUCCESS, meta: ['skipped' => 'trend deleted']);

                return;
            }

            $log->info('scoring trend', [
                'title' => (string) str($trend->title)->limit(80),
                'item_count' => $trend->item_count,
            ]);

            $scores = $engine->score($trend);

            $log->info('scored', [
                'trend_score' => $scores['trend_score'],
                'novelty' => $scores['novelty_score'],
                'saturation' => $scores['saturation_score'],
                'freshness' => $scores['freshness_score'],
                'momentum' => $scores['momentum_score'],
            ]);

            $runs->finish($run, JobRun::STATUS_SUCCESS, meta: [
                'trend_id' => $trend->id,
                'trend_score' => $scores['trend_score'],
                'saturation' => $scores['saturation_score'],
            ]);
        } catch (\Throwable $e) {
            $log->error('scoring threw', ['error' => $e->getMessage()]);

            $runs->finish($run, JobRun::STATUS_FAILED, error: $e->getMessage());

            throw $e;
        }
    }
}
