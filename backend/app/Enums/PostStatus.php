<?php

namespace App\Enums;

enum PostStatus: string
{
    case Draft = 'draft';
    case Review = 'review';
    case Ready = 'ready';
    case Published = 'published';
    case Archived = 'archived';
    case FailedGeneration = 'failed_generation';
    case FailedValidation = 'failed_validation';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Draft',
            self::Review => 'Review',
            self::Ready => 'Ready',
            self::Published => 'Published',
            self::Archived => 'Archived',
            self::FailedGeneration => 'Failed Generation',
            self::FailedValidation => 'Failed Validation',
        };
    }
}
