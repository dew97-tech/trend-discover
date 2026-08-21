<?php

namespace App\Console\Commands;

use App\Jobs\CalculateTrendScoreJob;
use App\Models\Trend;
use Illuminate\Console\Command;

class ScoreTrendsCommand extends Command
{
    protected $signature = 'trends:score {--trend= : Score a single trend ID}';

    protected $description = 'Queue scoring for one trend, all active trends, or stale trends';

    public function handle(): int
    {
        $trendId = $this->option('trend');

        if ($trendId !== null) {
            CalculateTrendScoreJob::dispatch((int) $trendId);
            $this->info("Scoring queued for trend #{$trendId}.");

            return self::SUCCESS;
        }

        $count = Trend::query()->active()->count();

        Trend::query()
            ->active()
            ->pluck('id')
            ->each(fn (int $id) => CalculateTrendScoreJob::dispatch($id));

        $this->info("Scoring queued for {$count} active trends.");

        return self::SUCCESS;
    }
}
