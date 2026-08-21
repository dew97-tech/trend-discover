<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ContentImageResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type->value,
            'status' => $this->status,
            'spec' => $this->spec,
            'prompt_text' => $this->prompt_text,
            'url' => $this->file_path !== null ? asset('storage/'.$this->file_path) : null,
            'width' => $this->width,
            'height' => $this->height,
            'generated_at' => $this->generated_at?->toIso8601String(),
        ];
    }
}
