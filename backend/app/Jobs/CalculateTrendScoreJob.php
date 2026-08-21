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

        try {
            $trend = Trend::query()->find($this->trendId);

            if ($trend === null) {
                $runs->finish($run, JobRun::STATUS_SUCCESS, meta: ['skipped' => 'trend deleted']);

                return;
            }

            $scores = $engine->score($trend);

            $runs->finish($run, JobRun::STATUS_SUCCESS, meta: [
                'trend_id' => $trend->id,
                'trend_score' => $scores['trend_score'],
                'saturation' => $scores['saturation_score'],
            ]);
        } catch (\Throwable $e) {
            $runs->finish($run, JobRun::STATUS_FAILED, error: $e->getMessage());

            throw $e;
        }
    }
}
