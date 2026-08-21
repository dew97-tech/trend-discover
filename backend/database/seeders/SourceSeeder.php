<?php

namespace Database\Seeders;

use App\Enums\SourceType;
use App\Models\Source;
use Illuminate\Database\Seeder;

class SourceSeeder extends Seeder
{
    public function run(): void
    {
        $sources = [
            [
                'name' => 'hacker-news',
                'type' => SourceType::HackerNews,
                'base_url' => 'https://hn.algolia.com/api/v1',
                'config' => [
                    'tags' => ['story'],
                    'min_points' => 40,
                    'search_window_days' => 14,
                    'numeric_filters' => ['points>30'],
                    'rate_limit_per_minute' => 10,
                ],
            ],
            [
                'name' => 'github',
                'type' => SourceType::GitHub,
                'base_url' => 'https://api.github.com',
                'config' => [
                    'trending_window_days' => 7,
                    'min_stars' => 150,
                    'watched_topics' => ['laravel', 'react', 'typescript', 'devops', 'database', 'performance'],
                    'release_repos' => ['laravel/framework', 'facebook/react', 'microsoft/TypeScript', 'php/php-src'],
                    'rate_limit_per_hour' => 60,
                ],
            ],
            [
                'name' => 'reddit',
                'type' => SourceType::Reddit,
                'base_url' => 'https://oauth.reddit.com',
                'config' => [
                    'subreddits' => ['programming', 'laravel', 'webdev', 'javascript', 'devops', 'ExperiencedDevs'],
                    'min_upvotes' => 50,
                    'listing_window_hours' => 72,
                    'rate_limit_per_minute' => 10,
                ],
            ],
            [
                'name' => 'dev-to',
                'type' => SourceType::DevTo,
                'base_url' => 'https://dev.to/api',
                'config' => [
                    'tags' => ['php', 'laravel', 'javascript', 'typescript', 'react', 'devops', 'sql', 'performance'],
                    'top_articles_window_days' => 7,
                    'min_reactions' => 100,
                    'rate_limit_per_second' => 1,
                ],
            ],
            [
                'name' => 'engineering-rss',
                'type' => SourceType::Rss,
                'base_url' => null,
                'config' => [
                    'feeds' => [
                        ['name' => 'Laravel News', 'url' => 'https://laravel-news.com/feed'],
                        ['name' => 'PHP Watch', 'url' => 'https://www.php.watch/feeds/all.xml'],
                        ['name' => 'InfoQ Engineering', 'url' => 'https://feed.infoq.com/'],
                    ],
                    'items_per_feed' => 25,
                ],
            ],
        ];

        foreach ($sources as $source) {
            Source::updateOrCreate(
                ['name' => $source['name']],
                [...$source, 'is_enabled' => true],
            );
        }
    }
}
