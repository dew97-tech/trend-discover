<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreRevisionRequest;
use App\Http\Resources\PostResource;
use App\Http\Resources\PostRevisionResource;
use App\Jobs\RevisePostJob;
use App\Jobs\ScorePostQualityJob;
use App\Models\ContentPost;
use App\Models\PostRevision;
use App\Repositories\Contracts\ContentPostRepositoryInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class PostRevisionController extends Controller
{
    public function __construct(private readonly ContentPostRepositoryInterface $posts) {}

    public function index(ContentPost $post): AnonymousResourceCollection
    {
        return PostRevisionResource::collection(
            PostRevision::query()
                ->where('content_post_id', $post->id)
                ->orderByDesc('id')
                ->limit(10)
                ->get(),
        );
    }

    /**
     * Queues an AI revision proposal. Only one pending suggestion per target —
     * a newer request supersedes the older one.
     */
    public function store(StoreRevisionRequest $request, ContentPost $post): JsonResponse
    {
        $target = (string) $request->validated('target');

        PostRevision::query()
            ->where('content_post_id', $post->id)
            ->where('target', $target)
            ->where('status', PostRevision::STATUS_PENDING)
            ->update(['status' => PostRevision::STATUS_DISCARDED]);

        $revision = PostRevision::query()->create([
            'content_post_id' => $post->id,
            'target' => $target,
            'instruction' => (string) $request->validated('instruction'),
            'reference' => $request->validated('reference'),
            'hook_before' => $post->hook,
            'body_before' => $post->body,
            'status' => PostRevision::STATUS_PENDING,
        ]);

        RevisePostJob::dispatch($revision->id);

        return response()->json([
            'message' => 'Revision queued.',
            'data' => new PostRevisionResource($revision),
        ], 202);
    }

    /**
     * Applies a ready proposal: writes the new hook/body, snapshots a version,
     * and queues a quality re-check against the corrected text.
     */
    public function apply(ContentPost $post, PostRevision $revision): JsonResponse
    {
        abort_unless($revision->content_post_id === $post->id, 404);

        if (! $revision->isReady()) {
            return response()->json(['message' => 'This revision is not ready to apply.'], 422);
        }

        DB::transaction(function () use ($post, $revision) {
            $attributes = $revision->target === PostRevision::TARGET_HOOK
                ? ['hook' => $revision->hook_after]
                : [
                    'body' => (string) $revision->body_after,
                    'word_count' => str_word_count((string) $revision->body_after),
                ];

            $post->forceFill($attributes)->save();

            $version = $this->posts->saveNewVersion($post->fresh(), 'user');

            $version->forceFill([
                'meta' => [
                    'revision_id' => $revision->id,
                    'target' => $revision->target,
                    'instruction' => $revision->instruction,
                ],
            ])->save();

            $revision->forceFill(['status' => PostRevision::STATUS_APPLIED])->save();
        });

        ScorePostQualityJob::dispatch($post->id);

        return response()->json([
            'message' => 'Revision applied — quality re-check queued.',
            'data' => new PostResource(
                $post->fresh(['trend:id,title'])->loadCount('versions'),
            ),
        ]);
    }

    public function discard(ContentPost $post, PostRevision $revision): JsonResponse
    {
        abort_unless($revision->content_post_id === $post->id, 404);

        if ($revision->status === PostRevision::STATUS_APPLIED) {
            return response()->json(['message' => 'An applied revision cannot be discarded.'], 422);
        }

        $revision->forceFill(['status' => PostRevision::STATUS_DISCARDED])->save();

        return response()->json(['message' => 'Revision discarded.']);
    }
}
