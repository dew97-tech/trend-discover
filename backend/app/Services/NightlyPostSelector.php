<?php

namespace App\Services;

use App\Enums\ContentFormat;
use App\Models\ContentPost;
use App\Models\Trend;
use App\Repositories\Contracts\TrendRepositoryInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Selects and shapes the nightly LinkedIn post.
 *
 * Candidate ranking lives in TrendRepository::dailyCandidates(); this service
 * adds the product preference (practical hack-style material first), excludes
 * trends posted recently, and picks a topic-appropriate format.
 */
final class NightlyPostSelector
{
    private const RECENCY_DAYS = 7;

    /**
     * Rotation pool for the nightly pick — tips, optimization, architecture.
     *
     * @var list<string>
     */
    public const USEFUL_FORMATS = [
        'quick_tip',
        'optimization_tip',
        'architecture_insight',
        'performance_breakdown',
        'sql_hack',
        'laravel_hack',
        'react_hack',
        'nextjs_hack',
        'technical_insight',
    ];

    /**
     * Topic signals that make a hack format appropriate. Generic formats not
     * listed here stay eligible for every trend.
     *
     * @var array<string, list<string>>
     */
    private const TOPIC_KEYWORDS = [
        'sql_hack' => ['sql', 'mysql', 'postgres', 'mariadb', 'index', 'query plan', 'explain', 'deadlock', 'database'],
        'laravel_hack' => ['laravel', 'eloquent', 'artisan', 'blade', 'php'],
        'react_hack' => ['react', 'jsx', 'hooks', 'usestate', 'usememo'],
        'nextjs_hack' => ['next.js', 'nextjs', 'app router', 'server component', 'server components'],
    ];

    public function __construct(private readonly TrendRepositoryInterface $trends) {}

    /**
     * Ranked practical-first candidates for tonight, excluding trends that
     * already produced a post within the recency window.
     *
     * @return Collection<int, Trend>
     */
    public function candidates(int $limit = 12): Collection
    {
        $recent = ContentPost::query()
            ->where('created_at', '>=', now()->subDays(self::RECENCY_DAYS))
            ->whereNotNull('trend_id')
            ->pluck('trend_id')
            ->unique()
            ->all();

        $candidates = $this->trends->dailyCandidates($limit, $recent);

        // Prefer practical/hack-style material; keep score order inside each pass.
        $practical = $candidates->filter(fn (Trend $t) => $this->looksPractical($t))->values();

        return $practical->isNotEmpty() ? $practical : $candidates;
    }

    public function looksPractical(Trend $trend): bool
    {
        if ((bool) ($trend->metrics['hack_style'] ?? false)) {
            return true;
        }

        $text = mb_strtolower(($trend->title ?? '').' '.($trend->summary ?? ''));

        foreach (['tip', 'trick', 'guide', 'how to', 'optimiz', 'performance', 'cache', 'index', 'architecture', 'design', 'debug', 'mistake', 'pattern', 'scale'] as $signal) {
            if (str_contains($text, $signal)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Topic match first (SQL topics → sql_hack, …), otherwise a day-index
     * rotation so consecutive nights differ.
     */
    public function resolveFormat(Trend $trend, ?string $override = null, ?Carbon $on = null): ContentFormat
    {
        if ($override !== null) {
            $format = ContentFormat::tryFrom($override);

            if ($format !== null) {
                return $format;
            }
        }

        $text = mb_strtolower(
            ($trend->title ?? '').' '.($trend->summary ?? '').' '.$trend->technologies->pluck('name')->implode(' ')
        );

        $matchScore = [];

        foreach (self::TOPIC_KEYWORDS as $format => $keywords) {
            $matchScore[$format] = array_reduce(
                $keywords,
                fn (int $carry, string $keyword) => $carry + (str_contains($text, $keyword) ? 3 : 0),
                0,
            );
        }

        $pool = self::USEFUL_FORMATS;
        $offset = (($on ?? Carbon::now())->dayOfYear) % count($pool);
        $pool = array_merge(array_slice($pool, $offset), array_slice($pool, 0, $offset));

        usort($pool, fn (string $a, string $b) => ($matchScore[$b] ?? 0) <=> ($matchScore[$a] ?? 0));

        return ContentFormat::from($pool[0]);
    }
}
