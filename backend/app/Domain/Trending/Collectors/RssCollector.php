<?php

namespace App\Domain\Trending\Collectors;

use App\Models\Source;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;
use SimpleXMLElement;

final class RssCollector implements CollectorInterface
{
    public function collect(Source $source): Collection
    {
        $feeds = $source->config['feeds'] ?? [];
        $itemsPerFeed = (int) ($source->config['items_per_feed'] ?? 25);

        if ($feeds === []) {
            return collect();
        }

        return collect($feeds)
            ->flatMap(function (array $feed) use ($itemsPerFeed) {
                try {
                    $entries = $this->fetchFeed($feed['url']);
                } catch (ConnectionException $e) {
                    // One dead feed must not kill the whole collection run.
                    report($e);

                    return collect();
                }

                return $entries
                    ->take($itemsPerFeed)
                    ->map(fn (SimpleXMLElement $entry) => $this->toRawItem($feed['name'], $entry));
            });
    }

    /**
     * @return Collection<int, SimpleXMLElement>
     */
    public function fetchFeed(string $url): Collection
    {
        $response = Http::timeout(15)
            ->withUserAgent('trend-discover/1.0')
            ->retry(1, 500, throw: false)
            ->get($url);

        if ($response->failed()) {
            throw new ConnectionException("RSS feed failed: {$response->status()} for {$url}");
        }

        $xml = simplexml_load_string((string) $response->body());

        if ($xml === false) {
            throw new ConnectionException("RSS returned invalid XML: {$url}");
        }

        $items = $xml->channel->item ?: $xml->entry;

        // Field values are read directly from the nodes by toRawItem():
        // json_encode() turns CDATA content into empty arrays and loses data.
        return collect($items !== null ? iterator_to_array($items, false) : []);
    }

    private function toRawItem(string $feedName, SimpleXMLElement $entry): RawItem
    {
        // Register Media RSS so xpath('media:…') never throws "undefined
        // namespace prefix" on feeds that don't declare it (regular blogs).
        $entry->registerXPathNamespace('media', 'http://search.yahoo.com/mrss/');

        $title = self::text($entry->title) ?: 'Untitled';

        $link = self::text($entry->link);

        if ($link === '') {
            foreach ($entry->link as $variant) {
                $href = (string) ($variant['href'] ?? '');

                if (str_starts_with($href, 'http')) {
                    $link = $href;
                    break;
                }
            }
        }

        // Media RSS (YouTube) values need xpath — chained namespaced property
        // access ($group->community->statistics) silently returns empty.
        $summary = self::text($entry->description)
            ?: self::text($entry->summary)
            ?: self::text($entry->content)
            ?: self::xpathText($entry, 'media:group/media:description');

        $author = self::text($entry->children('dc', true)->creator)
            ?: self::xpathText($entry, 'author/name')
            ?: self::text($entry->author);

        $publishedRaw = self::text($entry->pubDate)
            ?: self::text($entry->published)
            ?: self::text($entry->updated);
        $publishedAt = $publishedRaw !== '' ? Carbon::parse($publishedRaw) : null;

        $guid = self::text($entry->guid) ?: self::text($entry->id) ?: $link;

        // YouTube channel feeds expose per-video view counts via media:statistics;
        // real engagement beats a zero-metric RSS article in momentum scoring.
        $statistics = $entry->xpath('media:group/media:community/media:statistics');
        $views = (int) ($statistics !== false ? ($statistics[0]['views'] ?? 0) : 0);
        $metrics = $views > 0 ? ['views' => $views] : [];

        return new RawItem(
            externalId: md5($feedName.'|'.$guid),
            url: $link !== '' ? $link : $guid,
            title: sprintf('[%s] %s', $feedName, $title),
            summary: $summary !== '' ? $summary : null,
            author: $author,
            metrics: $metrics,
            metadata: ['kind' => 'rss_article', 'feed' => $feedName],
            publishedAt: $publishedAt,
        );
    }

    private static function text(?SimpleXMLElement $node): string
    {
        return trim((string) $node);
    }

    private static function xpathText(SimpleXMLElement $entry, string $path): string
    {
        $found = $entry->xpath($path);

        return ($found !== false && isset($found[0])) ? trim((string) $found[0]) : '';
    }
}
