<?php

namespace App\Services;

use App\Models\ContentPost;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * Post lifecycle operations with side effects the repositories should not own
 * (storage cleanup, pipeline logging, bulk deletes).
 */
class ContentPostService
{
    /**
     * Permanently deletes a post: versions + image rows cascade at the DB
     * level, stored image files are purged from the public disk.
     */
    public function delete(ContentPost $post): void
    {
        $paths = $post->images()
            ->whereNotNull('file_path')
            ->pluck('file_path')
            ->all();

        DB::transaction(fn () => $post->delete());

        if ($paths !== []) {
            Storage::disk('public')->delete($paths);
        }

        Log::channel('pipeline')->info('[ContentPostService] post deleted', [
            'post_id' => $post->id,
            'trend_id' => $post->trend_id,
            'format' => $post->format,
            'tone' => $post->tone,
            'files_purged' => count($paths),
        ]);
    }

    /**
     * Deletes every variant generated for a trend. Returns the count removed.
     */
    public function deleteForTrend(int $trendId): int
    {
        $posts = ContentPost::query()
            ->where('trend_id', $trendId)
            ->get();

        foreach ($posts as $post) {
            $this->delete($post);
        }

        Log::channel('pipeline')->info('[ContentPostService] trend variants deleted', [
            'trend_id' => $trendId,
            'deleted' => $posts->count(),
        ]);

        return $posts->count();
    }
}
