<?php

namespace App\Services\AI;

use App\Models\Trend;
use App\Services\AI\Concerns\LogsAiGenerations;

class ResearchService
{
    use LogsAiGenerations;

    public function __construct(
        private readonly AIManager $manager,
        private readonly PromptRegistry $prompts,
    ) {}

    /**
     * Cached technical research for a trend. Cache key incorporates the
     * trend's signal state — new evidence invalidates prior research.
     *
     * @return array{research: array, cached: bool}
     */
    public function getOrGenerate(Trend $trend): array
    {
        $requestHash = $this->stateHash($trend);

        $cached = $this->findCached('research', $requestHash);

        if ($cached !== null && is_array($cached->result)) {
            return ['research' => $cached->result, 'cached' => true];
        }

        $signals = $trend->signals()
            ->where('type', 'source_coverage')
            ->get(['value'])
            ->map(fn ($signal) => [
                'title' => $signal->value['title'] ?? '',
                'source' => $signal->value['source'] ?? '',
                'metrics' => $signal->value['metrics'] ?? [],
            ])
            ->take(12)
            ->all();

        $prompt = $this->prompts->render('research.user', [
            'title' => $trend->title,
            'summary' => $trend->summary,
            'signals' => $signals,
        ]);

        $response = $this->manager->provider()->research($trend, $prompt);

        $generation = $this->logGeneration(
            provider: class_basename($this->manager->provider()),
            kind: 'research',
            idempotencyKey: hash('sha256', "research|{$trend->id}|{$requestHash}"),
            requestHash: $requestHash,
            response: $response,
            trendId: $trend->id,
        );

        // Persist the structured result on the generation row for reuse.
        $generation->forceFill(['result' => $response->data])->save();

        return ['research' => $response->data, 'cached' => false];
    }

    private function stateHash(Trend $trend): string
    {
        $latestSignalAt = $trend->signals()->max('detected_at');

        return hash('sha256', implode('|', [
            $trend->id,
            $trend->item_count,
            (string) ($trend->metrics['total_engagement'] ?? 0),
            (string) $latestSignalAt,
        ]));
    }
}
