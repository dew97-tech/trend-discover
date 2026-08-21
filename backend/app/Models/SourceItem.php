<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class SourceItem extends Model
{
    protected $fillable = [
        'source_id', 'external_id', 'url', 'title', 'summary', 'author',
        'metrics', 'metadata', 'content_hash', 'published_at', 'normalized_at',
    ];

    protected function casts(): array
    {
        return [
            'metrics' => 'array',
            'metadata' => 'array',
            'published_at' => 'datetime',
            'normalized_at' => 'datetime',
        ];
    }

    public function source(): BelongsTo
    {
        return $this->belongsTo(Source::class);
    }

    public function trends(): BelongsToMany
    {
        return $this->belongsToMany(Trend::class, 'trend_source_item', 'source_item_id', 'trend_id');
    }

    public function scopeRecent(Builder $query, int $days = 30): Builder
    {
        return $query->where('published_at', '>=', now()->subDays($days));
    }

    public function scopeUnclustered(Builder $query): Builder
    {
        return $query->whereDoesntHave('trends');
    }
}
