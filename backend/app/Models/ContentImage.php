<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ContentImage extends Model
{
    protected $fillable = [
        'content_post_id', 'type', 'status', 'spec', 'prompt_text',
        'file_path', 'width', 'height', 'generated_at',
    ];

    protected function casts(): array
    {
        return [
            'spec' => 'array',
            'generated_at' => 'datetime',
        ];
    }

    public function post(): BelongsTo
    {
        return $this->belongsTo(ContentPost::class, 'content_post_id');
    }
}
