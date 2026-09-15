<?php

namespace App\Console\Commands;

use App\Models\ContentPost;
use App\Support\LinkedInText;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

/**
 * One-time repair for pre-separation posts whose body still duplicates the
 * hook line. Dry-run by default; only strips when the first non-empty body
 * line matches the Hook field, so mismatched posts are reported, never guessed.
 */
class SplitPostHooksCommand extends Command
{
    protected $signature = 'posts:split-hooks
        {--apply : Persist the changes (default is a dry-run report)}
        {--post= : Only process a single post id}';

    protected $description = 'Strip the duplicated hook line from post bodies (hook/body separation backfill)';

    public function handle(): int
    {
        $query = ContentPost::query()
            ->whereNotNull('hook')
            ->orderBy('id');

        if ($this->option('post') !== null) {
            $query->whereKey((int) $this->option('post'));
        }

        $stripped = 0;
        $skipped = 0;

        $query->chunkById(100, function ($posts) use (&$stripped, &$skipped) {
            foreach ($posts as $post) {
                $body = (string) $post->body;
                $clean = LinkedInText::stripLeadingHookLine($body, $post->hook);

                if ($clean === $body) {
                    $skipped++;
                    $this->line("  #{$post->id} skipped — first body line doesn't match the hook");

                    continue;
                }

                if (trim($clean) === '') {
                    $skipped++;
                    $this->warn("  #{$post->id} skipped — stripping would empty the body");

                    continue;
                }

                $stripped++;
                $this->line(sprintf(
                    '  #%d body %d → %d chars',
                    $post->id,
                    mb_strlen($body),
                    mb_strlen($clean),
                ));

                if ($this->option('apply')) {
                    $post->forceFill([
                        'body' => $clean,
                        'word_count' => str_word_count($clean),
                    ])->save();
                }
            }
        });

        $this->info(sprintf(
            '%s: %d post(s) %s, %d skipped.',
            $this->option('apply') ? 'Applied' : 'Dry run',
            $stripped,
            $this->option('apply') ? 'updated' : 'would be updated',
            $skipped,
        ));

        if ($this->option('apply')) {
            Log::channel('pipeline')->info('[posts:split-hooks] applied', [
                'stripped' => $stripped,
                'skipped' => $skipped,
            ]);
        } else {
            $this->warn('Nothing saved — re-run with --apply to persist.');
        }

        return self::SUCCESS;
    }
}
