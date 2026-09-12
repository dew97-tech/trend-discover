<?php

namespace App\Console\Commands;

use App\Models\SystemSetting;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class CheckAiModelsCommand extends Command
{
    protected $signature = 'ai:check-models {--model= : Probe only this allowlisted model id}';

    protected $description = 'Probe each allowlisted OpenCode Go model with a tiny request and report what is actually working';

    public function handle(): int
    {
        $profiles = config('ai.providers.opencode_go.allowed_models', []);
        $only = $this->option('model');

        if ($only !== null && ! isset($profiles[$only])) {
            $this->error("Model [{$only}] is not allowlisted.");

            return self::FAILURE;
        }

        $targets = $only !== null ? [$only => $profiles[$only]] : $profiles;

        $active = (string) (SystemSetting::get('ai.model') ?? config('ai.providers.opencode_go.model'));
        $rows = [];
        $failed = false;
        $activeOk = null;

        foreach ($targets as $id => $profile) {
            $started = now()->getTimestampMs();
            [$ok, $note] = $this->probe($id, $profile);
            $ms = now()->getTimestampMs() - $started;

            $rows[] = [$id, $ok ? '<info>working</info>' : '<error>FAILED</error>', "{$ms}ms", $note];

            if (! $ok) {
                $failed = true;
            }

            if ($id === $active) {
                $activeOk = $ok;
            }

            Log::channel('pipeline')->info('[ai:check-models] probe', [
                'model' => $id,
                'ok' => $ok,
                'duration_ms' => $ms,
                'note' => $note,
            ]);
        }

        $this->table(['model', 'status', 'latency', 'note'], $rows);

        if (! isset($profiles[$active])) {
            $this->warn("Active model [{$active}] is not allowlisted — provider will fall back to config default.");
        } elseif ($activeOk === false) {
            $this->error("Active model [{$active}] is BROKEN — switch it in Settings.");

            return self::FAILURE;
        }

        return $failed ? self::FAILURE : self::SUCCESS;
    }

    /**
     * @return array{0: bool, 1: string}
     */
    private function probe(string $model, array $profile): array
    {
        // Reasoning models need real budget: glm-5.3-flash rejects
        // max_tokens <= 1024 ("must be greater than 1024 ... reasoning enabled").
        $maxTokens = (int) ($profile['max_output'] ?? config('ai.max_tokens_per_call', 4096));
        $maxTokens = max(1500, min(2048, $maxTokens));

        $body = [
            'model' => $model,
            'messages' => [['role' => 'user', 'content' => 'Return JSON {"ok":true}']],
            'max_tokens' => $maxTokens,
            'response_format' => ['type' => 'json_object'],
        ];

        if ($profile['reasoning'] ?? false) {
            $body['reasoning_effort'] = (string) ($profile['effort'] ?? 'low');
        }

        try {
            $response = Http::baseUrl($this->apiRoot())
                ->timeout(60)
                ->withToken((string) config('ai.providers.opencode_go.api_key'))
                ->withHeaders(['x-opencode-session' => $this->sessionId()])
                ->post('/chat/completions', $body);
        } catch (\Throwable $e) {
            return [false, str($e->getMessage())->limit(120)->toString()];
        }

        if ($response->failed()) {
            return [false, "HTTP {$response->status()} ".str($response->body())->limit(90)];
        }

        $content = trim((string) ($response->json('choices.0.message.content') ?? ''));

        if ($content === '') {
            return [false, 'empty content (reasoning exhausted budget)'];
        }

        return [true, 'JSON: '.str($content)->limit(40)];
    }

    private function apiRoot(): string
    {
        $url = rtrim(trim((string) config('ai.providers.opencode_go.base_url')), '/');

        if (str_ends_with($url, '/chat/completions')) {
            $url = substr($url, 0, -strlen('/chat/completions'));
        }

        return rtrim($url, '/');
    }

    private function sessionId(): string
    {
        $configured = trim((string) config('ai.providers.opencode_go.session_id'));

        if ($configured !== '') {
            return $configured;
        }

        $stored = SystemSetting::get('ai.session_id');

        if (is_string($stored) && trim($stored) !== '') {
            return $stored;
        }

        $generated = (string) Str::uuid();

        SystemSetting::put('ai.session_id', $generated, group: 'ai');

        return $generated;
    }
}
