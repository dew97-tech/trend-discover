<?php

namespace App\Enums;

enum SourceType: string
{
    case HackerNews = 'hn';
    case GitHub = 'github';
    case Reddit = 'reddit';
    case DevTo = 'devto';
    case Rss = 'rss';
}
