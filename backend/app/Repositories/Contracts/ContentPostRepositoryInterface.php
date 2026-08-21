<?php

namespace App\Repositories\Contracts;

use App\Models\ContentPost;
use App\Models\ContentVersion;
use Illuminate\Contracts\Pagination\CursorPaginator;

interface ContentPostRepositoryInterface
{
    public function filterPaginated(array $filters, int $perPage = 20): CursorPaginator;

    public function createWithVersion(array $attributes): ContentPost;

    public function saveNewVersion(ContentPost $post, string $createdBy = 'user'): ContentVersion;

    public function countsByStatus(): array;
}
