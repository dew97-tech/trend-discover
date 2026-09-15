<?php

namespace App\Support;

use Illuminate\Support\Facades\Log;
use Psr\Log\LoggerInterface;

/**
 * Structured logger bound to a specific job_run id.
 *
 * Every line lands in a per-job daily file:
 *   storage/logs/jobs/{job-kebab}-YYYY-MM-DD.log
 *
 * The line prefix keeps the [JobName run={id}] marker so the Jobs screen
 * can still filter one execution out of the daily file. Jobs without a
 * name (hand-built loggers) fall back to the legacy 'pipeline' channel.
 */
final class RunLogger
{
    /** @var array<string, LoggerInterface> */
    private static array $loggers = [];

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

    /**
     * Job/command class (FQCN or basename) → log-file stem:
     * App\Jobs\CollectSourceItemsJob and CollectSourceItemsJob → collect-source-items.
     */
    public static function fileStem(string $job): string
    {
        $base = class_basename($job);
        $base = (string) str($base)->replaceMatches('/Job$/', '');
        $kebab = (string) str($base)->replaceMatches('/([a-z0-9])([A-Z])/', '$1-$2')->lower();

        return trim($kebab, '-');
    }

    private function write(string $level, string $message, array $context): void
    {
        $logger = $this->logger();

        $logger->{$level}(
            $this->job !== ''
                ? "[{$this->job} run={$this->runId}] {$message}"
                : "[run={$this->runId}] {$message}",
            $context,
        );
    }

    /**
     * Resolve (and memoize) the daily logger for this job.
     */
    private function logger(): LoggerInterface
    {
        if ($this->job === '') {
            return Log::channel('pipeline');
        }

        $channel = 'job.'.$this->job;

        return self::$loggers[$channel] ??= Log::build(
            $this->channelConfig($this->job),
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function channelConfig(string $job): array
    {
        $config = (array) config('logging.jobs', []);

        return [
            'name' => 'job.'.$job,
            'driver' => $config['driver'] ?? 'daily',
            'path' => storage_path(
                rtrim($config['path'] ?? 'logs/jobs', '/')
                .'/'.self::fileStem($job).'.log'
            ),
            'level' => $config['level'] ?? env('LOG_LEVEL', 'debug'),
            'max_files' => (int) ($config['max_files'] ?? 30),
            'replace_placeholders' => true,
        ];
    }
}
