<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AiGeneration extends Model
{
    protected $fillable = [
        'provider', 'kind', 'idempotency_key', 'subject_type', 'subject_id',
        'model', 'tokens_in', 'tokens_out', 'cost_usd', 'duration_ms',
        'status', 'error', 'result', 'request_hash',
    ];

    protected function casts(): array
    {
        return [
            'result' => 'array',
        ];
    }

    public function post(): BelongsTo
    {
        return $this->belongsTo(ContentPost::class, 'subject_id');
    }
}
