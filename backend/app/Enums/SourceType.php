<?php

namespace App\Enums;

enum SourceType: string
{
    case HackerNews = 'hn';
    case GitHub = 'github';
    case DevTo = 'devto';
    case Rss = 'rss';
    case LobsteRs = 'lobsters';
}
