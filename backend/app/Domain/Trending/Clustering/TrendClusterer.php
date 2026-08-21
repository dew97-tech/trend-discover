<?php

namespace App\Domain\Trending\Clustering;

use App\Models\SourceItem;
use App\Models\Technology;
use App\Models\Trend;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Groups related source items into trends.
 *
 * Pass 1: exact content_hash match (same URL shared across sources).
 * Pass 2: fuzzy title match against existing open trends, then within
 *         the incoming batch (greedy single-link clustering).
 */
class TrendClusterer
{
    public function __construct(
        private readonly float $threshold = 0.55,
        private readonly int $windowDays = 14,
    ) {}

    /**
     * @return Collection<int, int> trend IDs touched (created or updated)
     */
    public function cluster(): Collection
    {
        $items = SourceItem::query()
            ->with('source:id,name')
            ->recent($this->windowDays)
            ->unclustered()
            ->orderBy('published_at')
            ->get();

        if ($items->isEmpty()) {
            return collect();
        }

        $existing = $this->openTrendIndex();
        $hashIndex = $this->openTrendHashIndex();
        $touched = collect();

        foreach ($items as $item) {
            // Pass 1: exact URL identity — same article shared across sources.
            $trend = $this->matchByHash($hashIndex, $item)
                ?? $this->matchExisting($existing, $item)
                ?? $this->matchBatch($touched, $item);

            if ($trend === null) {
                $trend = $this->createTrend($item);
                $existing[] = ['id' => $trend->id, 'title' => $trend->title];
            }

            $hashIndex[$item->content_hash] = $trend->id;
            $this->attachItem($trend, $item);
            $touched->push($trend->id);
        }

        return $touched->unique()->values();
    }

    /**
     * Map of content_hash → trend id for open trends.
     *
     * @return array<string, int>
     */
    private function openTrendHashIndex(): array
    {
        return DB::table('trend_source_item')
            ->join('source_items', 'source_items.id', '=', 'trend_source_item.source_item_id')
            ->join('trends', 'trends.id', '=', 'trend_source_item.trend_id')
            ->where('trends.status', '!=', 'archived')
            ->where('trends.last_seen_at', '>=', now()->subDays($this->windowDays))
            ->orderByDesc('trends.last_seen_at')
            ->limit(2000)
            ->pluck('trend_source_item.trend_id', 'source_items.content_hash')
            ->all();
    }

    private function matchByHash(array $hashIndex, SourceItem $item): ?Trend
    {
        $trendId = $hashIndex[$item->content_hash] ?? null;

        return $trendId !== null ? Trend::find($trendId) : null;
    }

    /**
     * @return list<array{id: int, title: string}>
     */
    private function openTrendIndex(): array
    {
        return Trend::query()
            ->active()
            ->where('last_seen_at', '>=', now()->subDays($this->windowDays))
            ->orderByDesc('last_seen_at')
            ->limit(500)
            ->get(['id', 'title'])
            ->map(fn (Trend $t) => ['id' => $t->id, 'title' => $t->title])
            ->all();
    }

    private function matchExisting(array $index, SourceItem $item): ?Trend
    {
        foreach ($index as $entry) {
            if (TitleSimilarity::passesThreshold($entry['title'], $item->title, $this->threshold)) {
                return Trend::find($entry['id']);
            }
        }

        return null;
    }

    private function matchBatch(Collection $touchedIds, SourceItem $item): ?Trend
    {
        $siblingIds = $touchedIds->unique()->take(50);

        if ($siblingIds->isEmpty()) {
            return null;
        }

        $candidates = Trend::query()
            ->whereIn('id', $siblingIds)
            ->get(['id', 'title']);

        foreach ($candidates as $candidate) {
            if (TitleSimilarity::passesThreshold($candidate->title, $item->title, $this->threshold)) {
                return $candidate;
            }
        }

        return null;
    }

    private function createTrend(SourceItem $item): Trend
    {
        [$categoryId, $technologyIds] = $this->classify($item);

        $trend = Trend::query()->create([
            'title' => $item->title,
            'summary' => $item->summary,
            'status' => 'discovered',
            'category_id' => $categoryId,
            'metrics' => [
                'total_engagement' => $this->engagement($item),
                'sources_covering' => 1,
            ],
            'item_count' => 0,
            'first_seen_at' => $item->published_at ?? $item->created_at,
            'last_seen_at' => $item->published_at ?? $item->created_at,
        ]);

        if ($technologyIds !== []) {
            $trend->technologies()->sync($technologyIds);
        }

        return $trend;
    }

    private function attachItem(Trend $trend, SourceItem $item): void
    {
        DB::table('trend_source_item')->insertOrIgnore([
            'trend_id' => $trend->id,
            'source_item_id' => $item->id,
        ]);

        $engagement = $this->engagement($item);
        $isNewer = ($item->published_at ?? $item->created_at)?->greaterThan($trend->last_seen_at) ?? false;

        // Promote the strongest-coverage title to represent the cluster.
        if ($engagement > ($trend->metrics['total_engagement'] ?? 0)) {
            $trend->title = $item->title;

            if (filled($item->summary)) {
                $trend->summary = $item->summary;
            }
        }

        $flags = $trend->metrics['flags'] ?? [];

        foreach ($this->qualityFlags($item) as $flag) {
            $flags[$flag] = true;
        }

        $trend->item_count = (int) DB::table('trend_source_item')->where('trend_id', $trend->id)->count();
        $trend->metrics = [
            ...($trend->metrics ?? []),
            'total_engagement' => max(
                (int) ($trend->metrics['total_engagement'] ?? 0),
                $engagement,
            ),
            'flags' => $flags,
        ];

        if ($isNewer) {
            $trend->last_seen_at = $item->published_at ?? $item->created_at;
        }

        if ($trend->first_seen_at === null || ($item->published_at?->lessThan($trend->first_seen_at) ?? false)) {
            $trend->first_seen_at = $item->published_at ?? $item->created_at;
        }

        $trend->save();

        $trend->signals()->create([
            'source_id' => $item->source_id,
            'type' => 'source_coverage',
            'weight' => 1,
            'value' => [
                'source' => $item->source?->name,
                'title' => str($item->title)->limit(120),
                'url' => str($item->url)->limit(255),
                'metrics' => $item->metrics,
                'published_at' => ($item->published_at ?? $item->created_at)?->toIso8601String(),
            ],
            'detected_at' => now(),
        ]);
    }

    /**
     * @return array{0: ?int, 1: list<int>} category id + technology ids
     */
    private function classify(SourceItem $item): array
    {
        $haystack = mb_strtolower(
            $item->title.' '.
            implode(' ', $item->metadata['tags'] ?? []).' '.
            ($item->metadata['language'] ?? '').' '.
            ($item->summary ?? ''),
        );

        $technologies = Technology::query()
            ->where('is_active', true)
            ->get(['id', 'name', 'slug', 'aliases', 'category_id']);

        $matched = $technologies->filter(function (Technology $tech) use ($haystack) {
            $names = [$tech->name, str_replace('-', ' ', $tech->slug), ...($tech->aliases ?? [])];

            foreach ($names as $name) {
                if ($name !== '' && str_contains($haystack, mb_strtolower($name))) {
                    return true;
                }
            }

            return false;
        });

        $technologyIds = $matched->pluck('id')->take(6)->all();
        $categoryId = $matched->first()?->category_id;

        return [$categoryId, $technologyIds];
    }

    private function engagement(SourceItem $item): int
    {
        $m = $item->metrics ?? [];

        $primary = (int) ($m['points']
            ?? $m['score']
            ?? $m['stars']
            ?? $m['upvotes']
            ?? $m['reactions']
            ?? 0);

        return $primary + 2 * (int) ($m['comments'] ?? 0);
    }

    /**
     * Heuristic junk signals — star-farmed repos and promo spam
     * must not outrank genuine engineering content.
     *
     * @return list<string>
     */
    private function qualityFlags(SourceItem $item): array
    {
        $flags = [];
        $meta = $item->metadata ?? [];

        if (($meta['kind'] ?? null) === 'repository') {
            $descriptionEmpty = blank($item->summary)
                || str_contains($item->title, 'New repository');

            if ($descriptionEmpty) {
                $flags['repo_no_description'] = true;
            }

            $stars = (int) ($item->metrics['stars'] ?? 0);

            // Repo younger than 10 days already at 300+ stars is the classic
            // astroturf/star-farm signature — legit virality rarely looks
            // like this, and truly huge launches still rank on interest.
            $createdAt = isset($meta['github_created_at'])
                ? \Illuminate\Support\Carbon::parse($meta['github_created_at'])
                : null;

            if ($stars >= 300 && $createdAt !== null && $createdAt->greaterThan(now()->subDays(10))) {
                $flags['suspect_velocity'] = true;
            }
        }

        // ⭐ (U+2B50), misc symbols, emoji planes, and U+FFFD mojibake
        // markers all indicate promo-style or badly-encoded titles.
        if (preg_match_all('/[\x{2B50}\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}\x{FFFD}]/u', $item->title, $matches) >= 2) {
            $flags['emoji_heavy'] = true;
        }

        return array_keys($flags);
    }
}
