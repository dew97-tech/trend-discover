<?php

namespace App\Repositories\Eloquent;

use App\Models\JobRun;
use App\Repositories\Contracts\JobRunRepositoryInterface;
use Illuminate\Support\Collection;

class JobRunRepository implements JobRunRepositoryInterface
{
    public function start(string $jobClass, ?string $jobId = null, ?string $batchId = null): JobRun
    {
        return JobRun::query()->create([
            'job_class' => $jobClass,
            'job_id' => $jobId,
            'batch_id' => $batchId,
            'status' => JobRun::STATUS_RUNNING,
            'attempts' => 1,
            'started_at' => now(),
        ]);
    }

    public function finish(JobRun $run, string $status, ?string $error = null, array $meta = []): JobRun
    {
        $run->forceFill([
            'status' => $status,
            'finished_at' => now(),
            'duration_ms' => (int) max(0, (now()->getTimestampMs() - $run->started_at->getTimestampMs())),
            'error' => $error,
            'meta' => $meta ?: $run->meta,
        ])->save();

        return $run;
    }

    public function latest(int $limit = 50): Collection
    {
        return JobRun::query()
            ->orderByDesc('started_at')
            ->orderByDesc('id')
            ->limit($limit)
            ->get();
    }

    public function failureCountSince(int $hours = 24): int
    {
        return JobRun::query()
            ->where('status', JobRun::STATUS_FAILED)
            ->where('started_at', '>=', now()->subHours($hours))
            ->count();
    }
}
