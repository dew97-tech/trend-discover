<?php

namespace App\Repositories\Eloquent;

use App\Models\ContentPost;
use App\Models\ContentVersion;
use App\Repositories\Contracts\ContentPostRepositoryInterface;
use Illuminate\Contracts\Pagination\CursorPaginator;
use Illuminate\Support\Facades\DB;

class ContentPostRepository implements ContentPostRepositoryInterface
{
    public function filterPaginated(array $filters, int $perPage = 20): CursorPaginator
    {
        return ContentPost::query()
            ->with(['trend:id,title', 'images' => fn ($q) => $q->select(['id', 'content_post_id', 'type', 'status', 'file_path'])])
            ->when($filters['status'] ?? null, fn ($q, $status) => $q->where('status', $status))
            ->when($filters['format'] ?? null, fn ($q, $format) => $q->where('format', $format))
            ->when($filters['trend_id'] ?? null, fn ($q, $trendId) => $q->where('trend_id', $trendId))
            ->orderByDesc('updated_at')
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
}
