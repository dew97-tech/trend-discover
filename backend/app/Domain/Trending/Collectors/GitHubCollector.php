<?php

namespace App\Domain\Trending\Collectors;

use App\Models\Source;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;

final class GitHubCollector implements CollectorInterface
{
    public function collect(Source $source): Collection
    {
        $config = $source->config ?? [];
        $since = now()->subDays($config['trending_window_days'] ?? 7)->toDateString();
        $minStars = $config['min_stars'] ?? 150;

        return $this->trendingRepositories($source, $since, $minStars)
            ->merge($this->latestReleases($source));
    }

    private function trendingRepositories(Source $source, string $since, int $minStars): Collection
    {
        $topics = implode(',', array_slice($config['watched_topics'] ?? [], 0, 5));

        $response = Http::baseUrl($source->base_url ?? 'https://api.github.com')
            ->timeout(20)
            ->withToken(config('services.github.token'))
            ->withUserAgent('trend-discover/1.0')
            ->retry(2, 1000, throw: false)
            ->get('/search/repositories', [
                'q' => "created:>={$since} stars:>={$minStars}".($topics !== '' ? " topic:{$topics}" : ''),
                'sort' => 'stars',
                'order' => 'desc',
                'per_page' => 30,
            ]);

        if ($response->failed()) {
            throw new ConnectionException(
                "GitHub search failed: {$response->status()} ".str($response->body())->limit(180),
            );
        }

        return collect($response->json('items', []))
            ->map(fn (array $repo) => new RawItem(
                externalId: 'repo-'.$repo['id'],
                url: $repo['html_url'],
                title: sprintf('%s — %s ⭐ %s', $repo['full_name'], str($repo['description'] ?? 'New repository')->limit(120), number_format((float) $repo['stargazers_count'])),
                summary: $repo['description'],
                author: $repo['owner']['login'] ?? null,
                metrics: [
                    'stars' => $repo['stargazers_count'] ?? 0,
                    'forks' => $repo['forks_count'] ?? 0,
                    'watchers' => $repo['subscribers_count'] ?? 0,
                ],
                metadata: [
                    'kind' => 'repository',
                    'language' => $repo['language'] ?? null,
                    'topics' => array_slice($repo['topics'] ?? [], 0, 10),
                    'github_created_at' => $repo['created_at'] ?? null,
                ],
                publishedAt: isset($repo['pushed_at']) ? Carbon::parse($repo['pushed_at']) : null,
            ));
    }

    private function latestReleases(Source $source): Collection
    {
        $repos = $source->config['release_repos'] ?? [];

        return collect($repos)
            ->take(10)
            ->map(function (string $repo) use ($source) {
                $response = Http::baseUrl($source->base_url ?? 'https://api.github.com')
                    ->timeout(15)
                    ->withToken(config('services.github.token'))
                    ->withUserAgent('trend-discover/1.0')
                    ->retry(1, 500, throw: false)
                    ->get("/repos/{$repo}/releases/latest");

                if ($response->failed()) {
                    return null;
                }

                $release = $response->json();

                if (! isset($release['id'])) {
                    return null;
                }

                return new RawItem(
                    externalId: 'release-'.$release['id'],
                    url: $release['html_url'] ?? "https://github.com/{$repo}/releases",
                    title: sprintf('[Release] %s %s', $repo, $release['name'] ?? $release['tag_name']),
                    summary: str($release['body'] ?? '')->limit(1000),
                    author: $release['author']['login'] ?? null,
                    metrics: [
                        'reactions' => $release['reactions']['total_count'] ?? 0,
                    ],
                    metadata: [
                        'kind' => 'release',
                        'repo' => $repo,
                        'tag_name' => $release['tag_name'] ?? null,
                    ],
                    publishedAt: isset($release['published_at']) ? Carbon::parse($release['published_at']) : null,
                );
            })
            ->filter();
    }
}
