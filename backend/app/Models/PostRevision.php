<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PostRevision extends Model
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_READY = 'ready';

    public const STATUS_FAILED = 'failed';

    public const STATUS_APPLIED = 'applied';

    public const STATUS_DISCARDED = 'discarded';

    public const TARGET_HOOK = 'hook';

    public const TARGET_BODY = 'body';

    protected $fillable = [
        'content_post_id', 'target', 'instruction', 'reference',
        'hook_before', 'body_before', 'hook_after', 'body_after',
        'notes', 'status', 'error',
    ];

    public function post(): BelongsTo
    {
        return $this->belongsTo(ContentPost::class, 'content_post_id');
    }

    public function isReady(): bool
    {
        return $this->status === self::STATUS_READY;
    }
}
