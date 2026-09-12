<?php

/**
 * AI fallback verification:
 *  A. gateway session header is sent + allowlist chain falls back on outage
 *  B. when the whole allowlist is down, an auto-discovered model serves
 *
 * Run: php scripts/verify-ai-fallback.php
 */

require __DIR__.'/../vendor/autoload.php';

$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Services\AI\ModelCatalogService;
use App\Services\AI\OpenCodeGoProvider;
use App\Services\AI\PromptRegistry;
use Illuminate\Support\Facades\Http;

$provider = new OpenCodeGoProvider(new PromptRegistry());
$autoModels = array_column(app(ModelCatalogService::class)->autoModels(), 'id');

// A single fake registration; the active outage list is swapped per scenario
// (multiple Http::fake() calls stack callbacks in Laravel, which breaks this).
$state = ['outage' => [], 'seen' => [], 'missingSession' => 0];

Http::fake(function (Illuminate\Http\Client\Request $request) use (&$state) {
    $body = json_decode($request->body(), true);
    $model = $body['model'] ?? 'unknown';
    $state['seen'][] = $model;

    if (! $request->hasHeader('x-opencode-session')) {
        $state['missingSession']++;
    }

    if (in_array($model, $state['outage'], true)) {
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

/**
 * @param  list<string>  $outage  models that simulated a 500
 * @return array{served_by: string, missing_session: int, data: string, chain: list<string>}
 */
function runScenario(OpenCodeGoProvider $provider, array &$state, array $outage, string $active): array
{
    App\Models\SystemSetting::put('ai.model', $active, 'ai');

    $state = ['outage' => $outage, 'seen' => [], 'missingSession' => 0];

    $response = $provider->complete('Return ONLY valid JSON.', 'Produce {"ok": true}.');

    return [
        'served_by' => $response->model,
        'missing_session' => $state['missingSession'],
        'data' => (string) json_encode($response->data),
        'chain' => $state['seen'],
    ];
}

// ── Scenario A: allowlist outage falls through to the next allowlist model ──
$a = runScenario($provider, $state, ['mimo-v2.5'], 'mimo-v2.5');

echo 'A chain: ['.implode(', ', $a['chain']).']'.PHP_EOL;
echo 'A served_by: '.$a['served_by'].PHP_EOL;

$passA = $a['served_by'] === 'deepseek-v4-flash' && $a['data'] === '{"ok":true}' && $a['missing_session'] === 0;

// ── Scenario B: entire allowlist down -> auto-discovered model serves ───────
$allowlist = array_keys(config('ai.providers.opencode_go.allowed_models', []));

if ($autoModels === []) {
    echo 'B skipped: no auto models stored (run php artisan ai:refresh-models)'.PHP_EOL;
    $passB = true;
} else {
    $b = runScenario($provider, $state, $allowlist, $allowlist[0]);

    echo 'B chain: ['.implode(', ', $b['chain']).']'.PHP_EOL;
    echo 'B served_by: '.$b['served_by'].PHP_EOL;

    $lastAllowlistPos = -1;

    foreach ($allowlist as $id) {
        $pos = array_search($id, $b['chain'], true);
        if ($pos !== false) {
            $lastAllowlistPos = max($lastAllowlistPos, $pos);
        }
    }

    $autoPos = array_search($b['served_by'], $b['chain'], true);

    $passB = in_array($b['served_by'], $autoModels, true)
        && $b['data'] === '{"ok":true}'
        && $b['missing_session'] === 0
        && $autoPos !== false
        && $autoPos > $lastAllowlistPos;

    if (! $passB) {
        echo 'B last allowlist attempt at #'.$lastAllowlistPos.', auto at #'.var_export($autoPos, true).PHP_EOL;
    }
}

// Leave the runtime model where it belongs.
App\Models\SystemSetting::put('ai.model', 'mimo-v2.5', 'ai');

echo (($passA && $passB) ? 'FALLBACK_TEST_PASSED' : 'FALLBACK_TEST_FAILED').PHP_EOL;
