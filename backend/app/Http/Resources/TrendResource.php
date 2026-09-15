<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TrendResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'summary' => $this->when($request->routeIs('trends.show'), $this->summary),
            'status' => $this->status->value,
            'workflow_status' => $this->workflow_status->value,
            'workflow_status_label' => $this->workflow_status->label(),
            'category' => $this->whenLoaded('category', fn () => $this->category?->only(['id', 'name', 'slug'])),
            'technologies' => $this->whenLoaded(
                'technologies',
                fn () => $this->technologies->map(fn ($t) => $t->only(['id', 'name', 'slug'])),
            ),
            'scores' => [
                'trend' => (float) $this->trend_score,
                'novelty' => (float) $this->novelty_score,
                'freshness' => (float) $this->freshness_score,
                'momentum' => (float) $this->momentum_score,
                'relevance' => (float) $this->relevance_score,
                'usefulness' => (float) $this->usefulness_score,
                'focus' => (float) $this->focus_score,
                'saturation' => (float) $this->saturation_score,
            ],
            'hack_style' => (bool) ($this->metrics['hack_style'] ?? false),
            'item_count' => $this->item_count,
            'has_post' => $this->whenNotNull($this->posts_exists ?? null, fn () => (bool) $this->posts_exists),
            'first_seen_at' => $this->first_seen_at?->toIso8601String(),
            'last_seen_at' => $this->last_seen_at?->toIso8601String(),
        ];
    }
}
