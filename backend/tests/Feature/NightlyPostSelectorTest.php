<?php

namespace Tests\Feature;

use App\Enums\ContentFormat;
use App\Enums\TrendStatus;
use App\Models\ContentPost;
use App\Models\Trend;
use App\Repositories\Contracts\TrendRepositoryInterface;
use App\Services\NightlyPostSelector;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class NightlyPostSelectorTest extends TestCase
{
    use RefreshDatabase;

    private function trend(array $attributes = []): Trend
    {
        return Trend::query()->create(array_merge([
            'title' => 'Practical optimization guide',
            'status' => TrendStatus::Discovered,
            'trend_score' => 60,
            'usefulness_score' => 80,
            'focus_score' => 100,
            'novelty_score' => 80,
            'saturation_score' => 20,
            'item_count' => 3,
            'metrics' => [],
        ], $attributes));
    }

    public function test_daily_candidates_order_by_composite_and_drop_junk(): void
    {
        $best = $this->trend(['title' => 'Best', 'trend_score' => 80, 'usefulness_score' => 90, 'focus_score' => 100]);
        $mid = $this->trend(['title' => 'Middle', 'trend_score' => 60, 'usefulness_score' => 80, 'focus_score' => 100]);
        $low = $this->trend(['title' => 'Low', 'trend_score' => 50, 'usefulness_score' => 55, 'focus_score' => 50]);
        $archived = $this->trend(['title' => 'Archived', 'status' => TrendStatus::Archived]);
        $saturated = $this->trend(['title' => 'Saturated', 'saturation_score' => 90]);
        $weak = $this->trend(['title' => 'Weak', 'usefulness_score' => 40]);

        $ids = app(TrendRepositoryInterface::class)->dailyCandidates()->pluck('id')->all();

        $this->assertSame([$best->id, $mid->id, $low->id], array_slice($ids, 0, 3));
        $this->assertNotContains($archived->id, $ids);
        $this->assertNotContains($saturated->id, $ids);
        $this->assertNotContains($weak->id, $ids);
    }

    public function test_candidates_prefer_practical_material_over_a_higher_scoring_generic_trend(): void
    {
        $generic = $this->trend(['title' => 'Vendor ships a major release', 'trend_score' => 80, 'usefulness_score' => 90]);
        $practical = $this->trend(['title' => 'Index tips that speed up slow queries', 'trend_score' => 50, 'usefulness_score' => 70]);

        $first = app(NightlyPostSelector::class)->candidates()->first();

        $this->assertNotNull($first);
        $this->assertSame($practical->id, $first->id);
        $this->assertNotSame($generic->id, $first->id);
    }

    public function test_candidates_exclude_trends_posted_in_the_recency_window(): void
    {
        $posted = $this->trend(['title' => 'Already covered this week']);
        $fresh = $this->trend(['title' => 'Brand new tip']);

        ContentPost::query()->create([
            'trend_id' => $posted->id,
            'title' => 'Covered',
            'body' => str_repeat('body ', 100),
            'format' => 'quick_tip',
            'tone' => 'technical',
            'status' => 'review',
            'generated_at' => now(),
        ]);

        $ids = app(NightlyPostSelector::class)->candidates()->pluck('id');

        $this->assertFalse($ids->contains($posted->id));
        $this->assertTrue($ids->contains($fresh->id));
    }

    public function test_format_matches_sql_topics(): void
    {
        $trend = $this->trend(['title' => 'Speeding up slow Postgres queries with indexes']);

        $this->assertSame(ContentFormat::SqlHack, app(NightlyPostSelector::class)->resolveFormat($trend));
    }

    public function test_format_override_wins(): void
    {
        $trend = $this->trend(['title' => 'Anything at all']);

        $this->assertSame(
            ContentFormat::CaseStudy,
            app(NightlyPostSelector::class)->resolveFormat($trend, 'case_study'),
        );
    }

    public function test_format_rotation_differs_between_consecutive_days(): void
    {
        $trend = $this->trend(['title' => 'A generic release note']);
        $selector = app(NightlyPostSelector::class);

        $dayOne = $selector->resolveFormat($trend, null, Carbon::create(2026, 1, 1));
        $dayTwo = $selector->resolveFormat($trend, null, Carbon::create(2026, 1, 2));

        $this->assertContains($dayOne->value, NightlyPostSelector::USEFUL_FORMATS);
        $this->assertNotSame($dayOne, $dayTwo);
    }
}
