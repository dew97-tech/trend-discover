<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\JobRunResource;
use App\Models\JobRun;
use App\Repositories\Contracts\JobRunRepositoryInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Storage;

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
     * Returns the pipeline-log lines belonging to ONE run.
     * Scans today's + yesterday's daily pipeline files, newest last.
     */
    public function log(int $id): JsonResponse
    {
        $run = JobRun::query()->find($id);
        abort_unless($run !== null, 404);

        $marker = "run={$id}]";
        $lines = [];

        foreach ($this->pipelineFiles() as $file) {
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
    private function pipelineFiles(): array
    {
        $dir = storage_path('logs');

        $files = glob($dir.'/pipeline-*.log') ?: [];
        sort($files);

        // Include the plain name for non-daily fallback configurations.
        if (is_file($dir.'/pipeline.log')) {
            $files[] = $dir.'/pipeline.log';
        }

        return $files;
    }
}
