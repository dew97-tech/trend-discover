<?php

namespace App\Services\AI;

final class PostSpec
{
    public function __construct(
        public readonly string $format,   // ContentFormat value
        public readonly string $tone = 'technical',
        public readonly ?string $angle = null,
    ) {}

    public function fingerprint(): string
    {
        return implode('|', [
            $this->format,
            $this->tone,
            str_replace("\n", ' ', (string) $this->angle),
        ]);
    }
}
