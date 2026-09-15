<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\JobRunResource;
use App\Models\JobRun;
use App\Repositories\Contracts\JobRunRepositoryInterface;
use App\Support\RunLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class JobRunController extends Controller
{
    public function __construct(private readonly JobRunRepositoryInterface $jobRuns) {}

    public function index(): AnonymousResourceCollection
    {
        return JobRunResource::collection(
            $this->jobRuns->latest(50),
        );
    }

    /**
     * Returns the log lines belonging to ONE run.
     * Scans that job's per-job daily files (today + yesterday included by
     * the glob) plus legacy pipeline files for pre-migration runs.
     */
    public function log(int $id): JsonResponse
    {
        $run = JobRun::query()->find($id);
        abort_unless($run !== null, 404);

        $marker = "run={$id}]";
        $lines = [];

        foreach ($this->logFiles($run) as $file) {
            $handle = fopen($file, 'r');

            if ($handle === false) {
                continue;
            }

            while (($line = fgets($handle)) !== false) {
                if (str_contains($line, $marker)) {
                    $lines[] = rtrim($line);
                }
            }

            fclose($handle);
        }

        return response()->json([
            'data' => [
                'run_id' => $run->id,
                'job_class' => $run->job_class,
                'status' => $run->status,
                'lines' => array_slice($lines, -100),
            ],
        ]);
    }

    /**
     * @return list<string> absolute paths, oldest first
     */
    private function logFiles(JobRun $run): array
    {
        $dir = storage_path('logs');

        $files = [];

        // Per-job daily files, e.g. collect-source-items-2026-09-13.log
        foreach (glob($this->jobDirectory().'/'.RunLogger::fileStem($run->job_class).'-*.log') ?: [] as $file) {
            $files[] = $file;
        }

        // Legacy single pipeline channel keeps old runs readable.
        foreach (glob($dir.'/pipeline-*.log') ?: [] as $file) {
            $files[] = $file;
        }

        // Include the plain name for non-daily fallback configurations.
        if (is_file($dir.'/pipeline.log')) {
            $files[] = $dir.'/pipeline.log';
        }

        $files = array_values(array_unique($files));
        sort($files);

        return $files;
    }

    private function jobDirectory(): string
    {
        $config = (array) config('logging.jobs', []);
        $relative = trim((string) ($config['path'] ?? 'logs/jobs'), '/');

        return storage_path($relative);
    }
}
