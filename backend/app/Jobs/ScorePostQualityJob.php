<?php

namespace App\Jobs;

use App\Models\ContentPost;
use App\Models\JobRun;
use App\Repositories\Contracts\JobRunRepositoryInterface;
use App\Services\AI\PostGenerationService;
use App\Services\AI\QualityGateService;
use App\Services\AI\ResearchService;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

/**
 * Re-runs the quality gate after a content change (applied revision or manual
 * edit) so the displayed score matches the text. Status is never changed
 * here — only the score/breakdown, which are informational.
 */
class ScorePostQualityJob implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $tries = 2;

    public array $backoff = [30];

    public int $timeout = 600;

    public function uniqueId(): string
    {
        return "quality-{$this->postId}";
    }

    public function __construct(public readonly int $postId) {}

    public function handle(
        QualityGateService $gate,
        ResearchService $research,
        JobRunRepositoryInterface $runs,
    ): void {
        $run = $runs->start(static::class);
        $log = $runs->logger($run);

        $post = ContentPost::query()->find($this->postId);

        if ($post === null) {
            $log->warning('skipped — post no longer exists');
            $runs->finish($run, JobRun::STATUS_SUCCESS, meta: ['skipped' => 'post deleted']);

            return;
        }

        $trend = $post->trend()->withTrashed()->first();

        if ($trend === null) {
            $log->warning('skipped — trend no longer exists');
            $runs->finish($run, JobRun::STATUS_SUCCESS, meta: ['skipped' => 'trend missing']);

            return;
        }

        if (PostGenerationService::dailyBudgetRemaining() <= 0) {
            $log->warning('skipped — daily AI call budget exhausted');
            $runs->finish($run, JobRun::STATUS_SUCCESS, meta: ['skipped' => 'budget exhausted']);

            return;
        }

        try {
            $researchData = $research->getOrGenerate($trend)['research'] ?? [];
            $verdict = $gate->evaluate($post, $researchData);

            $post->forceFill([
                'quality_score' => $verdict['total'],
                'quality_breakdown' => [
                    'dimensions' => $verdict['breakdown'],
                    'issues' => $verdict['issues'],
                ],
            ])->save();

            $log->info('quality re-checked', [
                'post_id' => $post->id,
                'score' => $verdict['total'],
                'would_route_to' => $verdict['status']->value,
                'issues' => count($verdict['issues']),
            ]);

            $runs->finish($run, JobRun::STATUS_SUCCESS, meta: [
                'post_id' => $post->id,
                'quality' => $verdict['total'],
                'would_route_to' => $verdict['status']->value,
            ]);
        } catch (Throwable $e) {
            $log->error('quality re-check failed', ['error' => $e->getMessage()]);

            $runs->finish($run, JobRun::STATUS_FAILED, error: $e->getMessage());

            throw $e;
        }
    }
}
