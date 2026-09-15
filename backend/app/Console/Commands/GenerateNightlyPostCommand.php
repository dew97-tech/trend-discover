<?php

namespace App\Console\Commands;

use App\Enums\ContentFormat;
use App\Models\ContentPost;
use App\Models\Trend;
use App\Services\AI\PostGenerationService;
use App\Services\AI\PostSpec;
use App\Services\AI\QualityGateService;
use App\Services\AI\ResearchService;
use App\Services\NightlyPostSelector;
use App\Support\Hashtags;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;

/**
 * One-shot local workflow: pick the most useful trend of the day, generate a
 * LinkedIn post for it, print the paste-ready text to stdout and export it to
 * storage/app/private/daily-posts/{date}-{slug}.{md,txt}.
 */
class GenerateNightlyPostCommand extends Command
{
    protected $signature = 'posts:nightly
        {--trend= : Force a specific trend id}
        {--format= : Force a content format (e.g. optimization_tip)}
        {--force : Regenerate even if today\'s export already exists}
        {--dry-run : Show the ranked candidates and exit without calling the AI}';

    protected $description = 'Generate today\'s LinkedIn post from the most useful trend and export it';

    public function handle(
        NightlyPostSelector $selector,
        PostGenerationService $generation,
        QualityGateService $gate,
        ResearchService $research,
    ): int {
        $date = Carbon::now()->toDateString();

        $candidates = $selector->candidates();

        if ($candidates->isEmpty()) {
            $this->error('No suitable trends found. Run `php artisan trends:collect` + a queue worker first.');

            return self::FAILURE;
        }

        if ($this->option('dry-run')) {
            $this->renderCandidates($candidates, $selector);

            return self::SUCCESS;
        }

        $existing = $this->todaysPosts();

        if ($existing->isNotEmpty() && ! $this->option('force') && ! $this->option('trend')) {
            $this->warn("Today's post already generated (#{$existing->first()->id}). Use --force to generate another.");

            return self::SUCCESS;
        }

        if (PostGenerationService::dailyBudgetRemaining() < 4) {
            $this->error('Daily AI budget nearly exhausted — skipping. Try again tomorrow or raise the limit in Settings.');

            return self::FAILURE;
        }

        $trend = $candidates->first();

        if ($this->option('trend')) {
            $forced = Trend::query()
                ->with(['technologies:id,name,slug', 'category:id,name,slug'])
                ->find((int) $this->option('trend'));

            if ($forced === null) {
                $this->error("Trend #{$this->option('trend')} not found.");

                return self::FAILURE;
            }

            $trend = $forced;
        }

        $requestedFormat = $this->option('format') !== null ? (string) $this->option('format') : null;
        $format = $selector->resolveFormat($trend, $requestedFormat);

        if ($requestedFormat !== null && ContentFormat::tryFrom($requestedFormat) === null) {
            $this->warn("Unknown format [{$requestedFormat}] — using {$format->value} instead.");
        }

        $this->line('');
        $this->info("Trend  #{$trend->id} — {$trend->title}");
        $this->line("Format {$format->label()} · score {$trend->trend_score} · usefulness {$trend->usefulness_score} · focus {$trend->focus_score}");

        $spec = new PostSpec(
            format: $format->value,
            tone: 'technical',
            angle: 'Practical takeaway for working engineers — concrete steps, trade-offs and a reusable pattern.',
        );

        try {
            ['post' => $post, 'cached' => $cached] = $generation->generate($trend, $spec, (bool) $this->option('force'));
        } catch (\Throwable $e) {
            $this->error("Generation failed: {$e->getMessage()}");

            return self::FAILURE;
        }

        $researchData = $research->getOrGenerate($trend)['research'] ?? [];
        $verdict = $gate->evaluate($post, $researchData);

        $post->forceFill([
            'status' => $verdict['status'],
            'quality_score' => $verdict['total'],
            'quality_breakdown' => [
                'dimensions' => $verdict['breakdown'],
                'issues' => $verdict['issues'],
            ],
        ])->save();

        $trend->forceFill(['status' => 'researched', 'researched_at' => now()])->save();

        [$markdownPath, $textPath] = $this->export($post, $trend, $date);

        $this->line('');
        $this->info($cached ? 'Post (reused cached generation)' : 'Post generated');
        $this->line('──────────────────────────────────────────────────');
        $this->line($this->fullText($post));
        $this->line('──────────────────────────────────────────────────');

        if (($post->hashtags ?? []) !== []) {
            $this->line(Hashtags::toText($post->hashtags));
        }

        $this->line('');
        $this->table(['', ''], [
            ['Quality', "{$verdict['total']} → {$verdict['status']->value}"],
            ['Issues', count($verdict['issues'])],
            ['Markdown', $markdownPath],
            ['Copy-ready', $textPath],
        ]);

        return self::SUCCESS;
    }

    /**
     * @return Collection<int, ContentPost>
     */
    private function todaysPosts(): Collection
    {
        return ContentPost::query()
            ->whereDate('created_at', Carbon::today())
            ->orderByDesc('id')
            ->get(['id', 'title', 'format']);
    }

    /**
     * @param  Collection<int, Trend>  $candidates
     */
    private function renderCandidates(Collection $candidates, NightlyPostSelector $selector): void
    {
        $rows = $candidates->map(fn (Trend $t) => [
            $t->id,
            str((string) $t->title)->limit(52)->toString(),
            round((float) $t->trend_score, 1),
            round((float) $t->usefulness_score, 1),
            round((float) $t->focus_score, 1),
            ((bool) ($t->metrics['hack_style'] ?? false)) ? 'yes' : '—',
            $t->technologies->pluck('name')->take(2)->implode(', '),
        ]);

        $this->table(
            ['id', 'title', 'score', 'useful', 'focus', 'hack', 'tech'],
            $rows,
        );

        $this->line('Dry run — nothing generated. Today\'s readymade format would be: '
            .$selector->resolveFormat($candidates->first())->label());
    }

    /**
     * @return array{0: string, 1: string}
     */
    private function export(ContentPost $post, Trend $trend, string $date): array
    {
        $slug = str((string) $post->title)->slug()->limit(60, '')->toString() ?: 'post';

        $body = $this->fullText($post);
        $tags = Hashtags::toText($post->hashtags ?? []);
        $copyText = trim($body).($tags !== '' ? "\n\n".$tags : '')."\n";

        $markdown = implode("\n", array_filter([
            "# {$post->title}",
            '',
            "> Generated {$date} · trend #{$trend->id} · format `{$post->format}` · quality {$post->quality_score}",
            '',
            $body,
            '',
            $tags !== '' ? $tags : null,
            '',
            '---',
            '',
            '**Source trend:** '.$trend->title,
            '',
            '**Copy-ready:** paste everything above the separator into LinkedIn.',
        ]));

        $base = "daily-posts/{$date}-{$slug}";

        Storage::disk('local')->put("{$base}.md", $markdown."\n");
        Storage::disk('local')->put("{$base}.txt", $copyText);

        return [$base.'.md', $base.'.txt'];
    }

    /**
     * The post as published: hook + body stored separately.
     */
    private function fullText(ContentPost $post): string
    {
        $hook = trim((string) $post->hook);
        $body = trim((string) $post->body);

        return $hook === '' ? $body : $hook."\n\n".$body;
    }
}
