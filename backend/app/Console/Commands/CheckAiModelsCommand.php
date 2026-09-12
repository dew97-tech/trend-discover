<?php

namespace App\Console\Commands;

use App\Models\SystemSetting;
use App\Services\AI\ModelCatalogService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class CheckAiModelsCommand extends Command
{
    protected $signature = 'ai:check-models {--model= : Probe only this allowlisted model id}';

    protected $description = 'Probe each allowlisted + auto-discovered model and report what is actually working';

    public function handle(ModelCatalogService $catalog): int
    {
        $profiles = config('ai.providers.opencode_go.allowed_models', []);
        $only = $this->option('model');

        $targets = [];

        foreach ($profiles as $id => $profile) {
            $targets[$id] = ['profile' => $profile, 'source' => 'allowlist'];
        }

        foreach ($catalog->autoModels() as $auto) {
            $id = (string) ($auto['id'] ?? '');

            if ($id === '' || isset($targets[$id])) {
                continue;
            }

            $targets[$id] = ['profile' => null, 'source' => 'auto'];
        }

        if ($only !== null) {
            if (! isset($targets[$only])) {
                $this->error("Model [{$only}] is neither allowlisted nor auto-discovered.");

                return self::FAILURE;
            }

            $targets = [$only => $targets[$only]];
        }

        $active = (string) (SystemSetting::get('ai.model') ?? config('ai.providers.opencode_go.model'));
        $rows = [];
        $failed = false;
        $activeOk = null;

        foreach ($targets as $id => $target) {
            $result = $catalog->probe($id, $target['profile']);
            $rows[] = [
                $id,
                $target['source'],
                $result['ok'] ? '<info>working</info>' : '<error>FAILED</error>',
                $result['latency_ms'].'ms',
                $result['ok'] ? 'JSON ok' : ($result['error'] ?? ''),
            ];

            if (! $result['ok']) {
                $failed = true;
            }

            if ($id === $active) {
                $activeOk = $result['ok'];
            }

            Log::channel('pipeline')->info('[ai:check-models] probe', [
                'model' => $id,
                'source' => $target['source'],
                'ok' => $result['ok'],
                'latency_ms' => $result['latency_ms'],
                'error' => $result['error'],
            ]);
        }

        $this->table(['model', 'source', 'status', 'latency', 'note'], $rows);

        if (! isset($targets[$active])) {
            $this->warn("Active model [{$active}] is not in the allowlist or auto fallbacks — provider will self-heal.");
        } elseif ($activeOk === false) {
            $this->error("Active model [{$active}] is BROKEN — switch it in Settings or run ai:refresh-models.");

            return self::FAILURE;
        }

        return $failed ? self::FAILURE : self::SUCCESS;
    }
}
