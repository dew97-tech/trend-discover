<?php

namespace App\Domain\Trending\Collectors;

use App\Models\Source;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;

final class HnCollector implements CollectorInterface
{
    public function collect(Source $source): Collection
    {
        $config = $source->config ?? [];
        $since = now()->subDays($config['search_window_days'] ?? 14)->getTimestamp();

        $response = Http::baseUrl($source->base_url ?? 'https://hn.algolia.com/api/v1')
            ->timeout(20)
            ->retry(2, 500, throw: false)
            ->get('/search_by_date', [
                'tags' => 'story',
                'numericFilters' => sprintf(
                    'points>%d,created_at_i>%d',
                    $config['min_points'] ?? 30,
                    $since,
                ),
                'hitsPerPage' => 100,
            ]);

        if ($response->failed()) {
            throw new ConnectionException("HN API request failed: {$response->status()}");
        }

        return collect($response->json('hits', []))
            ->filter(fn (array $hit) => filled($hit['title'] ?? null))
            ->map(fn (array $hit) => new RawItem(
                externalId: (string) $hit['objectID'],
                url: $hit['url'] ?? "https://news.ycombinator.com/item?id={$hit['objectID']}",
                title: $hit['title'],
                summary: $hit['story_text'] ?? null,
                author: $hit['author'] ?? null,
                metrics: [
                    'points' => $hit['points'] ?? 0,
                    'comments' => $hit['num_comments'] ?? 0,
                ],
                metadata: [
                    'hn_item_id' => $hit['objectID'],
                ],
                publishedAt: isset($hit['created_at'])
                    ? Carbon::parse($hit['created_at'])
                    : null,
            ));
    }
}
