<?php

namespace App\Repositories\Contracts;

use Illuminate\Support\Collection;

interface SourceItemRepositoryInterface
{
    public function insertUniqueBatch(array $rows): int;

    public function recentUnnormalized(int $days = 30, int $limit = 1000): Collection;

    public function recentUnclustered(int $days = 30, int $limit = 500): Collection;

    public function countSince(int $days = 7): int;
}
