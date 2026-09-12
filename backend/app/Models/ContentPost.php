<?php

namespace App\Models;

use App\Enums\PostStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ContentPost extends Model
{
    protected $fillable = [
        'trend_id', 'title', 'hook', 'body', 'hashtags', 'format', 'tone', 'angle',
        'status', 'quality_score', 'quality_breakdown', 'word_count',
        'generated_at', 'published_at', 'published_channel',
    ];

    protected function casts(): array
    {
        return [
            'status' => PostStatus::class,
            'quality_breakdown' => 'array',
            'hashtags' => 'array',
            'generated_at' => 'datetime',
            'published_at' => 'datetime',
        ];
    }

    public function trend(): BelongsTo
    {
        return $this->belongsTo(Trend::class);
    }

    public function versions(): HasMany
    {
        return $this->hasMany(ContentVersion::class)->latest('version');
    }

    public function images(): HasMany
    {
        return $this->hasMany(ContentImage::class);
    }

    public function scopeInLibrary(Builder $query): Builder
    {
        return $query->whereIn('status', [
            PostStatus::Draft,
            PostStatus::Review,
            PostStatus::Ready,
            PostStatus::Published,
        ]);
    }
}
