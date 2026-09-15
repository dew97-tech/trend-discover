<?php

namespace Tests\Feature;

use App\Jobs\CollectSourceItemsJob;
use App\Models\Source;
use Illuminate\Bus\PendingBatch;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Tests\TestCase;

class PipelineRunCommandTest extends TestCase
{
    use RefreshDatabase;

    private function source(string $name, bool $enabled = true): Source
    {
        return Source::query()->create([
            'name' => $name,
            'type' => 'rss',
            'is_enabled' => $enabled,
        ]);
    }

    public function test_it_batches_every_enabled_source_with_chained_detection_disabled(): void
    {
        Bus::fake();

        $this->source('alpha');
        $this->source('beta');
        $this->source('gamma', enabled: false);

        $this->artisan('pipeline:run')->assertSuccessful();

        Bus::assertBatched(function (PendingBatch $batch): bool {
            $this->assertSame('daily-pipeline', $batch->name);
            $this->assertSame(2, $batch->jobs->count());
            $this->assertTrue($batch->jobs->every(
                fn ($job) => $job instanceof CollectSourceItemsJob && $job->chainDetection === false,
            ));

            return true;
        });
    }

    public function test_dry_run_dispatches_nothing(): void
    {
        Bus::fake();

        $this->source('alpha');

        $this->artisan('pipeline:run', ['--dry-run' => true])
            ->expectsOutputToContain('would fetch 1 source')
            ->assertSuccessful();

        Bus::assertNothingBatched();
    }

    public function test_no_enabled_sources_is_a_no_op(): void
    {
        Bus::fake();

        $this->artisan('pipeline:run')
            ->expectsOutputToContain('No enabled sources')
            ->assertSuccessful();

        Bus::assertNothingBatched();
    }
}
