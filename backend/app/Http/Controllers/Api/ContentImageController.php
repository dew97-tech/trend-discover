<?php

namespace App\Http\Controllers\Api;

use App\Enums\ImageType;
use App\Http\Controllers\Controller;
use App\Http\Resources\ContentImageResource;
use App\Jobs\GenerateImagePromptJob;
use App\Jobs\SuggestSnippetJob;
use App\Models\ContentImage;
use App\Models\ContentPost;
use App\Services\AI\ImagePromptService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ContentImageController extends Controller
{
    public function index(ContentPost $post): AnonymousResourceCollection
    {
        return ContentImageResource::collection(
            ContentImage::query()
                ->where('content_post_id', $post->id)
                ->orderByDesc('id')
                ->get(),
        );
    }

    /**
     * Queues snippet derivation. Creates the row as PENDING so the UI can
     * show a placeholder immediately; SuggestSnippetJob flips it to ready.
     */
    public function suggestSnippet(Request $request, ContentPost $post): JsonResponse
    {
        $force = $request->boolean('force');

        if (! $force && app(\App\Services\AI\SnippetService::class)->hasReadySnippet($post)) {
            return response()->json([
                'message' => 'A ready snippet already exists — pass force to regenerate.',
                'data' => new ContentImageResource(
                    ContentImage::query()
                        ->where('content_post_id', $post->id)
                        ->where('type', ImageType::CodeSnippet->value)
                        ->first(),
                ),
            ]);
        }

        $image = ContentImage::query()->updateOrCreate(
            [
                'content_post_id' => $post->id,
                'type' => ImageType::CodeSnippet->value,
            ],
            ['status' => 'pending'],
        );

        SuggestSnippetJob::dispatch($post->id, $force);

        return response()->json([
            'message' => 'Snippet suggestion queued.',
            'data' => new ContentImageResource($image),
        ], 202);
    }

    /**
     * Queues image-prompt generation (fast validation only; the job
     * re-validates the cap authoritatively before spending tokens).
     */
    public function generatePrompt(ContentPost $post, ImagePromptService $service): JsonResponse
    {
        if ($service->limitReached($post)) {
            abort(422, 'Image-prompt limit reached for this post (max '.$service::maxPerPost().').');
        }

        $image = ContentImage::query()->create([
            'content_post_id' => $post->id,
            'type' => ImageType::Prompt->value,
            'status' => 'pending',
        ]);

        GenerateImagePromptJob::dispatch($post->id);

        return response()->json([
            'message' => 'Image-prompt generation queued.',
            'data' => new ContentImageResource($image),
        ], 202);
    }

    public function upload(Request $request, ContentPost $post): JsonResponse
    {
        $request->validate([
            'image' => ['required', 'image', 'max:4096'],
        ]);

        $path = $request->file('image')->store("post-images/{$post->id}", 'public');

        $image = ContentImage::query()->create([
            'content_post_id' => $post->id,
            'type' => ImageType::ManualUpload->value,
            'status' => 'ready',
            'file_path' => $path,
            'generated_at' => now(),
        ]);

        [$width, $height] = getimagesize($request->file('image')->getRealPath()) ?: [null, null];
        $image->forceFill(['width' => $width, 'height' => $height])->save();

        return response()->json([
            'message' => 'Image uploaded.',
            'data' => new ContentImageResource($image),
        ], 201);
    }

    public function destroy(int $id): JsonResponse
    {
        $image = ContentImage::query()->find($id);
        abort_unless($image !== null, 404);

        if ($image->file_path !== null) {
            \Illuminate\Support\Facades\Storage::disk('public')->delete($image->file_path);
        }

        $image->delete();

        return response()->json(['message' => 'Image deleted.']);
    }
}
