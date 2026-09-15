<?php

namespace Tests\Feature;

use App\Jobs\RevisePostJob;
use App\Jobs\ScorePostQualityJob;
use App\Models\ContentPost;
use App\Models\PostRevision;
use App\Models\Trend;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PostRevisionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Sanctum::actingAs(User::factory()->create());
    }

    private function makePost(array $attributes = []): ContentPost
    {
        $trend = Trend::query()->create([
            'title' => 'Barrel files and tree-shaking',
            'status' => 'discovered',
            'trend_score' => 70,
        ]);

        return ContentPost::query()->create(array_merge([
            'trend_id' => $trend->id,
            'title' => 'Barrel file fix',
            'hook' => 'Your barrel file might be hurting your bundle.',
            'body' => "Your barrel file might be hurting your bundle.\n\nBarrel files always break tree-shaking.\n\nTry direct imports.",
            'format' => 'quick_tip',
            'tone' => 'technical',
            'status' => 'draft',
        ], $attributes));
    }

    public function test_store_queues_a_revision_and_snapshots_the_post(): void
    {
        Queue::fake();
        $post = $this->makePost();

        $response = $this->postJson("/api/posts/{$post->id}/revisions", [
            'target' => 'body',
            'instruction' => 'Barrel files do not always break tree-shaking — add nuance.',
        ]);

        $response->assertStatus(202)
            ->assertJsonPath('data.status', PostRevision::STATUS_PENDING)
            ->assertJsonPath('data.target', 'body');

        $this->assertDatabaseHas('post_revisions', [
            'content_post_id' => $post->id,
            'target' => 'body',
            'status' => PostRevision::STATUS_PENDING,
            'hook_before' => $post->hook,
        ]);

        Queue::assertPushed(RevisePostJob::class);
    }

    public function test_store_supersedes_a_previous_pending_suggestion_for_the_same_target(): void
    {
        Queue::fake();
        $post = $this->makePost();

        $base = [
            'content_post_id' => $post->id,
            'target' => 'hook',
            'instruction' => 'first attempt',
            'body_before' => $post->body,
            'status' => PostRevision::STATUS_PENDING,
        ];

        PostRevision::query()->create($base);
        PostRevision::query()->create([...$base, 'instruction' => 'second attempt']);

        $this->postJson("/api/posts/{$post->id}/revisions", [
            'target' => 'hook',
            'instruction' => 'third attempt',
        ])->assertStatus(202);

        // One pending suggestion per target — older ones are superseded.
        $this->assertSame(1, PostRevision::query()
            ->where('content_post_id', $post->id)
            ->where('target', 'hook')
            ->where('status', PostRevision::STATUS_PENDING)
            ->count());

        $this->assertSame(2, PostRevision::query()
            ->where('status', PostRevision::STATUS_DISCARDED)
            ->count());
    }

    public function test_apply_rejects_a_revision_that_is_not_ready(): void
    {
        Queue::fake();
        $post = $this->makePost();

        $revision = PostRevision::query()->create([
            'content_post_id' => $post->id,
            'target' => 'body',
            'instruction' => 'fix it',
            'body_before' => $post->body,
            'status' => PostRevision::STATUS_PENDING,
        ]);

        $this->postJson("/api/posts/{$post->id}/revisions/{$revision->id}/apply")
            ->assertStatus(422);
    }

    public function test_apply_writes_only_the_targeted_field_and_creates_a_version(): void
    {
        Queue::fake();
        $post = $this->makePost();

        $revision = PostRevision::query()->create([
            'content_post_id' => $post->id,
            'target' => 'body',
            'instruction' => 'fix it',
            'hook_before' => $post->hook,
            'body_before' => $post->body,
            'hook_after' => null,
            'body_after' => 'Barrel files are not always the problem.',
            'status' => PostRevision::STATUS_READY,
        ]);

        $this->postJson("/api/posts/{$post->id}/revisions/{$revision->id}/apply")
            ->assertOk();

        $fresh = $post->fresh();

        // Body-only write: the hook field is untouched.
        $this->assertSame($post->hook, $fresh->hook);
        $this->assertSame('Barrel files are not always the problem.', $fresh->body);
        $this->assertSame(PostRevision::STATUS_APPLIED, $revision->fresh()->status);
        $this->assertSame(1, $fresh->versions()->count());

        Queue::assertPushed(ScorePostQualityJob::class);
    }

    public function test_apply_with_a_hook_target_leaves_the_body_untouched(): void
    {
        Queue::fake();
        $post = $this->makePost();

        $revision = PostRevision::query()->create([
            'content_post_id' => $post->id,
            'target' => 'hook',
            'instruction' => 'sharpen the hook',
            'hook_before' => $post->hook,
            'body_before' => $post->body,
            'hook_after' => 'A sharper opening line.',
            'body_after' => null,
            'status' => PostRevision::STATUS_READY,
        ]);

        $this->postJson("/api/posts/{$post->id}/revisions/{$revision->id}/apply")
            ->assertOk()
            ->assertJsonPath('data.hook', 'A sharper opening line.');

        $fresh = $post->fresh();

        $this->assertSame('A sharper opening line.', $fresh->hook);
        $this->assertSame($post->body, $fresh->body);

        Queue::assertPushed(ScorePostQualityJob::class);
    }

    public function test_discard_marks_discarded_and_applied_cannot_be_discarded(): void
    {
        Queue::fake();
        $post = $this->makePost();

        $ready = PostRevision::query()->create([
            'content_post_id' => $post->id,
            'target' => 'hook',
            'instruction' => 'fix it',
            'body_before' => $post->body,
            'status' => PostRevision::STATUS_READY,
        ]);

        $this->postJson("/api/posts/{$post->id}/revisions/{$ready->id}/discard")
            ->assertOk();

        $this->assertSame(PostRevision::STATUS_DISCARDED, $ready->fresh()->status);

        $applied = PostRevision::query()->create([
            'content_post_id' => $post->id,
            'target' => 'body',
            'instruction' => 'done',
            'body_before' => $post->body,
            'status' => PostRevision::STATUS_APPLIED,
        ]);

        $this->postJson("/api/posts/{$post->id}/revisions/{$applied->id}/discard")
            ->assertStatus(422);
    }

    public function test_validation_rejects_bad_payloads(): void
    {
        Queue::fake();
        $post = $this->makePost();

        $this->postJson("/api/posts/{$post->id}/revisions", [
            'target' => 'subject',
            'instruction' => 'x',
        ])->assertStatus(422);

        $this->postJson("/api/posts/{$post->id}/revisions", [
            'target' => 'hook',
            'instruction' => '',
        ])->assertStatus(422);
    }
}
