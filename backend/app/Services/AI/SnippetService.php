<?php

namespace App\Services\AI;

use App\Enums\ImageType;
use App\Models\ContentImage;
use App\Models\ContentPost;
use App\Services\AI\Concerns\LogsAiGenerations;

/**
 * Derives a shareable code-snippet card spec from a generated post.
 * The spec is rendered client-side (ray.so-style) — no server image work.
 *
 * Flow (async since Phase 7.6): the controller creates a PENDING row and
 * queues SuggestSnippetJob; this service performs only the AI call and
 * returns the raw spec. The job fills the row and flips status to ready.
 */
class SnippetService
{
    use LogsAiGenerations;

    public function __construct(
        private readonly AIManager $manager,
        private readonly PromptRegistry $prompts,
    ) {}

    /**
     * Pure AI derivation — no database writes.
     *
     * @return array{code: string, language: string, title: string}
     */
    public function buildSpec(ContentPost $post): array
    {
        $requestHash = hash('sha256', implode('|', [
            'snippet',
            $post->id,
            md5($post->body),
        ]));

        $prompt = $this->prompts->render('snippet.user', [
            'post_body' => str($post->body)->limit(3000),
        ]);

        $started = now()->getTimestampMs();

        try {
            $response = $this->manager->provider()->complete(
                $this->prompts->get('snippet.system'),
                $prompt,
            );
        } catch (\Throwable $e) {
            $this->logFailure($this->manager, 'snippet', $requestHash, $e, postId: $post->id, durationMs: max(0, now()->getTimestampMs() - $started));

            throw $e;
        }

        $data = $response->data;

        $this->logGeneration(
            provider: class_basename($this->manager->provider()),
            kind: 'snippet',
            idempotencyKey: hash('sha256', "snippet|{$post->id}|".uniqid()),
            requestHash: $requestHash,
            response: $response,
            postId: $post->id,
        );

        return [
            'code' => str((string) ($data['code'] ?? '// nothing to show'))->limit(1200),
            'language' => in_array(($data['language'] ?? 'other'), [
                'php', 'javascript', 'typescript', 'tsx', 'jsx', 'python', 'sql',
                'bash', 'go', 'rust', 'json', 'yaml', 'html', 'css', 'java',
                'csharp', 'c', 'cpp', 'dockerfile',
            ], true) ? $data['language'] : 'other',
            'title' => str((string) ($data['title'] ?? 'Snippet'))->limit(60),
        ];
    }

    public function hasReadySnippet(ContentPost $post): bool
    {
        return ContentImage::query()
            ->where('content_post_id', $post->id)
            ->where('type', ImageType::CodeSnippet->value)
            ->where('status', 'ready')
            ->exists();
    }
}
