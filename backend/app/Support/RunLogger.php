<?php

namespace App\Support;

use Illuminate\Support\Facades\Log;

/**
 * Structured logger bound to a specific job_run id.
 * Every line lands in the 'pipeline' channel tagged with run={id} so the
 * Jobs screen can show exactly what happened inside one execution.
 */
final class RunLogger
{
    public function __construct(
        private readonly int $runId,
        private readonly string $job,
    ) {}

    public function info(string $message, array $context = []): void
    {
        $this->write('info', $message, $context);
    }

    public function warning(string $message, array $context = []): void
    {
        $this->write('warning', $message, $context);
    }

    public function error(string $message, array $context = []): void
    {
        $this->write('error', $message, $context);
    }

    private function write(string $level, string $message, array $context): void
    {
        Log::channel('pipeline')->{$level}(
            "[{$this->job} run={$this->runId}] {$message}",
            $context,
        );
    }
}
