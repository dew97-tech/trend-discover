<?php

namespace App\Domain\Trending\Collectors;

use App\Models\Source;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Lobste.rs — open developer link/discussion aggregator.
 * Public JSON API, no authentication required.
 * Docs: https://lobste.rs/about (JSON feeds at /hottest.json, /newest.json)
 */
final class LobsteRsCollector implements CollectorInterface
{
    public function collect(Source $source): Collection
    {
        $config = $source->config ?? [];
        // NOTE: /hottest.json has no pagination; /newest.json does.
        $listing = $config['listing'] ?? 'newest';
        $pages = min((int) ($config['pages'] ?? 1), 3);
        $minScore = $config['min_score'] ?? 15;
        $windowHours = $config['window_hours'] ?? 72;
        $baseUrl = $source->base_url ?? 'https://lobste.rs';

        $cutoff = now()->subHours($windowHours);

        $stories = collect();

        for ($page = 1; $page <= $pages; $page++) {
            $path = $page === 1 ? "/{$listing}.json" : "/{$listing}/page/{$page}.json";

            $response = Http::baseUrl($baseUrl)
                ->timeout(20)
                ->withUserAgent('trend-discover/1.0 (local research tool)')
                ->retry(2, 1000, throw: false)
                ->get($path);

            if ($response->failed()) {
                // /hottest.json is single-page: a 404 on page 2+ means
                // pagination ended, not that the whole source is down.
                if ($page === 1) {
                    throw new ConnectionException("Lobste.rs {$listing} page {$page} failed: {$response->status()}");
                }

                Log::channel('pipeline')->info('[LobsteRsCollector] pagination ended', [
                    'listing' => $listing,
                    'page' => $page,
                    'status' => $response->status(),
                ]);

                break;
            }

            $stories = $stories->merge($response->json());
        }

        return $stories
            ->filter(fn (array $story) => ($story['score'] ?? 0) >= $minScore)
            ->filter(fn (array $story) => filled($story['title'] ?? null))
            ->filter(function (array $story) use ($cutoff) {
                if (! isset($story['created_at'])) {
                    return true;
                }

                return Carbon::parse($story['created_at'])->greaterThan($cutoff);
            })
            ->map(fn (array $story) => $this->toRawItem($story, $baseUrl))
            ->values();
    }

    private function toRawItem(array $story, string $baseUrl): RawItem
    {
        // Text-only posts have no external URL — the discussion itself is the content.
        $externalUrl = filled($story['url'] ?? null) ? (string) $story['url'] : null;
        $discussionUrl = $story['short_id_url']
            ?? sprintf('%s/s/%s', $baseUrl, $story['short_id'] ?? '');

        return new RawItem(
            externalId: 'lobsters-'.($story['short_id'] ?? md5((string) $story['title'])),
            url: $externalUrl ?? $discussionUrl,
            title: $story['title'],
            summary: $story['description_plain'] ?? null,
            author: $story['submitter_user']['username'] ?? null,
            metrics: [
                'score' => $story['score'] ?? 0,
                'comments' => $story['comment_count'] ?? 0,
                'upvotes' => $story['upvotes'] ?? ($story['score'] ?? 0),
            ],
            metadata: [
                'kind' => 'discussion',
                'discussion_url' => $discussionUrl,
                'tags' => array_slice($story['tags'] ?? [], 0, 10),
                'is_text_post' => $externalUrl === null,
            ],
            publishedAt: isset($story['created_at']) ? Carbon::parse($story['created_at']) : null,
        );
    }
}
