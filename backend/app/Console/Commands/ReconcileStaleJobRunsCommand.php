<?php

namespace App\Console\Commands;

use App\Models\JobRun;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class ReconcileStaleJobRunsCommand extends Command
{
    protected $signature = 'jobs:reconcile-stale {--hours=2 : Age threshold in hours}';

    protected $description = 'Mark stuck running job rows as failed (worker died before completing)';

    public function handle(): int
    {
        $hours = (int) $this->option('hours');

        $stale = JobRun::query()
            ->where('status', JobRun::STATUS_RUNNING)
            ->where('started_at', '<', now()->subHours($hours))
            ->get();

        foreach ($stale as $run) {
            $run->forceFill([
                'status' => JobRun::STATUS_FAILED,
                'finished_at' => now(),
                'duration_ms' => $run->started_at
                    ? (int) max(0, now()->getTimestampMs() - $run->started_at->getTimestampMs())
                    : null,
                'error' => "Worker terminated before completion — reconciled after {$hours}h in running state.",
            ])->save();

            Log::channel('pipeline')->warning(
                "[Reconcile run={$run->id}] marked failed — was stale since {$run->started_at}",
                ['job_class' => $run->job_class],
            );

            $this->warn("Reconciled run #{$run->id} ({$run->job_class}).");
        }

        if ($stale->isEmpty()) {
            $this->info('No stale runs found.');
        }

        return self::SUCCESS;
    }
}
