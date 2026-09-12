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
                    'watched_topics' => ['laravel', 'react', 'nextjs', 'typescript', 'php', 'mysql', 'database', 'performance'],
                    'release_repos' => ['laravel/framework', 'facebook/react', 'vercel/next.js', 'microsoft/TypeScript', 'php/php-src'],
                    'rate_limit_per_hour' => 60,
                ],
            ],
            [
                'name' => 'lobsters',
                'type' => SourceType::LobsteRs,
                'base_url' => 'https://lobste.rs',
                'config' => [
                    // /hottest.json is single-page; pagination attempts 404.
                    'listing' => 'hottest',
                    'pages' => 1,
                    'min_score' => 15,
                    'window_hours' => 72,
                    'rate_limit_per_minute' => 10,
                ],
            ],
            [
                'name' => 'dev-to',
                'type' => SourceType::DevTo,
                'base_url' => 'https://dev.to/api',
                'config' => [
                    'tags' => ['php', 'laravel', 'javascript', 'typescript', 'react', 'nextjs', 'sql', 'mysql', 'database', 'performance'],
                    // Public API ignores sort-by-popularity params, so this
                    // source contributes FRESH niche articles; popularity
                    // signals come from HN/Lobsters/GitHub.
                    'window_days' => 7,
                    'min_reactions' => 5,
                ],
            ],
            [
                'name' => 'engineering-rss',
                'type' => SourceType::Rss,
                'base_url' => null,
                'config' => [
                    'feeds' => [
                        ['name' => 'Laravel News', 'url' => 'https://laravel-news.com/feed'],
                        ['name' => 'Laravel Daily', 'url' => 'https://laraveldaily.com/feed'],
                        ['name' => 'Laracasts', 'url' => 'https://laracasts.com/feed'],
                        ['name' => 'Next.js Blog', 'url' => 'https://nextjs.org/feed.xml'],
                        ['name' => 'React Blog', 'url' => 'https://react.dev/rss.xml'],
                        ['name' => 'Vercel Blog', 'url' => 'https://vercel.com/atom'],
                        ['name' => 'Percona MySQL', 'url' => 'https://www.percona.com/blog/feed/'],
                        ['name' => 'PlanetScale', 'url' => 'https://planetscale.com/blog/feed.atom'],
                        ['name' => 'InfoQ Engineering', 'url' => 'https://feed.infoq.com/'],
                        ['name' => 'Smashing Magazine', 'url' => 'https://www.smashingmagazine.com/feed/'],
                    ],
                    'items_per_feed' => 25,
                ],
            ],
            [
                'name' => 'youtube',
                'type' => SourceType::Rss,
                'base_url' => null,
                'config' => [
                    // Channel RSS feeds — no API key. Entries carry
                    // media:statistics views which the RSS collector maps
                    // into engagement metrics (views ÷ 200).
                    'feeds' => [
                        ['name' => 'KodeKloud', 'url' => 'https://www.youtube.com/feeds/videos.xml?channel_id=UCSWj8mqQCcrcBlXPi4ThRDQ'],
                        ['name' => 'Laravel Daily Video', 'url' => 'https://www.youtube.com/feeds/videos.xml?channel_id=UCTuplgOBi6tJIlesIboymGA'],
                        ['name' => 'Learn with Sumit', 'url' => 'https://www.youtube.com/feeds/videos.xml?channel_id=UCFM3gG5IHfogarxlKcIHCAg'],
                        ['name' => 'Web Dev Cody', 'url' => 'https://www.youtube.com/feeds/videos.xml?channel_id=UCsrVDPJBYeXItETFHG0qzyw'],
                        ['name' => 'ByteByteGo', 'url' => 'https://www.youtube.com/feeds/videos.xml?channel_id=UCZgt6AzoyjslHTC9dz0UoTw'],
                        ['name' => 'CodeWithHarry', 'url' => 'https://www.youtube.com/feeds/videos.xml?channel_id=UCeVMnSShP_Iviwkknt83cww'],
                    ],
                    'items_per_feed' => 15,
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
