<?php

namespace Tests\Feature;

use App\Models\ContentPost;
use App\Models\Source;
use App\Models\SourceItem;
use App\Models\Trend;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CleanupOldTrendsTest extends TestCase
{
    use RefreshDatabase;

    private function trend(array $attributes = []): Trend
    {
        return Trend::query()->create(array_merge([
            'title' => 'A trend',
            'status' => 'discovered',
            'trend_score' => 60,
            'last_seen_at' => now(),
        ], $attributes));
    }

    private function sourceItem(): SourceItem
    {
        $source = Source::query()->create([
            'name' => 'test-source-'.uniqid(),
            'type' => 'rss',
            'is_enabled' => true,
        ]);

        return SourceItem::query()->create([
            'source_id' => $source->id,
            'external_id' => 'ext-'.uniqid(),
            'url' => 'https://example.com/post',
            'title' => 'A story',
            'content_hash' => hash('sha256', uniqid()),
        ]);
    }

    public function test_it_hides_stale_trends_but_keeps_their_posts(): void
    {
        $stale = $this->trend(['title' => 'Old trend', 'last_seen_at' => now()->subDays(3)]);
        $fresh = $this->trend(['title' => 'Fresh trend', 'last_seen_at' => now()]);

        $post = ContentPost::query()->create([
            'trend_id' => $stale->id,
            'title' => 'Generated post',
            'hook' => 'A hook',
            'body' => str_repeat('body ', 100),
            'format' => 'quick_tip',
            'tone' => 'technical',
            'status' => 'ready',
        ]);

        $this->artisan('trends:cleanup')->assertSuccessful();

        $this->assertSoftDeleted('trends', ['id' => $stale->id]);
        $this->assertNull($fresh->fresh()->deleted_at);

        // The generated post survives the trend cleanup.
        $this->assertDatabaseHas('content_posts', [
            'id' => $post->id,
            'trend_id' => $stale->id,
        ]);
    }

    public function test_it_detaches_source_items_before_hiding_a_trend(): void
    {
        $stale = $this->trend(['last_seen_at' => now()->subDays(3)]);
        $item = $this->sourceItem();
        $stale->sourceItems()->attach($item->id);

        $this->artisan('trends:cleanup')->assertSuccessful();

        $this->assertDatabaseMissing('trend_source_item', [
            'trend_id' => $stale->id,
            'source_item_id' => $item->id,
        ]);
        $this->assertDatabaseHas('source_items', ['id' => $item->id]);
    }

    public function test_missing_last_seen_falls_back_to_created_at(): void
    {
        $stale = $this->trend([
            'title' => 'Never re-seen',
            'last_seen_at' => null,
        ]);

        // Eloquent stamps created_at on insert — backdate it explicitly.
        $stale->forceFill(['created_at' => now()->subDays(4)])->save();

        $this->artisan('trends:cleanup')->assertSuccessful();

        $this->assertSoftDeleted('trends', ['id' => $stale->id]);
    }

    public function test_dry_run_changes_nothing(): void
    {
        $stale = $this->trend(['last_seen_at' => now()->subDays(3)]);

        $this->artisan('trends:cleanup', ['--dry-run' => true])
            ->expectsOutputToContain('would be hidden')
            ->assertSuccessful();

        $this->assertNull($stale->fresh()->deleted_at);
    }
}
