<?php

namespace Tests\Feature;

use App\Models\ContentPost;
use App\Models\Trend;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SplitHooksCommandTest extends TestCase
{
    use RefreshDatabase;

    private ?int $trendId = null;

    private function makePost(string $hook, string $body): ContentPost
    {
        $this->trendId ??= Trend::query()->create([
            'title' => 'Hook separation test trend',
            'status' => 'discovered',
        ])->id;

        return ContentPost::query()->create([
            'trend_id' => $this->trendId,
            'title' => 'Test post',
            'hook' => $hook,
            'body' => $body,
            'format' => 'quick_tip',
            'tone' => 'technical',
            'status' => 'draft',
        ]);
    }

    public function test_dry_run_reports_without_saving_anything(): void
    {
        $matching = $this->makePost('The hook', "The hook\n\nContent here.");
        $mismatch = $this->makePost('Another hook', "Different first line\n\nContent.");

        $this->artisan('posts:split-hooks')
            ->expectsOutputToContain(sprintf(
                '#%d body %d → %d chars',
                $matching->id,
                mb_strlen("The hook\n\nContent here."),
                mb_strlen('Content here.'),
            ))
            ->assertSuccessful();

        $this->assertSame("The hook\n\nContent here.", $matching->fresh()->body);
        $this->assertSame("Different first line\n\nContent.", $mismatch->fresh()->body);
    }

    public function test_apply_strips_only_bodies_that_start_with_their_hook(): void
    {
        $matching = $this->makePost('The hook', "The hook\n\nContent here.");
        $mismatch = $this->makePost('Another hook', "Different first line\n\nContent.");

        $this->artisan('posts:split-hooks', ['--apply' => true])->assertSuccessful();

        $this->assertSame('Content here.', $matching->fresh()->body);
        $this->assertSame("Different first line\n\nContent.", $mismatch->fresh()->body);
    }
}
