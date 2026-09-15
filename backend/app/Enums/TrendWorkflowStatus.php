<?php

namespace App\Enums;

/**
 * Manual workflow state for a trend — set by the user, never by jobs.
 * The automation-owned lifecycle lives in TrendStatus.
 */
enum TrendWorkflowStatus: string
{
    case Draft = 'draft';
    case Ready = 'ready';
    case Posted = 'posted';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Draft',
            self::Ready => 'Ready',
            self::Posted => 'Posted',
        };
    }
}
