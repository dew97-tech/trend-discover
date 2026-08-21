<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\GeneratePostRequest;
use App\Http\Requests\UpdatePostRequest;
use App\Http\Resources\PostResource;
use App\Jobs\GeneratePostJob;
use App\Models\ContentPost;
use App\Repositories\Contracts\ContentPostRepositoryInterface;
use App\Services\AI\PostSpec;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class PostController extends Controller
{
    public function __construct(private readonly ContentPostRepositoryInterface $posts) {}

    public function index(\Illuminate\Http\Request $request): AnonymousResourceCollection
    {
        return PostResource::collection(
            $this->posts->filterPaginated($request->only(['status', 'format', 'trend_id'])),
        );
    }

    public function show(int $id): PostResource
    {
        $post = ContentPost::query()
            ->with(['trend:id,title', 'versions:id,content_post_id,version,created_by,created_at'])
            ->withCount('versions')
            ->find($id);

        abort_unless($post !== null, 404);

        return new PostResource($post);
    }

    public function update(UpdatePostRequest $request, int $id): PostResource
    {
        $post = ContentPost::query()->find($id);
        abort_unless($post !== null, 404);

        // Every user save creates an immutable version snapshot.
        $post->forceFill([
            'title' => $request->input('title', $post->title),
            'hook' => $request->input('hook', $post->hook),
            'body' => $request->input('body'),
            'word_count' => str_word_count((string) $request->input('body')),
        ])->save();

        $this->posts->saveNewVersion($post->fresh(), 'user');

        return new PostResource($post->fresh(['trend:id,title'])->loadCount('versions'));
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
