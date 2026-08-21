<?php

namespace App\Console\Commands;

use App\Enums\SourceType;
use App\Jobs\CollectSourceItemsJob;
use App\Models\Source;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class CollectTrendsCommand extends Command
{
    protected $signature = 'trends:collect {type? : Optional source type filter (hn|github|reddit|devto|rss)}';

    protected $description = 'Dispatch collection jobs for all enabled trend sources';

    public function handle(): int
    {
        $typeFilter = $this->argument('type');

        $query = Source::query()->enabled();

        if ($typeFilter !== null) {
            $query->where('type', SourceType::from($typeFilter));
        }

        $sources = $query->get();

        if ($sources->isEmpty()) {
            $this->warn('No enabled sources matched.');

            return self::SUCCESS;
        }

        foreach ($sources as $source) {
            CollectSourceItemsJob::dispatch($source);
            $this->info("Dispatched collection for [{$source->name}].");
        }

        Log::info('trends:collect dispatched', ['sources' => $sources->count()]);

        return self::SUCCESS;
    }
}
