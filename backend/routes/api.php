<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\JobRunController;
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
    Route::post('/sources/{source}/collect-now', [SourceController::class, 'collectNow']);
    Route::get('/jobs', [JobRunController::class, 'index']);

    Route::get('/taxonomy', [TrendController::class, 'taxonomy']);
    Route::get('/trends', [TrendController::class, 'index']);
    Route::get('/trends/{id}', [TrendController::class, 'show']);
    Route::post('/trends/{id}/rescore', [TrendController::class, 'rescore']);
});
