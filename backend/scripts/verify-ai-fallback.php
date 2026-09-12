<?php

/**
 * AI fallback verification: gateway session header + model fallback chain.
 * Simulates a mimo-v2.5 outage; asserts deepseek-v4-flash serves instead and
 * that every attempt carried the required x-opencode-session header.
 */

require __DIR__.'/../vendor/autoload.php';

$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Services\AI\OpenCodeGoProvider;
use App\Services\AI\PromptRegistry;
use Illuminate\Support\Facades\Http;

App\Models\SystemSetting::put('ai.model', 'mimo-v2.5', 'ai');

$seen = [];
$missingSession = 0;

Http::fake(function (Illuminate\Http\Client\Request $request) use (&$seen, &$missingSession) {
    $body = json_decode($request->body(), true);
    $model = $body['model'] ?? 'unknown';
    $seen[] = $model;

    if (! $request->hasHeader('x-opencode-session')) {
        $missingSession++;
    }

    // Simulate an outage on the primary model.
    if ($model === 'mimo-v2.5') {
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
echo 'requests_without_session_header: '.$missingSession.PHP_EOL;

$fellBack = $response->model === 'deepseek-v4-flash';
$ok = json_encode($response->data) === '{"ok":true}';
$sessionOk = $missingSession === 0;

echo (($fellBack && $ok && $sessionOk) ? 'FALLBACK_TEST_PASSED' : 'FALLBACK_TEST_FAILED').PHP_EOL;
