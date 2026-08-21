<?php

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

Route::get('/dashboard', function (): JsonResponse {
    return response()->json([
        'message' => 'Dashboard aggregate endpoint — implemented in Phase 4.',
    ]);
});
