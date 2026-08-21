<?php

namespace App\Jobs;

use App\Enums\PostStatus;
use App\Models\ContentPost;
use App\Models\JobRun;
use App\Models\SystemSetting;
use App\Models\Trend;
use App\Repositories\Contracts\JobRunRepositoryInterface;
use App\Services\AI\PostGenerationService;
use App\Services\AI\PostSpec;
use App\Services\AI\QualityGateService;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class GeneratePostJob implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $tries = 2;

    public array $backoff = [30];

    public int $timeout = 300;

    public function uniqueId(): string
    {
        return "generate-{$this->trendId}-{$this->spec->fingerprint()}";
    }

    public function __construct(
        public readonly int $trendId,
        public readonly PostSpec $spec,
        public readonly bool $force = false,
    ) {}

    public function handle(
        PostGenerationService $generation,
        QualityGateService $gate,
        JobRunRepositoryInterface $runs,
    ): void {
        $run = $runs->start(static::class);

        $trend = Trend::query()->find($this->trendId);

        if ($trend === null) {
            $runs->finish($run, JobRun::STATUS_SUCCESS, meta: ['skipped' => 'trend deleted']);

            return;
        }

        try {
            if (! $this->force && $generation->limitReached($trend)) {
                $runs->finish($run, JobRun::STATUS_FAILED, error: 'Generation limit reached for this trend.');

                return;
            }

            if (PostGenerationService::dailyBudgetRemaining() <= 0) {
                $runs->finish($run, JobRun::STATUS_FAILED, error: 'Daily AI call budget exhausted.');

                return;
            }

            $trend->forceFill(['status' => 'researching'])->save();

            ['post' => $post] = $generation->generate($trend, $this->spec, $this->force);

            // Research used for the post is reused as the judge's ground truth.
            ['research' => $research] = app(\App\Services\AI\ResearchService::class)->getOrGenerate($trend);

            $verdict = $gate->evaluate($post, $research);

            $post->forceFill([
                'status' => $verdict['status'],
                'quality_score' => $verdict['total'],
                'quality_breakdown' => [
                    'dimensions' => $verdict['breakdown'],
                    'issues' => $verdict['issues'],
                ],
            ])->save();

            $trend->forceFill(['status' => 'researched', 'researched_at' => now()])->save();

            $runs->finish($run, JobRun::STATUS_SUCCESS, meta: [
                'post_id' => $post->id,
                'quality' => $verdict['total'],
                'routed_to' => $verdict['status']->value,
            ]);
        } catch (\Throwable $e) {
            $trend?->forceFill(['status' => 'researched'])->save();

            $runs->finish($run, JobRun::STATUS_FAILED, error: $e->getMessage());

            throw $e;
        }
    }
}
