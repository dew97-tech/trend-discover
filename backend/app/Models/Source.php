<?php

namespace App\Models;

use App\Enums\SourceType;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Source extends Model
{
    protected $fillable = [
        'name', 'type', 'base_url', 'config', 'is_enabled',
        'last_collected_at', 'consecutive_failures',
    ];

    protected function casts(): array
    {
        return [
            'type' => SourceType::class,
            'config' => 'array',
            'is_enabled' => 'boolean',
            'last_collected_at' => 'datetime',
        ];
    }

    public function items(): HasMany
    {
        return $this->hasMany(SourceItem::class);
    }

    public function signals(): HasMany
    {
        return $this->hasMany(TrendSignal::class);
    }

    public function scopeEnabled(Builder $query): Builder
    {
        return $query->where('is_enabled', true);
    }
}
