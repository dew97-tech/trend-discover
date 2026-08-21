<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Repositories\Contracts\ContentPostRepositoryInterface;
use App\Repositories\Contracts\JobRunRepositoryInterface;
use App\Repositories\Contracts\SourceItemRepositoryInterface;
use App\Repositories\Contracts\TrendRepositoryInterface;
use Illuminate\Cache\Repository;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    public function __construct(
        private readonly TrendRepositoryInterface $trends,
        private readonly ContentPostRepositoryInterface $posts,
        private readonly SourceItemRepositoryInterface $items,
        private readonly JobRunRepositoryInterface $jobRuns,
    ) {}

    public function index(Repository $cache): JsonResponse
    {
        $payload = $cache->remember(
            'dashboard:overview',
            now()->addSeconds(60),
            function () {
                $top = $this->trends->topRanked(6);

                return [
                    'new_trends' => array_sum($this->trends->statusCounts()) ?: 0,
                    'high_potential' => $this->trends->highPotentialCount(),
                    'trending_now' => \App\Http\Resources\TrendResource::collection($top)->resolve(),
                    'recommended' => \App\Http\Resources\TrendResource::collection(
                        $this->trends->recommended(4),
                    )->resolve(),
                    'recent_content' => $this->posts->recent(4)->map(
                        fn ($post) => [
                            'id' => $post->id,
                            'title' => $post->title,
                            'hook' => $post->hook,
                            'status' => $post->status->value,
                            'format' => $post->format,
                            'quality_score' => (float) $post->quality_score,
                            'trend_title' => $post->trend?->title,
                            'updated_at' => $post->updated_at?->toIso8601String(),
                        ],
                        // IMPORTANT: plain arrays only cross the cache boundary —
                        // Collections unserialize as __PHP_Incomplete_Class
                        // objects and break JSON contracts on cache hits.
                    )->values()->all(),
                    'generated_posts' => array_sum($this->posts->countsByStatus()),
                    'pending_review' => $this->posts->countsByStatus()['review'] ?? 0,
                    'published' => $this->posts->countsByStatus()['published'] ?? 0,
                    'queue_count' => ($this->posts->countsByStatus()['review'] ?? 0)
                        + ($this->posts->countsByStatus()['ready'] ?? 0),
                    'recent_items_7d' => $this->items->countSince(7),
                    'failed_jobs_24h' => $this->jobRuns->failureCountSince(24),
                ];
            },
        );

        return response()->json($payload);
    }
}
