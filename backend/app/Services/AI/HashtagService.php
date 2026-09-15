<?php

namespace App\Services\AI;

use App\Models\ContentPost;
use App\Services\AI\Concerns\LogsAiGenerations;
use App\Support\Hashtags;

/**
 * Intelligent hashtag selection for a single post: grounds tags in the post
 * body + the trend's technologies, then normalizes to LinkedIn-safe values.
 * Used on demand for posts generated before hashtag support landed.
 */
class HashtagService
{
    use LogsAiGenerations;

    public function __construct(
        private readonly AIManager $manager,
        private readonly PromptRegistry $prompts,
    ) {}

    /**
     * @return list<string>
     */
    public function generate(ContentPost $post): array
    {
        $trend = $post->trend()->withTrashed()->first();

        $technologies = $trend !== null
            ? $trend->technologies()->pluck('name')->implode(', ')
            : '';

        // Hook and body are stored separately — feed the whole post.
        $fullText = trim(($post->hook !== null ? $post->hook."\n\n" : '').$post->body);

        $requestHash = hash('sha256', 'hashtags|'.$post->id.'|'.md5($fullText));

        $prompt = $this->prompts->render('hashtags.user', [
            'post_body' => (string) str($fullText)->limit(2500),
            'trend_title' => $trend?->title ?? 'not provided',
            'technologies' => $technologies !== '' ? $technologies : 'not provided',
        ]);

        $started = now()->getTimestampMs();

        try {
            $response = $this->manager->provider()->complete(
                $this->prompts->get('hashtags.system'),
                $prompt,
            );
        } catch (\Throwable $e) {
            $this->logFailure(
                $this->manager,
                'hashtags',
                $requestHash,
                $e,
                postId: $post->id,
                durationMs: max(0, now()->getTimestampMs() - $started),
            );

            throw $e;
        }

        $this->logGeneration(
            provider: class_basename($this->manager->provider()),
            kind: 'hashtags',
            idempotencyKey: hash('sha256', "hashtags|{$post->id}|".uniqid()),
            requestHash: $requestHash,
            response: $response,
            postId: $post->id,
        );

        return Hashtags::sanitize($response->data['hashtags'] ?? []);
    }
}
