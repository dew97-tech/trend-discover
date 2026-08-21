<?php

namespace App\Domain\Trending\Collectors;

use App\Models\Source;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;

final class DevToCollector implements CollectorInterface
{
    public function collect(Source $source): Collection
    {
        $config = $source->config ?? [];
        $tags = $config['tags'] ?? ['php', 'javascript'];
        $minReactions = $config['min_reactions'] ?? 100;
        $windowDays = $config['window_days'] ?? 14;
        $baseUrl = $source->base_url ?? 'https://dev.to/api';

        return collect($tags)
            ->take(8)
            ->flatMap(function (string $tag) use ($baseUrl, $minReactions, $windowDays) {
                // NOTE: dev.to's `top=N` parameter means "articles from N
                // months ago" — fetching `latest` and filtering ourselves
                // is the correct way to get fresh popular articles.
                $response = Http::baseUrl($baseUrl)
                    ->timeout(40)
                    ->withUserAgent('trend-discover/1.0')
                    ->retry(2, 1500, throw: false)
                    ->get('/articles/latest', [
                        'tag' => $tag,
                        'per_page' => 100,
                    ]);

                if ($response->failed()) {
                    throw new ConnectionException("Dev.to tag {$tag} failed: {$response->status()}");
                }

                $cutoff = now()->subDays($windowDays);

                return collect($response->json())
                    ->filter(fn (array $article) => isset($article['published_at'])
                        && Carbon::parse($article['published_at'])->greaterThan($cutoff))
                    ->filter(fn (array $article) => ($article['positive_reactions_count'] ?? 0) >= $minReactions)
                    ->map(fn (array $article) => new RawItem(
                        externalId: 'devto-'.$article['id'],
                        url: $article['url'],
                        title: sprintf('[Dev.to/%s] %s', $tag, $article['title']),
                        summary: $article['description'] ?? null,
                        author: $article['user']['username'] ?? null,
                        metrics: [
                            'reactions' => $article['positive_reactions_count'] ?? 0,
                            'comments' => $article['comments_count'] ?? 0,
                        ],
                        metadata: [
                            'kind' => 'article',
                            'tag' => $tag,
                            'cover_image' => $article['cover_image'] ?? null,
                            'reading_time_minutes' => $article['reading_time_minutes'] ?? null,
                        ],
                        publishedAt: isset($article['published_at'])
                            ? Carbon::parse($article['published_at'])
                            : null,
                    ));
            })
            ->unique(fn (RawItem $item) => $item->externalId);
    }
}
