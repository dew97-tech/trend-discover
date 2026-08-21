<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\TrendFilterRequest;
use App\Http\Resources\TrendResource;
use App\Jobs\CalculateTrendScoreJob;
use App\Jobs\GeneratePostJob;
use App\Models\Category;
use App\Models\Technology;
use App\Repositories\Contracts\TrendRepositoryInterface;
use Illuminate\Cache\Repository as CacheRepository;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class TrendController extends Controller
{
    public function __construct(private readonly TrendRepositoryInterface $trends) {}

    public function index(TrendFilterRequest $request): AnonymousResourceCollection
    {
        $page = $this->trends->filterPaginated(
            $request->filters(),
            (int) $request->input('per_page', 25),
        );

        return TrendResource::collection($page);
    }

    public function show(int $id): TrendResource
    {
        $trend = $this->trends->findWithRelations($id);

        abort_unless($trend !== null, 404);

        $trend->load([
            'posts:id,trend_id,status',
            'signals' => fn ($q) => $q
                ->where('type', 'source_coverage')
                ->with('source:id,name')
                ->orderByDesc('detected_at')
                ->limit(20),
        ]);

        $breakdown = $trend->signals()
            ->where('type', 'score_breakdown')
            ->orderByDesc('detected_at')
            ->first()?->value;

        $resource = new TrendResource($trend);
        $resource->additional([
            'why_matters' => $trend->why_matters,
            'score_breakdown' => $breakdown['dimensions'] ?? null,
            'applied_weights' => $breakdown['weights'] ?? null,
            'sources' => $trend->signals->map(fn ($signal) => [
                'source' => $signal->source?->name,
                'title' => $signal->value['title'] ?? null,
                'url' => $signal->value['url'] ?? null,
                'metrics' => $signal->value['metrics'] ?? [],
                'published_at' => $signal->value['published_at'] ?? null,
            ]),
            'post_statuses' => $trend->posts->pluck('status')->all(),
        ]);

        return $resource;
    }

    public function rescore(int $id): JsonResponse
    {
        abort_unless($this->trends->findWithRelations($id) !== null, 404);

        CalculateTrendScoreJob::dispatch($id);

        return response()->json(['message' => "Re-score queued for trend #{$id}."], 202);
    }

    public function generate(\App\Http\Requests\GeneratePostRequest $request, int $id): JsonResponse
    {
        $trend = $this->trends->findWithRelations($id);

        abort_unless($trend !== null, 404);

        $spec = new \App\Services\AI\PostSpec(
            format: $request->string('format')->toString(),
            tone: $request->input('tone', 'technical'),
            angle: $request->input('angle'),
        );

        GeneratePostJob::dispatch($id, $spec, force: (bool) $request->boolean('force'));

        return response()->json([
            'message' => 'Post generation queued.',
            'status_url' => "/api/posts?filter[trend_id]={$id}",
        ], 202);
    }

    public function taxonomy(CacheRepository $cache): JsonResponse
    {
        $payload = $cache->remember('taxonomy:categories-technologies', now()->addHours(24), fn () => [
            // Plain arrays only cross the cache boundary — Collections
            // unserialize as __PHP_Incomplete_Class on cache hits.
            'categories' => Category::query()
                ->orderBy('name')
                ->get(['id', 'name', 'slug'])
                ->toArray(),
            'technologies' => Technology::query()
                ->where('is_active', true)
                ->orderBy('name')
                ->get(['id', 'name', 'slug', 'category_id'])
                ->toArray(),
        ]);

        return response()->json($payload);
    }
}
