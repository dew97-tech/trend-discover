<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\JobRunResource;
use App\Http\Resources\SourceResource;
use App\Jobs\CollectSourceItemsJob;
use App\Models\Source;
use App\Repositories\Contracts\JobRunRepositoryInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class SourceController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return SourceResource::collection(
            Source::query()
                ->withCount('items')
                ->orderBy('name')
                ->get(),
        );
    }

    public function collectNow(Request $request, Source $source): JsonResponse
    {
        if (! $source->is_enabled) {
            return response()->json([
                'message' => "Source [{$source->name}] is disabled.",
            ], 422);
        }

        CollectSourceItemsJob::dispatch($source);

        return response()->json([
            'message' => "Collection queued for [{$source->name}].",
            'source' => new SourceResource($source->loadCount('items')),
        ], 202);
    }
}
