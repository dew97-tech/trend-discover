<?php

namespace App\Console\Commands;

use App\Enums\SourceType;
use App\Jobs\CollectSourceItemsJob;
use App\Models\Source;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class CollectTrendsCommand extends Command
{
    protected $signature = 'trends:collect {target? : Optional source type (hn|github|devto|rss|lobsters) or source name (e.g. youtube)}';

    protected $description = 'Dispatch collection jobs for all enabled trend sources';

    public function handle(): int
    {
        $target = $this->argument('target');

        $query = Source::query()->enabled();

        if ($target !== null) {
            $type = SourceType::tryFrom($target);

            // Types select every source of that kind (rss covers both the
            // engineering feeds and the YouTube channel feeds); a name that
            // is not a type selects exactly one source.
            if ($type !== null) {
                $query->where('type', $type);
            } else {
                $query->where('name', $target);
            }
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
