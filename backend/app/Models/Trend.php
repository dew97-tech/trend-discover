<?php

namespace App\Models;

use App\Enums\TrendStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Trend extends Model
{
    use SoftDeletes;
    protected $fillable = [
        'category_id', 'title', 'summary', 'status',
        'trend_score', 'novelty_score', 'freshness_score', 'momentum_score',
        'relevance_score', 'usefulness_score', 'saturation_score',
        'why_matters', 'angles', 'metrics', 'research',
        'item_count', 'first_seen_at', 'last_seen_at', 'researched_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => TrendStatus::class,
            'angles' => 'array',
            'metrics' => 'array',
            'research' => 'array',
            'first_seen_at' => 'datetime',
            'last_seen_at' => 'datetime',
            'researched_at' => 'datetime',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function signals(): HasMany
    {
        return $this->hasMany(TrendSignal::class);
    }

    public function technologies(): BelongsToMany
    {
        return $this->belongsToMany(Technology::class, 'trend_technology', 'trend_id', 'technology_id');
    }

    public function sourceItems(): BelongsToMany
    {
        return $this->belongsToMany(SourceItem::class, 'trend_source_item', 'trend_id', 'source_item_id');
    }

    public function posts(): HasMany
    {
        return $this->hasMany(ContentPost::class);
    }

    public function scopeRanked(Builder $query): Builder
    {
        return $query->orderByDesc('trend_score');
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->whereNot('status', TrendStatus::Archived);
    }
}
