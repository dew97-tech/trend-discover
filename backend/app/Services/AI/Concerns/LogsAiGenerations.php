<?php

namespace App\Services\AI\Concerns;

use App\Models\AiGeneration;
use App\Services\AI\AiResponse;

trait LogsAiGenerations
{
    protected function logGeneration(
        string $provider,
        string $kind,
        string $idempotencyKey,
        string $requestHash,
        AiResponse $response,
        ?int $trendId = null,
        ?int $postId = null,
    ): AiGeneration {
        return AiGeneration::query()->create([
            'provider' => $provider,
            'kind' => $kind,
            'idempotency_key' => $idempotencyKey,
            'subject_type' => $postId !== null ? 'content_post' : ($trendId !== null ? 'trend' : null),
            'subject_id' => $postId ?? $trendId,
            'model' => $response->model,
            'tokens_in' => $response->tokensIn,
            'tokens_out' => $response->tokensOut,
            'duration_ms' => $response->durationMs,
            'status' => 'success',
            'request_hash' => $requestHash,
        ]);
    }

    /**
     * Find a prior successful generation for the same logical request.
     */
    protected function findCached(string $kind, string $requestHash): ?AiGeneration
    {
        return AiGeneration::query()
            ->where('kind', $kind)
            ->where('status', 'success')
            ->where('request_hash', $requestHash)
            ->latest('id')
            ->first();
    }

    /**
     * Failure rows make gateway incidents forensically visible — without
     * them, ai_generations only ever shows successes.
     */
    protected function logFailure(
        AIManager $manager,
        string $kind,
        string $requestHash,
        \Throwable $e,
        ?int $trendId = null,
        ?int $postId = null,
        int $durationMs = 0,
    ): void {
        try {
            AiGeneration::query()->create([
                'provider' => class_basename($manager->provider()),
                'kind' => $kind,
                'idempotency_key' => hash('sha256', "failed|{$kind}|".uniqid()),
                'subject_type' => $postId !== null ? 'content_post' : ($trendId !== null ? 'trend' : null),
                'subject_id' => $postId ?? $trendId,
                'model' => (string) (
                    \App\Models\SystemSetting::get('ai.model')
                    ?? config('ai.providers.opencode_go.model')
                ),
                'duration_ms' => max(0, $durationMs),
                'status' => 'failed',
                'error' => str($e->getMessage())->limit(500),
                'request_hash' => $requestHash,
            ]);
        } catch (\Throwable) {
            // Never let forensic logging break the actual error flow.
        }
    }
}
