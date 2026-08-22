<?php

/**
 * Phase 7.7 verification: cheapest-first fallback chain.
 * Simulates an ox-alpha-free outage; asserts MiMo-V2.5 serves instead.
 */

require __DIR__.'/vendor/autoload.php';

$app = require __DIR__.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Services\AI\OpenCodeGoProvider;
use App\Services\AI\PromptRegistry;
use Illuminate\Support\Facades\Http;

App\Models\SystemSetting::put('ai.model', 'ox-alpha-free', 'ai');

$seen = [];

Http::fake(function (Illuminate\Http\Client\Request $request) use (&$seen) {
    $body = json_decode($request->body(), true);
    $model = $body['model'] ?? 'unknown';
    $seen[] = $model;

    // Simulate an outage on the primary model.
    if ($model === 'ox-alpha-free') {
        return Http::response([
            'type' => 'error',
            'error' => ['type' => 'error', 'message' => 'Internal server error'],
        ], 500);
    }

    return Http::response([
        'choices' => [[
            'message' => ['role' => 'assistant', 'content' => '{"ok": true}'],
            'finish_reason' => 'stop',
        ]],
        'usage' => ['prompt_tokens' => 10, 'completion_tokens' => 5],
    ]);
});

$provider = new OpenCodeGoProvider(new PromptRegistry());
$response = $provider->complete('Return ONLY valid JSON.', 'Produce {"ok": true}.');

echo 'chain: ['.implode(', ', $seen).']'.PHP_EOL;
echo 'served_by: '.$response->model.PHP_EOL;
echo 'data: '.json_encode($response->data).PHP_EOL;

$fellBack = $response->model === 'mimo-v2.5';
$ok = json_encode($response->data) === '{"ok":true}';

echo ($fellBack && $ok ? 'FALLBACK_TEST_PASSED' : 'FALLBACK_TEST_FAILED').PHP_EOL;
