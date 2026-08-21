<?php

namespace App\Domain\Trending\Collectors;

use App\Enums\SourceType;
use App\Models\Source;
use InvalidArgumentException;

class CollectorFactory
{
    public function make(Source $source): CollectorInterface
    {
        return match ($source->type) {
            SourceType::HackerNews => app(HnCollector::class),
            SourceType::GitHub => app(GitHubCollector::class),
            SourceType::Reddit => app(RedditCollector::class),
            SourceType::DevTo => app(DevToCollector::class),
            SourceType::Rss => app(RssCollector::class),
        };
    }
}
