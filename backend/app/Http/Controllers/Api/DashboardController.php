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
                    'generated_posts' => array_sum($this->posts->countsByStatus()),
                    'pending_review' => $this->posts->countsByStatus()['review'] ?? 0,
                    'published' => $this->posts->countsByStatus()['published'] ?? 0,
                    'recent_items_7d' => $this->items->countSince(7),
                    'failed_jobs_24h' => $this->jobRuns->failureCountSince(24),
                ];
            },
        );

        return response()->json($payload);
    }
}
