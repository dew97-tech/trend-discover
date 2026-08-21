<?php

namespace App\Console\Commands;

use App\Jobs\DetectTrendsJob;
use Illuminate\Console\Command;

class DetectTrendsCommand extends Command
{
    protected $signature = 'trends:detect';

    protected $description = 'Cluster ungrouped source items into trends and queue scoring';

    public function handle(): int
    {
        DetectTrendsJob::dispatch();

        $this->info('Trend detection queued.');

        return self::SUCCESS;
    }
}
