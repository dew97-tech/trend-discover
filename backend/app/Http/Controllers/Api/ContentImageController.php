<?php

namespace App\Http\Controllers\Api;

use App\Enums\ImageType;
use App\Http\Controllers\Controller;
use App\Http\Resources\ContentImageResource;
use App\Models\ContentImage;
use App\Models\ContentPost;
use App\Services\AI\ImagePromptService;
use App\Services\AI\SnippetService;
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

    public function suggestSnippet(Request $request, ContentPost $post, SnippetService $service): ContentImageResource
    {
        ['image' => $image] = $service->suggestFor($post, $request->boolean('force'));

        return new ContentImageResource($image);
    }

    public function generatePrompt(ContentPost $post, ImagePromptService $service): ContentImageResource
    {
        ['image' => $image] = $service->generateFor($post);

        return new ContentImageResource($image);
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
