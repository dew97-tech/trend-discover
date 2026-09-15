<?php

namespace App\Services\AI;

use App\Enums\ContentFormat;
use App\Models\ContentPost;
use App\Models\SystemSetting;
use App\Models\Trend;
use App\Repositories\Contracts\ContentPostRepositoryInterface;
use App\Services\AI\Concerns\LogsAiGenerations;
use App\Support\Hashtags;

class PostGenerationService
{
    use LogsAiGenerations;

    public function __construct(
        private readonly AIManager $manager,
        private readonly PromptRegistry $prompts,
        private readonly ContentPostRepositoryInterface $posts,
    ) {}

    /**
     * Generate a post for a trend. Idempotent per trend+spec+research-state
     * unless $force (explicit user regeneration).
     *
     * @return array{post: ContentPost, cached: bool}
     */
    public function generate(Trend $trend, PostSpec $spec, bool $force = false): array
    {
        ['research' => $research] = app(ResearchService::class)->getOrGenerate($trend);

        $requestHash = hash('sha256', implode('|', [
            'post',
            'v2', // v2: body no longer contains the hook (separate fields)
            $trend->id,
            $trend->item_count,
            $spec->fingerprint(),
            md5(json_encode($research)),
        ]));

        if (! $force) {
            $cached = $this->findCached('post', $requestHash);

            if ($cached !== null && is_array($cached->result) && ($cached->result['content_post_id'] ?? null)) {
                $post = ContentPost::query()->find($cached->result['content_post_id']);

                if ($post !== null) {
                    return ['post' => $post, 'cached' => true];
                }
            }
        }

        $formatLabel = ContentFormat::from($spec->format)->label();

        $prompt = $this->prompts->render('post.user', [
            'format_label' => $formatLabel,
            'format_guidance' => config("prompts.format_guidance.{$spec->format}", 'A focused technical take.'),
            'tone' => $spec->tone,
            'angle' => $spec->angle,
            'research_context' => $research['context'] ?? '',
            'research_points' => $research['key_points'] ?? [],
            'research_tradeoffs' => $research['tradeoffs'] ?? [],
            'research_practical' => $research['practical_angle'] ?? '',
            'research_confidence' => $research['confidence'] ?? 'medium',
        ]);

        $started = now()->getTimestampMs();

        try {
            $response = $this->manager->provider()->complete(
                $this->prompts->render('post.system'),
                $prompt,
            );
        } catch (\Throwable $e) {
            $this->logFailure($this->manager, 'post', $requestHash, $e, trendId: $trend->id, durationMs: max(0, now()->getTimestampMs() - $started));

            throw $e;
        }

        $data = $response->data;
        $hashtags = Hashtags::sanitize($data['hashtags'] ?? []);

        $post = $this->posts->createWithVersion([
            'trend_id' => $trend->id,
            'title' => str((string) ($data['title'] ?? $trend->title))->limit(255)->toString(),
            'hook' => str((string) ($data['hook'] ?? ''))->limit(500)->toString(),
            'body' => (string) ($data['body'] ?? ''),
            'hashtags' => $hashtags === [] ? null : $hashtags,
            'format' => $spec->format,
            'tone' => $spec->tone,
            'angle' => $spec->angle,
            'status' => 'draft',
            'word_count' => str_word_count((string) ($data['body'] ?? '')),
            'generated_at' => now(),
        ]);

        $generation = $this->logGeneration(
            provider: class_basename($this->manager->provider()),
            kind: 'post',
            idempotencyKey: hash('sha256', "post|{$trend->id}|{$spec->fingerprint()}|".uniqid()),
            requestHash: $requestHash,
            response: $response,
            postId: $post->id,
        );

        $generation->forceFill([
            'result' => ['content_post_id' => $post->id],
        ])->save();

        return ['post' => $post, 'cached' => false];
    }

    public function limitReached(Trend $trend): bool
    {
        $limits = SystemSetting::get('generation.limits', []) ?? [];

        $max = (int) ($limits['max_generations_per_trend'] ?? 3);

        return $trend->posts()->count() >= $max;
    }

    public static function dailyBudgetRemaining(): int
    {
        $limits = SystemSetting::get('generation.limits', []) ?? [];

        $budget = (int) ($limits['daily_ai_call_budget'] ?? 200);
        $used = \App\Models\AiGeneration::query()
            ->whereDate('created_at', today())
            ->count();

        return max(0, $budget - $used);
    }
}
