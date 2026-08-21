<?php

namespace App\Domain\Trending\Collectors;

use App\Models\Source;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;

final class RedditCollector implements CollectorInterface
{
    private const OAUTH_BASE = 'https://oauth.reddit.com';

    private const TOKEN_URL = 'https://www.reddit.com/api/v1/access_token';

    public function collect(Source $source): Collection
    {
        $config = $source->config ?? [];
        $subreddits = $config['subreddits'] ?? ['programming'];
        $minUpvotes = $config['min_upvotes'] ?? 50;
        $windowHours = $config['listing_window_hours'] ?? 72;

        $token = $this->accessToken($config);

        return collect($subreddits)
            ->take(8)
            ->flatMap(function (string $subreddit) use ($token, $minUpvotes, $windowHours) {
                $response = Http::baseUrl(self::OAUTH_BASE)
                    ->timeout(15)
                    ->withToken($token)
                    ->withUserAgent('trend-discover/1.0 (local research tool)')
                    ->retry(1, 1000, throw: false)
                    ->get("/r/{$subreddit}/top", [
                        't' => 'week',
                        'limit' => 50,
                    ]);

                if ($response->failed()) {
                    throw new ConnectionException("Reddit r/{$subreddit} failed: {$response->status()}");
                }

                return collect($response->json('data.children', []))
                    ->map(fn (array $child) => $child['data'] ?? [])
                    ->filter(fn (array $post) => ($post['score'] ?? 0) >= $minUpvotes)
                    ->filter(fn (array $post) => filled($post['title'] ?? null))
                    ->map(fn (array $post) => new RawItem(
                        externalId: (string) ($post['name'] ?? $post['id']),
                        url: str_starts_with($post['url'] ?? '', 'http') && ! str_contains((string) $post['url'], 'reddit.com')
                            ? $post['url']
                            : 'https://www.reddit.com'.$post['permalink'],
                        title: sprintf('[r/%s] %s', $subreddit, $post['title']),
                        summary: filled($post['selftext'] ?? null) ? str($post['selftext'])->limit(1500)->toString() : null,
                        author: $post['author'] ?? null,
                        metrics: [
                            'upvotes' => $post['score'] ?? 0,
                            'comments' => $post['num_comments'] ?? 0,
                            'upvote_ratio' => $post['upvote_ratio'] ?? null,
                        ],
                        metadata: [
                            'subreddit' => $subreddit,
                            'flair' => $post['link_flair_text'] ?? null,
                            'kind' => 'discussion',
                        ],
                        publishedAt: isset($post['created_utc'])
                            ? Carbon::createFromTimestamp((int) $post['created_utc'])
                            : null,
                    ))
                    ->filter(fn (RawItem $item) => $item->publishedAt === null
                        || $item->publishedAt->greaterThan(now()->subHours($windowHours)));
            });
    }

    /**
     * App-only OAuth (client_credentials): read-only access, no user login.
     * Requires REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET from a "script" app
     * created at https://www.reddit.com/prefs/apps.
     */
    private function accessToken(array $config): string
    {
        $clientId = $config['client_id'] ?? env('REDDIT_CLIENT_ID');
        $clientSecret = $config['client_secret'] ?? env('REDDIT_CLIENT_SECRET');

        if (! filled($clientId) || ! filled($clientSecret)) {
            throw new ConnectionException(
                'Reddit credentials missing. Create a "script" app at reddit.com/prefs/apps '
                .'and set REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET in backend/.env',
            );
        }

        $response = Http::asForm()
            ->timeout(15)
            ->withBasicAuth((string) $clientId, (string) $clientSecret)
            ->withUserAgent('trend-discover/1.0 (local research tool)')
            ->retry(1, 500, throw: false)
            ->post(self::TOKEN_URL, ['grant_type' => 'client_credentials']);

        if ($response->failed() || ! isset($response->json()['access_token'])) {
            throw new ConnectionException("Reddit OAuth failed: {$response->status()}");
        }

        return (string) $response->json('access_token');
    }
}
