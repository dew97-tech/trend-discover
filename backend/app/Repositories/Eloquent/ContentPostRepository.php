<?php

namespace App\Repositories\Eloquent;

use App\Enums\PostStatus;
use App\Models\ContentPost;
use App\Models\ContentVersion;
use App\Models\Trend;
use App\Repositories\Contracts\ContentPostRepositoryInterface;
use Illuminate\Contracts\Pagination\CursorPaginator;
use Illuminate\Support\Facades\DB;

class ContentPostRepository implements ContentPostRepositoryInterface
{
    public function filterPaginated(array $filters, int $perPage = 20): CursorPaginator
    {
        return ContentPost::query()
            ->with(['trend' => fn ($q) => $q->withTrashed()->select(['id', 'title'])])
            ->with(['images' => fn ($q) => $q->select(['id', 'content_post_id', 'type', 'status', 'file_path'])])
            ->withCount('versions')
            ->when($filters['status'] ?? null, function ($q, $status) {
                // Comma-separated statuses: ?status=review,ready
                $statuses = collect(explode(',', (string) $status))
                    ->map(fn ($s) => trim($s))
                    ->filter(fn ($s) => PostStatus::tryFrom($s) !== null)
                    ->all();

                return $statuses === [] ? $q : $q->whereIn('status', $statuses);
            })
            ->when($filters['format'] ?? null, fn ($q, $format) => $q->where('format', $format))
            ->when($filters['trend_id'] ?? null, fn ($q, $trendId) => $q->where('trend_id', $trendId))
            ->when(
                $filters['search'] ?? null,
                fn ($q, $search) => $q->where(function ($q) use ($search) {
                    $term = '%'.$search.'%';
                    $q->where('title', 'like', $term)
                        ->orWhere('hook', 'like', $term)
                        ->orWhere('body', 'like', $term);
                }),
            )
            ->orderByDesc('updated_at')
            ->orderByDesc('id')
            ->cursorPaginate($perPage);
    }

    public function groupedByTrend(array $filters, int $perPage = 10): CursorPaginator
    {
        $apply = function ($query) use ($filters) {
            $query
                ->when($filters['status'] ?? null, function ($q, $status) {
                    $statuses = collect(explode(',', (string) $status))
                        ->map(fn ($s) => trim($s))
                        ->filter(fn ($s) => PostStatus::tryFrom($s) !== null)
                        ->all();

                    return $statuses === [] ? $q : $q->whereIn('status', $statuses);
                })
                ->when($filters['format'] ?? null, fn ($q, $format) => $q->where('format', $format))
                ->when(
                    $filters['search'] ?? null,
                    fn ($q, $search) => $q->where(function ($q) use ($search) {
                        $term = '%'.$search.'%';
                        $q->where('title', 'like', $term)
                            ->orWhere('hook', 'like', $term)
                            ->orWhere('body', 'like', $term);
                    }),
                );
        };

        return Trend::query()
            ->withTrashed()
            ->whereHas('posts', $apply)
            ->with([
                'category:id,name,slug',
                'posts' => function ($q) use ($apply) {
                    $apply($q);
                    $q->withCount('versions')->orderByDesc('updated_at')->orderByDesc('id');
                },
            ])
            ->withCount(['posts as post_count' => $apply])
            ->withMax(['posts as latest_post_at' => $apply], 'updated_at')
            ->orderByDesc('latest_post_at')
            ->orderByDesc('id')
            ->cursorPaginate($perPage);
    }

    public function createWithVersion(array $attributes): ContentPost
    {
        return DB::transaction(function () use ($attributes) {
            $post = ContentPost::query()->create($attributes);

            ContentVersion::query()->create([
                'content_post_id' => $post->id,
                'version' => 1,
                'title' => $post->title,
                'hook' => $post->hook,
                'body' => $post->body,
                'meta' => ['format' => $post->format, 'tone' => $post->tone],
                'created_by' => 'ai',
            ]);

            return $post;
        });
    }

    public function saveNewVersion(ContentPost $post, string $createdBy = 'user'): ContentVersion
    {
        return DB::transaction(function () use ($post, $createdBy) {
            $latest = (int) $post->versions()->max('version');

            $version = ContentVersion::query()->create([
                'content_post_id' => $post->id,
                'version' => $latest + 1,
                'title' => $post->title,
                'hook' => $post->hook,
                'body' => $post->body,
                'meta' => null,
                'created_by' => $createdBy,
            ]);

            $post->touch();

            return $version;
        });
    }

    public function countsByStatus(): array
    {
        return ContentPost::query()
            ->selectRaw("status, COUNT(*) as aggregate")
            ->groupBy('status')
            ->pluck('aggregate', 'status')
            ->all();
    }

    public function recent(int $limit = 4): \Illuminate\Support\Collection
    {
        return ContentPost::query()
            ->with(['trend' => fn ($q) => $q->withTrashed()->select(['id', 'title'])])
            ->orderByDesc('updated_at')
            ->orderByDesc('id')
            ->limit($limit)
            ->get(['id', 'trend_id', 'title', 'hook', 'status', 'format', 'quality_score']);
    }
}
