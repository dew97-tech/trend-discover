<?php

namespace App\Http\Resources;

use App\Models\Source;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SourceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'type' => $this->type->value,
            'is_enabled' => $this->is_enabled,
            'last_collected_at' => $this->last_collected_at?->toIso8601String(),
            'consecutive_failures' => $this->consecutive_failures,
            'items_count' => $this->whenCounted('items'),
            'config_summary' => $this->configSummary(),
        ];
    }

    private function configSummary(): array
    {
        $config = $this->resource->config ?? [];

        return [
            'subreddits' => $config['subreddits'] ?? null,
            'tags' => $config['tags'] ?? null,
            'watched_topics' => $config['watched_topics'] ?? null,
            'feeds' => array_column($config['feeds'] ?? [], 'name') ?: null,
            'min_points' => $config['min_points'] ?? null,
            'min_stars' => $config['min_stars'] ?? null,
            'min_upvotes' => $config['min_upvotes'] ?? null,
            'min_reactions' => $config['min_reactions'] ?? null,
        ];
    }
}
