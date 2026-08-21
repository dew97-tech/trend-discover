<?php

namespace App\Domain\Trending\Collectors;

use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

final class RawItem
{
    public function __construct(
        public readonly string $externalId,
        public readonly string $url,
        public readonly string $title,
        public readonly ?string $summary = null,
        public readonly ?string $author = null,
        public readonly array $metrics = [],
        public readonly array $metadata = [],
        public readonly ?Carbon $publishedAt = null,
    ) {}

    /**
     * Stable identity for cross-source deduplication:
     * host + path, lowercased, stripped of www/query/fragment.
     */
    public function contentHash(): string
    {
        $parts = parse_url(trim($this->url));

        if ($parts === false || ! isset($parts['host'])) {
            return hash('sha256', 'url::'.mb_strtolower(trim($this->url)));
        }

        $normalized = mb_strtolower(
            preg_replace('/^www\./i', '', $parts['host']).
            '/'.ltrim($parts['path'] ?? '', '/')
        );

        return hash('sha256', 'url::'.$normalized);
    }

    public function toRow(int $sourceId): array
    {
        return [
            'source_id' => $sourceId,
            'external_id' => Str::limit($this->externalId, 255, ''),
            'url' => Str::limit($this->url, 1024, ''),
            'title' => Str::limit(html_entity_decode($this->title), 512, ''),
            'summary' => $this->summary !== null ? Str::limit(strip_tags(html_entity_decode($this->summary)), 2000, '…') : null,
            'author' => $this->author,
            'metrics' => json_encode($this->metrics),
            'metadata' => json_encode($this->metadata),
            'content_hash' => $this->contentHash(),
            'published_at' => $this->publishedAt?->format('Y-m-d H:i:s'),
            'normalized_at' => now()->format('Y-m-d H:i:s'),
            'created_at' => now()->format('Y-m-d H:i:s'),
            'updated_at' => now()->format('Y-m-d H:i:s'),
        ];
    }
}
