<?php

namespace App\Console\Commands;

use App\Services\AI\ModelCatalogService;
use Illuminate\Console\Command;

class RefreshAiModelsCommand extends Command
{
    protected $signature = 'ai:refresh-models';

    protected $description = 'Discover the best working gateway models and store them as automatic fallbacks';

    public function handle(ModelCatalogService $catalog): int
    {
        $this->line('Fetching live model roster from the gateway…');

        $roster = $catalog->roster();

        if ($roster === []) {
            $this->error('Gateway roster is empty or unreachable — check the API key and network.');

            return self::FAILURE;
        }

        $this->info(count($roster).' models on the gateway; probing the best candidates (this takes ~30s)…');

        $chosen = $catalog->refreshBest();

        if ($chosen === []) {
            $this->error('No working candidates found. Run `php artisan ai:check-models` for details.');

            return self::FAILURE;
        }

        $this->table(
            ['model', 'label', 'latency', 'score'],
            array_map(fn (array $m) => [
                $m['id'],
                $m['label'],
                $m['latency_ms'].'ms',
                number_format((float) $m['score'], 1),
            ], $chosen),
        );

        $this->info('Stored as automatic fallbacks in system_settings(ai.auto_models).');

        return self::SUCCESS;
    }
}
