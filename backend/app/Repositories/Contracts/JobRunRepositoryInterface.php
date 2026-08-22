<?php

namespace App\Repositories\Contracts;

use App\Models\JobRun;
use Illuminate\Support\Collection;

interface JobRunRepositoryInterface
{
    public function start(string $jobClass, ?string $jobId = null, ?string $batchId = null): JobRun;

    public function logger(JobRun $run): \App\Support\RunLogger;

    public function finish(JobRun $run, string $status, ?string $error = null, array $meta = []): JobRun;

    public function latest(int $limit = 50): Collection;

    public function failureCountSince(int $hours = 24): int;
}
