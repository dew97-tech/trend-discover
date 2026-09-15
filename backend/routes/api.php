<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ContentImageController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\JobRunController;
use App\Http\Controllers\Api\PostController;
use App\Http\Controllers\Api\PostRevisionController;
use App\Http\Controllers\Api\SettingController;
use App\Http\Controllers\Api\SourceController;
use App\Http\Controllers\Api\TrendController;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Route;

Route::get('/health', function (): JsonResponse {
    return response()->json([
        'status' => 'ok',
        'app' => config('app.name'),
        'environment' => app()->environment(),
        'time' => now()->toIso8601String(),
    ]);
});

Route::prefix('auth')->middleware('throttle:auth')->group(function (): void {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
});

Route::middleware('auth:sanctum')->group(function (): void {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    Route::get('/dashboard', [DashboardController::class, 'index']);
    Route::get('/sources', [SourceController::class, 'index']);
    Route::patch('/sources/{source}', [SourceController::class, 'update']);
    Route::post('/sources/{source}/collect-now', [SourceController::class, 'collectNow']);
    Route::get('/jobs', [JobRunController::class, 'index']);
    Route::get('/jobs/{id}/log', [JobRunController::class, 'log']);

    // Manual pipeline triggers
    Route::post('/pipeline/detect', function (): JsonResponse {
        \App\Jobs\DetectTrendsJob::dispatch();

        \Illuminate\Support\Facades\Log::channel('pipeline')
            ->info('[PipelineController] detection dispatched manually');

        return response()->json(['message' => 'Trend detection queued.'], 202);
    });

    Route::get('/settings', [SettingController::class, 'index']);
    Route::patch('/settings', [SettingController::class, 'update']);
    Route::get('/settings/models', [SettingController::class, 'models']);
    Route::post('/settings/models/refresh', [SettingController::class, 'refreshModels']);

    Route::get('/taxonomy', [TrendController::class, 'taxonomy']);
    Route::get('/trends', [TrendController::class, 'index']);
    Route::get('/trends/{id}', [TrendController::class, 'show']);
    Route::post('/trends/{id}/rescore', [TrendController::class, 'rescore']);
    Route::patch('/trends/{id}/workflow-status', [TrendController::class, 'updateWorkflowStatus']);
    Route::post('/trends/{id}/generate', [TrendController::class, 'generate']);
    Route::delete('/trends/{id}', [TrendController::class, 'destroy']);
    Route::post('/trends/{id}/restore', [TrendController::class, 'restore']);

    Route::get('/posts', [PostController::class, 'index']);
    Route::get('/posts/grouped', [PostController::class, 'grouped']);
    Route::delete('/posts', [PostController::class, 'destroyByTrend']);
    Route::get('/posts/{id}', [PostController::class, 'show']);
    Route::patch('/posts/{id}', [PostController::class, 'update']);
    Route::delete('/posts/{id}', [PostController::class, 'destroy']);
    Route::post('/posts/{id}/status', [PostController::class, 'updateStatus']);
    Route::post('/posts/{id}/regenerate', [PostController::class, 'regenerate']);
    Route::post('/posts/{id}/hashtags', [PostController::class, 'generateHashtags']);

    // Visual assets for posts
    Route::get('/posts/{post}/images', [ContentImageController::class, 'index']);
    Route::post('/posts/{post}/images/snippet', [ContentImageController::class, 'suggestSnippet']);
    Route::post('/posts/{post}/images/prompt', [ContentImageController::class, 'generatePrompt']);
    Route::post('/posts/{post}/images/upload', [ContentImageController::class, 'upload']);
    Route::delete('/images/{id}', [ContentImageController::class, 'destroy']);

    // AI revision suggestions (hook/body corrections)
    Route::get('/posts/{post}/revisions', [PostRevisionController::class, 'index']);
    Route::post('/posts/{post}/revisions', [PostRevisionController::class, 'store']);
    Route::post('/posts/{post}/revisions/{revision}/apply', [PostRevisionController::class, 'apply']);
    Route::post('/posts/{post}/revisions/{revision}/discard', [PostRevisionController::class, 'discard']);
});
