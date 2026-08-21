<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TrendSignal extends Model
{
    protected $fillable = [
        'trend_id', 'source_id', 'type', 'weight', 'value', 'detected_at',
    ];

    protected function casts(): array
    {
        return [
            'value' => 'array',
            'detected_at' => 'datetime',
        ];
    }

    public function trend(): BelongsTo
    {
        return $this->belongsTo(Trend::class);
    }

    public function source(): BelongsTo
    {
        return $this->belongsTo(Source::class);
    }
}
