<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class JobRun extends Model
{
    protected $fillable = [
        'job_class', 'job_id', 'batch_id', 'status', 'attempts',
        'started_at', 'finished_at', 'duration_ms', 'error', 'meta',
    ];

    protected function casts(): array
    {
        return [
            'meta' => 'array',
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
        ];
    }
}
