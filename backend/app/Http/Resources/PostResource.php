<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PostResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'trend' => $this->whenLoaded('trend', fn () => $this->trend?->only(['id', 'title'])),
            'title' => $this->title,
            'hook' => $this->hook,
            'body' => $this->body,
            'format' => $this->format,
            'tone' => $this->tone,
            'angle' => $this->angle,
            'status' => $this->status->value,
            'quality_score' => (float) $this->quality_score,
            'quality_breakdown' => $this->quality_breakdown,
            'word_count' => $this->word_count,
            'version_count' => $this->whenCounted('versions'),
            'generated_at' => $this->generated_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
