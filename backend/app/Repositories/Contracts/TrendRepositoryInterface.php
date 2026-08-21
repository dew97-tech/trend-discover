<?php

namespace App\Repositories\Contracts;

use App\Models\Trend;
use Illuminate\Contracts\Pagination\CursorPaginator;
use Illuminate\Support\Collection;

interface TrendRepositoryInterface
{
    public function filterPaginated(array $filters, int $perPage = 25): CursorPaginator;

    public function topRanked(int $limit = 10): Collection;

    public function statusCounts(): array;

    public function highPotentialCount(float $threshold = 75.0): int;

    public function findWithRelations(int $id): ?Trend;
}
