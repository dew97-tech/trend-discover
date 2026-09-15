<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PostRevisionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $charsBefore = $this->body_before !== null ? mb_strlen((string) $this->body_before) : null;
        $charsAfter = $this->body_after !== null ? mb_strlen((string) $this->body_after) : null;

        return [
            'id' => $this->id,
            'content_post_id' => $this->content_post_id,
            'target' => $this->target,
            'instruction' => $this->instruction,
            'reference' => $this->reference,
            'hook_before' => $this->hook_before,
            'body_before' => $this->body_before,
            'hook_after' => $this->hook_after,
            'body_after' => $this->body_after,
            'notes' => $this->notes,
            'status' => $this->status,
            'error' => $this->error,
            'char_delta' => ($charsBefore !== null && $charsAfter !== null)
                ? $charsAfter - $charsBefore
                : null,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
