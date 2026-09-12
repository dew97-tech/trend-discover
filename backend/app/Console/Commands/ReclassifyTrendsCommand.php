<?php

namespace App\Console\Commands;

use App\Domain\Trending\Clustering\TechnologyClassifier;
use App\Jobs\CalculateTrendScoreJob;
use App\Models\Trend;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class ReclassifyTrendsCommand extends Command
{
    protected $signature = 'trends:reclassify {--dry-run : Report what would change without writing}';

    protected $description = 'Re-run word-boundary technology/category matching on existing trends and queue re-scoring';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $classifier = new TechnologyClassifier();

        $processed = 0;
        $changed = 0;

        Trend::query()
            ->with('technologies:id')
            ->chunkById(100, function ($trends) use ($classifier, $dryRun, &$processed, &$changed) {
                foreach ($trends as $trend) {
                    $processed++;

                    [$categoryId, $technologyIds] = $classifier->classify(
                        $trend->title.' '.($trend->summary ?? ''),
                    );

                    $current = $trend->technologies->pluck('id')->sort()->values()->all();
                    $next = collect($technologyIds)->sort()->values()->all();

                    if ($current === $next && $categoryId === $trend->category_id) {
                        continue;
                    }

                    $changed++;

                    if ($dryRun) {
                        continue;
                    }

                    $trend->technologies()->sync($technologyIds);

                    // Null when nothing matches — a fresh cluster would also
                    // have no category, so stale substring matches must clear.
                    $trend->category_id = $categoryId;

                    $trend->save();

                    CalculateTrendScoreJob::dispatch($trend->id);
                }
            });

        Log::channel('pipeline')->info('[trends:reclassify] finished', [
            'processed' => $processed,
            'changed' => $changed,
            'dry_run' => $dryRun,
        ]);

        $this->info(sprintf(
            '%s %d trends (%d changed).%s',
            $dryRun ? 'Would reclassify' : 'Reclassified',
            $processed,
            $changed,
            $dryRun ? '' : ' Re-scoring jobs queued.',
        ));

        return self::SUCCESS;
    }
}
