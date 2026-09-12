<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\GeneratePostRequest;
use App\Http\Requests\UpdatePostRequest;
use App\Http\Resources\PostResource;
use App\Jobs\GenerateHashtagsJob;
use App\Jobs\GeneratePostJob;
use App\Models\ContentPost;
use App\Repositories\Contracts\ContentPostRepositoryInterface;
use App\Services\AI\PostSpec;
use App\Services\ContentPostService;
use App\Support\Hashtags;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class PostController extends Controller
{
    public function __construct(private readonly ContentPostRepositoryInterface $posts) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        return PostResource::collection(
            $this->posts->filterPaginated(
                $request->only(['status', 'format', 'trend_id', 'search']),
                max(1, min(50, (int) $request->input('per_page', 20))),
            ),
        );
    }

    /**
     * Posts grouped under their trend — the Studio's working view.
     */
    public function grouped(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['nullable', 'string'],
            'format' => ['nullable', 'string'],
            'search' => ['nullable', 'string', 'max:255'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:25'],
        ]);

        $page = $this->posts->groupedByTrend(
            $validated,
            (int) ($validated['per_page'] ?? 10),
        );

        return response()->json([
            'data' => collect($page->items())->map(fn ($trend) => [
                'trend' => [
                    'id' => $trend->id,
                    'title' => $trend->title,
                    'category' => $trend->category?->only(['id', 'name', 'slug']),
                    'trend_score' => (float) $trend->trend_score,
                    'focus_score' => (float) $trend->focus_score,
                    'hack_style' => (bool) ($trend->metrics['hack_style'] ?? false),
                    'deleted' => $trend->trashed(),
                ],
                'post_count' => (int) $trend->post_count,
                'latest_at' => $trend->latest_post_at
                    ? \Illuminate\Support\Carbon::parse($trend->latest_post_at)->toIso8601String()
                    : null,
                'posts' => PostResource::collection($trend->posts)->resolve(),
            ])->all(),
            'next_cursor' => $page->nextCursor()?->encode(),
        ]);
    }

    public function show(int $id): PostResource
    {
        $post = ContentPost::query()
            ->with([
                'trend' => fn ($q) => $q->withTrashed()->select(['id', 'title']),
                'versions:id,content_post_id,version,created_by,created_at',
            ])
            ->withCount('versions')
            ->find($id);

        abort_unless($post !== null, 404);

        return new PostResource($post);
    }

    public function update(UpdatePostRequest $request, int $id): PostResource
    {
        $post = ContentPost::query()->find($id);
        abort_unless($post !== null, 404);

        $attributes = [
            'title' => $request->input('title', $post->title),
            'hook' => $request->input('hook', $post->hook),
            'body' => $request->input('body'),
            'word_count' => str_word_count((string) $request->input('body')),
        ];

        if ($request->has('hashtags')) {
            $tags = Hashtags::sanitize($request->input('hashtags', []));
            $attributes['hashtags'] = $tags === [] ? null : $tags;
        }

        // Every user save creates an immutable version snapshot.
        $post->forceFill($attributes)->save();

        $this->posts->saveNewVersion($post->fresh(), 'user');

        return new PostResource($post->fresh(['trend:id,title'])->loadCount('versions'));
    }

    /**
     * Queues AI hashtag selection for a post that has none (or wants new ones).
     */
    public function generateHashtags(int $id): JsonResponse
    {
        $post = ContentPost::query()->find($id);
        abort_unless($post !== null, 404);

        GenerateHashtagsJob::dispatch($post->id);

        return response()->json(['message' => 'Hashtag generation queued.'], 202);
    }

    public function updateStatus(\Illuminate\Http\Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', 'string', 'in:draft,review,ready,archived'],
        ]);

        $post = ContentPost::query()->find($id);
        abort_unless($post !== null, 404);

        // Published is exclusive to the future publishing flow.
        if ($post->status === \App\Enums\PostStatus::Published) {
            return response()->json([
                'message' => 'Published posts cannot change state here.',
            ], 422);
        }

        $post->forceFill(['status' => $validated['status']])->save();

        return response()->json([
            'message' => "Post moved to {$validated['status']}.",
            'data' => new PostResource($post->fresh(['trend:id,title'])->loadCount('versions')),
        ]);
    }

    /**
     * Permanent delete — versions and image rows cascade, stored files purge.
     */
    public function destroy(int $id, ContentPostService $service): JsonResponse
    {
        $post = ContentPost::query()->find($id);
        abort_unless($post !== null, 404);

        $service->delete($post);

        return response()->json(['message' => 'Post deleted.']);
    }

    /**
     * Deletes every variant generated for one trend.
     */
    public function destroyByTrend(Request $request, ContentPostService $service): JsonResponse
    {
        $validated = $request->validate([
            'trend_id' => ['required', 'integer', 'exists:trends,id'],
        ]);

        $deleted = $service->deleteForTrend((int) $validated['trend_id']);

        return response()->json([
            'message' => $deleted === 1 ? '1 variant deleted.' : "{$deleted} variants deleted.",
            'deleted' => $deleted,
        ]);
    }

    public function regenerate(int $id): JsonResponse
    {
        $post = ContentPost::query()->with('trend')->find($id);
        abort_unless($post !== null, 404);

        $spec = new PostSpec(
            format: $post->format,
            tone: (string) $post->tone,
            angle: $post->angle,
        );

        GeneratePostJob::dispatch($post->trend_id, $spec, force: true);

        return response()->json(['message' => 'Regeneration queued.'], 202);
    }
}
