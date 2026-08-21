<?php

namespace App\Services\AI;

final class AiResponse
{
    public function __construct(
        public readonly array $data,
        public readonly int $durationMs,
        public readonly ?int $tokensIn,
        public readonly ?int $tokensOut,
        public readonly string $model,
    ) {}
}
