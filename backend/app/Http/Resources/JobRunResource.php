<?php

namespace App\Http\Resources;

use App\Models\JobRun;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class JobRunResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'job_class' => $this->job_class,
            'status' => $this->status,
            'attempts' => $this->attempts,
            'started_at' => $this->started_at?->toIso8601String(),
            'finished_at' => $this->finished_at?->toIso8601String(),
            'duration_ms' => $this->duration_ms,
            'error' => $this->when($this->status === JobRun::STATUS_FAILED, $this->error),
            'meta' => $this->meta,
        ];
    }
}
