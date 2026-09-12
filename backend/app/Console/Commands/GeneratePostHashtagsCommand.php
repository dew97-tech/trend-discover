<?php

namespace App\Console\Commands;

use App\Jobs\GenerateHashtagsJob;
use App\Models\ContentPost;
use Illuminate\Console\Command;

class GeneratePostHashtagsCommand extends Command
{
    protected $signature = 'posts:generate-hashtags {--missing : Only posts that have no hashtags yet}';

    protected $description = 'Queue AI hashtag generation for existing posts';

    public function handle(): int
    {
        $query = ContentPost::query();

        if ($this->option('missing')) {
            $query->whereNull('hashtags');
        }

        $ids = $query->pluck('id');

        $ids->each(fn (int $id) => GenerateHashtagsJob::dispatch($id));

        $this->info("Queued hashtag generation for {$ids->count()} post(s).");
        $this->line('Run a queue worker to process them: php artisan queue:work');

        return self::SUCCESS;
    }
}
