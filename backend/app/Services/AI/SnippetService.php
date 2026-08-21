<?php

namespace App\Services\AI;

use App\Enums\ImageType;
use App\Models\ContentImage;
use App\Models\ContentPost;
use App\Services\AI\Concerns\LogsAiGenerations;

/**
 * Derives a shareable code-snippet card spec from a generated post.
 * The spec is rendered client-side (ray.so-style) — no server image work.
 * One snippet per post: regeneration replaces the spec.
 */
class SnippetService
{
    use LogsAiGenerations;

    public function __construct(
        private readonly AIManager $manager,
        private readonly PromptRegistry $prompts,
    ) {}

    /**
     * @return array{image: ContentImage, cached: bool}
     */
    public function suggestFor(ContentPost $post, bool $force = false): array
    {
        $requestHash = hash('sha256', implode('|', [
            'snippet',
            $post->id,
            md5($post->body),
        ]));

        $existing = ContentImage::query()
            ->where('content_post_id', $post->id)
            ->where('type', ImageType::CodeSnippet->value)
            ->first();

        if (! $force && $existing !== null && $existing->spec !== null) {
            return ['image' => $existing, 'cached' => true];
        }

        $prompt = $this->prompts->render('snippet.user', [
            'post_body' => str($post->body)->limit(3000),
        ]);

        $response = $this->manager->provider()->complete(
            $this->prompts->get('snippet.system'),
            $prompt,
        );

        $data = $response->data;

        $spec = [
            // Default card styling lives client-side; AI only supplies content.
            'code' => str((string) ($data['code'] ?? '// nothing to show'))->limit(1200),
            'language' => in_array(($data['language'] ?? 'other'), [
                'php', 'javascript', 'typescript', 'python', 'sql', 'bash', 'go', 'rust',
            ], true) ? $data['language'] : 'other',
            'title' => str((string) ($data['title'] ?? 'Snippet'))->limit(60),
        ];

        $image = ContentImage::query()->updateOrCreate(
            ['content_post_id' => $post->id, 'type' => ImageType::CodeSnippet->value],
            [
                'status' => 'ready',
                'spec' => $spec,
                'generated_at' => now(),
            ],
        );

        $this->logGeneration(
            provider: class_basename($this->manager->provider()),
            kind: 'snippet',
            idempotencyKey: hash('sha256', "snippet|{$post->id}|".uniqid()),
            requestHash: $requestHash,
            response: $response,
            postId: $post->id,
        );

        return ['image' => $image, 'cached' => false];
    }
}
