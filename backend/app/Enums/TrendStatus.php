<?php

namespace App\Enums;

enum TrendStatus: string
{
    case Discovered = 'discovered';
    case Researching = 'researching';
    case Researched = 'researched';
    case Archived = 'archived';

    public function label(): string
    {
        return match ($this) {
            self::Discovered => 'Discovered',
            self::Researching => 'Researching',
            self::Researched => 'Researched',
            self::Archived => 'Archived',
        };
    }
}
