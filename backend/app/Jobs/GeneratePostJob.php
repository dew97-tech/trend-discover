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

    // 3 attempts across ~4 minutes: rides out transient gateway incidents
    // (free-tier models occasionally return 500s for minutes at a time).
    public int $tries = 3;

    public array $backoff = [60, 180];

    public int $timeout = 600;

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
        $log = $runs->logger($run);

        $trend = Trend::query()->find($this->trendId);

        if ($trend === null) {
            $log->warning('skipped — trend no longer exists');
            $runs->finish($run, JobRun::STATUS_SUCCESS, meta: ['skipped' => 'trend deleted']);

            return;
        }

        try {
            if (! $this->force && $generation->limitReached($trend)) {
                $log->error('blocked — generation limit reached for this trend');
                $runs->finish($run, JobRun::STATUS_FAILED, error: 'Generation limit reached for this trend.');

                return;
            }

            if (PostGenerationService::dailyBudgetRemaining() <= 0) {
                $log->error('blocked — daily AI call budget exhausted');
                $runs->finish($run, JobRun::STATUS_FAILED, error: 'Daily AI call budget exhausted.');

                return;
            }

            $log->info('generating post', [
                'trend' => (string) str($trend->title)->limit(80),
                'format' => $this->spec->format,
                'tone' => $this->spec->tone,
                'angle' => $this->spec->angle,
                'force' => $this->force,
            ]);

            $trend->forceFill(['status' => 'researching'])->save();
            $log->info('researching trend signals…');

            ['post' => $post, 'cached' => $cached] = $generation->generate($trend, $this->spec, $this->force);
            $log->info($cached ? 'post generated (cached research reused)' : 'post generated', [
                'post_id' => $post->id,
                'hook' => (string) str((string) $post->hook)->limit(80),
            ]);

            // Research used for the post is reused as the judge's ground truth.
            ['research' => $research] = app(\App\Services\AI\ResearchService::class)->getOrGenerate($trend);

            $log->info('running quality gate…');

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

            $log->info('quality verdict', [
                'score' => $verdict['total'],
                'routed_to' => $verdict['status']->value,
                'rule_violations' => $verdict['breakdown']['rule_violations'] ?? 0,
                'issues' => count($verdict['issues']),
            ]);

            $runs->finish($run, JobRun::STATUS_SUCCESS, meta: [
                'post_id' => $post->id,
                'quality' => $verdict['total'],
                'routed_to' => $verdict['status']->value,
            ]);
        } catch (\Throwable $e) {
            $log->error('generation failed', ['error' => $e->getMessage(), 'attempt' => $this->attempts()]);

            $trend?->forceFill(['status' => 'researched'])->save();

            $runs->finish($run, JobRun::STATUS_FAILED, error: $e->getMessage());

            throw $e;
        }
    }
}
