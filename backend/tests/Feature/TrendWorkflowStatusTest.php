<?php

namespace Tests\Feature;

use App\Enums\TrendWorkflowStatus;
use App\Models\Trend;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TrendWorkflowStatusTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Sanctum::actingAs(User::factory()->create());
    }

    private function trend(array $attributes = []): Trend
    {
        return Trend::query()->create(array_merge([
            'title' => 'A trend',
            'status' => 'discovered',
            'trend_score' => 60,
        ], $attributes));
    }

    public function test_new_trends_default_to_draft(): void
    {
        $trend = $this->trend();

        $this->assertSame(TrendWorkflowStatus::Draft, $trend->workflow_status);
    }

    public function test_it_marks_a_trend_ready_and_posted(): void
    {
        $trend = $this->trend();

        $this->patchJson("/api/trends/{$trend->id}/workflow-status", ['status' => 'ready'])
            ->assertOk()
            ->assertJsonPath('data.workflow_status', 'ready')
            ->assertJsonPath('data.workflow_status_label', 'Ready');

        $this->patchJson("/api/trends/{$trend->id}/workflow-status", ['status' => 'posted'])
            ->assertOk()
            ->assertJsonPath('data.workflow_status', 'posted');

        $this->assertSame(TrendWorkflowStatus::Posted, $trend->fresh()->workflow_status);
    }

    public function test_it_rejects_unknown_statuses(): void
    {
        $trend = $this->trend();

        $this->patchJson("/api/trends/{$trend->id}/workflow-status", ['status' => 'published'])
            ->assertStatus(422);

        $this->assertSame(TrendWorkflowStatus::Draft, $trend->fresh()->workflow_status);
    }

    public function test_the_trends_index_filters_by_workflow_status(): void
    {
        $ready = $this->trend(['title' => 'Ready trend', 'workflow_status' => 'ready']);
        $this->trend(['title' => 'Draft trend']);

        $response = $this->getJson('/api/trends?workflow_status=ready')
            ->assertOk();

        $titles = collect($response->json('data'))->pluck('title')->all();

        $this->assertContains($ready->title, $titles);
        $this->assertNotContains('Draft trend', $titles);
    }

    public function test_posted_trends_are_not_offered_as_nightly_candidates(): void
    {
        $posted = $this->trend([
            'title' => 'Already posted',
            'workflow_status' => 'posted',
            'usefulness_score' => 90,
            'focus_score' => 100,
            'saturation_score' => 20,
        ]);
        $draft = $this->trend([
            'title' => 'Still draft',
            'usefulness_score' => 80,
            'focus_score' => 100,
            'saturation_score' => 20,
        ]);

        $ids = app(\App\Repositories\Contracts\TrendRepositoryInterface::class)
            ->dailyCandidates()
            ->pluck('id');

        $this->assertFalse($ids->contains($posted->id));
        $this->assertTrue($ids->contains($draft->id));
    }
}
