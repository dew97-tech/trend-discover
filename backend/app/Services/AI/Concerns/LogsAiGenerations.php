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
}
