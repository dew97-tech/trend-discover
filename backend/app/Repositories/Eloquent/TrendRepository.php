<?php

namespace App\Repositories\Eloquent;

use App\Enums\TrendWorkflowStatus;
use App\Models\Trend;
use App\Repositories\Contracts\TrendRepositoryInterface;
use Illuminate\Contracts\Pagination\CursorPaginator;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class TrendRepository implements TrendRepositoryInterface
{
    public function filterPaginated(array $filters, int $perPage = 25): CursorPaginator
    {
        return Trend::query()
            ->with('category:id,name,slug')
            ->withExists('posts as has_post')
            ->when(
                $filters['status'] ?? null,
                fn ($q, $status) => $q->where('status', $status),
            )
            ->when(
                $filters['workflow_status'] ?? null,
                fn ($q, $workflowStatus) => $q->where('workflow_status', $workflowStatus),
            )
            ->when(
                $filters['category_id'] ?? null,
                fn ($q, $categoryId) => $q->where('category_id', $categoryId),
            )
            ->when(
                $filters['technology_id'] ?? null,
                fn ($q, $techId) => $q->whereHas('technologies', fn ($t) => $t->where('technologies.id', $techId)),
            )
            ->when(
                $filters['min_trend_score'] ?? null,
                fn ($q, $score) => $q->where('trend_score', '>=', $score),
            )
            ->when(
                $filters['min_novelty_score'] ?? null,
                fn ($q, $score) => $q->where('novelty_score', '>=', $score),
            )
            ->when(
                $filters['max_saturation'] ?? null,
                fn ($q, $score) => $q->where('saturation_score', '<=', $score),
            )
            ->when(
                $filters['focus'] ?? null,
                fn ($q) => $q->where(function ($q) {
                    $q->whereHas('technologies', fn ($t) => $t->whereIn(
                        'technologies.slug',
                        config('trending.focus.technology_slugs', []),
                    ))->orWhereHas('category', fn ($c) => $c->whereIn(
                        'categories.slug',
                        config('trending.focus.category_slugs', []),
                    ));
                }),
            )
            ->when(
                $filters['from'] ?? null,
                fn ($q, $from) => $q->where('first_seen_at', '>=', Carbon::parse($from)),
            )
            ->when(
                $filters['search'] ?? null,
                fn ($q, $search) => $q->whereFullText(['title', 'summary'], $search),
            )
            ->orderByDesc('trend_score')
            ->orderByDesc('id')
            ->cursorPaginate($perPage);
    }

    public function topRanked(int $limit = 10): Collection
    {
        return Trend::query()
            ->active()
            ->ranked()
            ->with('category:id,name,slug')
            ->limit($limit)
            ->get([
                'id', 'title', 'summary', 'category_id', 'status', 'workflow_status',
                'trend_score', 'novelty_score', 'freshness_score',
                'saturation_score', 'item_count', 'first_seen_at',
            ]);
    }

    public function statusCounts(): array
    {
        return Trend::query()
            ->selectRaw("status, COUNT(*) as aggregate")
            ->groupBy('status')
            ->pluck('aggregate', 'status')
            ->all();
    }

    public function highPotentialCount(float $threshold = 75.0): int
    {
        return Trend::query()
            ->active()
            ->where('trend_score', '>=', $threshold)
            ->count();
    }

    /**
     * Top-scored trends regardless of post existence — the dashboard's
     * "Recommended Topics" action list (user decision, Phase 6).
     */
    public function recommended(int $limit = 4): Collection
    {
        return Trend::query()
            ->active()
            ->ranked()
            ->with('category:id,name,slug')
            ->withExists('posts as has_post')
            ->limit($limit)
            ->get([
                'id', 'title', 'category_id', 'trend_score',
                'novelty_score', 'saturation_score', 'item_count', 'workflow_status',
            ]);
    }

    /**
     * Trends best suited for the nightly LinkedIn post: practical,
     * optimization-flavoured content over raw popularity.
     *
     * Ranking = focus + usefulness + trend_score (usefulness-weighted so
     * fresh tips/architecture write-ups beat viral release chatter), with
     * hack-style phrasing preferred via JSON metrics.
     *
     * @param  list<int>  $excludeTrendIds
     */
    public function dailyCandidates(int $limit = 10, array $excludeTrendIds = []): Collection
    {
        return Trend::query()
            ->active()
            ->where('workflow_status', '!=', TrendWorkflowStatus::Posted->value)
            ->where('usefulness_score', '>=', 55)
            ->where('saturation_score', '<=', 70)
            ->when(
                $excludeTrendIds !== [],
                fn ($q) => $q->whereNotIn('id', $excludeTrendIds),
            )
            ->with('category:id,name,slug')
            ->with('technologies:id,name,slug')
            ->orderByRaw('(focus_score * 0.35 + usefulness_score * 0.45 + trend_score * 0.20) DESC')
            ->orderByDesc('id')
            ->limit($limit)
            ->get([
                'id', 'title', 'summary', 'category_id', 'status', 'workflow_status',
                'trend_score', 'novelty_score', 'usefulness_score',
                'focus_score', 'saturation_score', 'item_count',
                'metrics', 'first_seen_at',
            ]);
    }

    public function findWithRelations(int $id): ?Trend
    {
        return Trend::query()
            ->with(['category:id,name,slug', 'technologies:id,name,slug'])
            ->find($id);
    }
}
