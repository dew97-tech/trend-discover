<?php

namespace App\Console\Commands;

use App\Jobs\CleanupOldTrendsJob;
use App\Services\TrendCleanupService;
use Illuminate\Console\Command;

class CleanupTrendsCommand extends Command
{
    protected $signature = 'trends:cleanup
        {--days= : Age threshold in days (defaults to config trending.cleanup.days)}
        {--dry-run : Only report what would be hidden}
        {--queue : Run as the queued pipeline step instead of inline}';

    protected $description = 'Soft-delete trends with no activity for N days (posts stay intact)';

    public function handle(TrendCleanupService $cleanup): int
    {
        $days = (int) ($this->option('days') ?? config('trending.cleanup.days', 2));

        if ($this->option('queue')) {
            CleanupOldTrendsJob::dispatch();

            $this->info('Cleanup job queued.');

            return self::SUCCESS;
        }

        $count = $cleanup->staleCount($days);

        if ($this->option('dry-run')) {
            $this->info("Dry run: {$count} trend(s) older than {$days} day(s) would be hidden.");

            $this->stalePreview($cleanup, $days);

            return self::SUCCESS;
        }

        $removed = $cleanup->cleanup($days);

        $this->info("Removed {$removed} trend(s) with no activity for {$days}+ day(s).");
        $this->line('Posts were preserved — restore any trend with POST /api/trends/{id}/restore.');

        return self::SUCCESS;
    }

    private function stalePreview(TrendCleanupService $cleanup, int $days): void
    {
        $titles = $cleanup->staleQuery(now()->subDays($days))
            ->orderBy('id')
            ->limit(10)
            ->pluck('title');

        foreach ($titles as $title) {
            $this->line('  • '.(string) str($title)->limit(70));
        }

        if ($titles->count() === 10) {
            $this->line('  … and more');
        }
    }
}
