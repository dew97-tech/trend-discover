<?php

namespace App\Repositories\Contracts;

use App\Models\ContentPost;
use App\Models\ContentVersion;
use Illuminate\Contracts\Pagination\CursorPaginator;

interface ContentPostRepositoryInterface
{
    public function filterPaginated(array $filters, int $perPage = 20): CursorPaginator;

    /**
     * Trends that have posts, ordered by latest variant activity, each with
     * its (filtered) variants eager-loaded — powers the grouped Studio view.
     */
    public function groupedByTrend(array $filters, int $perPage = 10): CursorPaginator;

    public function createWithVersion(array $attributes): ContentPost;

    public function saveNewVersion(ContentPost $post, string $createdBy = 'user'): ContentVersion;

    public function countsByStatus(): array;

    public function recent(int $limit = 4): \Illuminate\Support\Collection;
}
