<?php

namespace App\Repositories\Eloquent;

use App\Models\SourceItem;
use App\Repositories\Contracts\SourceItemRepositoryInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class SourceItemRepository implements SourceItemRepositoryInterface
{
    public function insertUniqueBatch(array $rows): int
    {
        if ($rows === []) {
            return 0;
        }

        return SourceItem::query()->insertOrIgnore($rows);
    }

    public function recentUnnormalized(int $days = 30, int $limit = 1000): Collection
    {
        return SourceItem::query()
            ->whereNull('normalized_at')
            ->where('created_at', '>=', Carbon::now()->subDays($days))
            ->limit($limit)
            ->get(['id', 'title', 'url', 'summary', 'metrics']);
    }

    public function recentUnclustered(int $days = 30, int $limit = 500): Collection
    {
        return SourceItem::query()
            ->whereNotNull('normalized_at')
            ->recent($days)
            ->unclustered()
            ->select(['id', 'source_id', 'title', 'summary', 'url', 'published_at', 'metrics'])
            ->limit($limit)
            ->get();
    }

    public function countSince(int $days = 7): int
    {
        return DB::table('source_items')
            ->where('published_at', '>=', Carbon::now()->subDays($days))
            ->count();
    }
}
