# Architecture & Underlying Logic

> How Trend Discover actually works, with worked examples from the live system.
> Companion docs: `PLAN.md` (status/decisions) · `API.md` · `RUNBOOK.md`.

---

## 1. The Pipeline at a Glance

```
External APIs          Collectors            Database                Domain engine
─────────────         ─────────────         ───────────────         ─────────────────
HN Algolia     ─┐                                           ┌─→ exact URL-hash match
GitHub (token)  │    HnCollector      ┌───────────────┐     │   fuzzy title match
Lobste.rs JSON  ├─→ GitHubCollector ─→│ source_items  │────→│        ↓
Dev.to         │    LobsteRsCollector │ (normalized,  │     │   TREND CLUSTERER
RSS + YouTube  ├─→ DevToCollector    │  deduped)     │     │        ↓
feeds          ┘    RssCollector      └───────────────┘     │   SCORE ENGINE
                                                             │   (9 dimensions +
                        CollectSourceItemsJob                │    focus boost +
                        auto-chains on insert > 0  ──────────┘    saturation penalty)
                                                                      ↓
                                                     DetectTrendsJob → CalculateTrendScoreJob(s)
```

Everything between "collect" and "scored" runs in **queued background jobs** — the UI never
blocks. Each job writes a `job_runs` row (status, attempts, duration, error) which powers
`GET /api/jobs` monitoring.

---

## 2. Collection Layer

### 2.1 Collector contract

Every source implements `CollectorInterface::collect(Source): Collection<RawItem>`.
A `RawItem` is the canonical normalized shape:

```php
new RawItem(
    externalId: 'lobsters-abc123',       // stable per-source ID → UNIQUE(source_id, external_id)
    url: 'https://example.com/post',     // hashed into content_hash for cross-source identity
    title: 'Article title',
    summary: null,                        // truncated to 2000 chars, tags stripped
    metrics: ['points' => 42, 'comments' => 17],
    metadata: ['kind' => 'discussion', 'tags' => ['security']],
    publishedAt: Carbon(...),
)
```

### 2.2 Cross-source identity: `content_hash`

The same article shared on HN and Lobste.rs must become ONE story. Identity is computed
from **host + path only** (lowercased, `www.` stripped, query/fragment dropped):

```
https://blog.example.com/rust-arrayref/?utm_source=hn
  → blog.example.com/rust-arrayref/
  → sha256("url::blog.example.com/rust-arrayref/") = content_hash
```

Two rows in `source_items` share this hash when any two sources link the same URL.
Insertion uses `insertOrIgnore` against `UNIQUE(source_id, external_id)`; re-running a
collection is therefore **idempotent** — verified live: second run fetched 100, inserted 0.

### 2.3 Source configs (stored in `sources.config` JSON)

| Source | Key filters | Auth |
|---|---|---|
| hacker-news | points > 30–40, last 14 days | none |
| github | created ≤10 days, stars ≥150 + watched topics (laravel, react, nextjs, mysql, database…) + release repos | PAT via `config('services.github.token')` |
| lobsters | score ≥15, last 72h, `/newest.json` ×2 pages | none |
| dev-to | tags incl. laravel, php, react, nextjs, sql, mysql, database; reactions ≥5, last 7 days (public API ignores sort-by-popularity — see note) | none |
| engineering-rss | Laravel News, Laravel Daily, Laracasts, Next.js Blog, React Blog, Vercel, Percona MySQL, PlanetScale, InfoQ, Smashing; 25 items/feed | none |
| youtube | 6 channel feeds — KodeKloud, Laravel Daily, Learn with Sumit, Web Dev Cody, ByteByteGo, CodeWithHarry; 15 videos/feed. `media:statistics` views → metrics (engagement counts views ÷ 200) | none |

> Focus sources were chosen to feed the Laravel/PHP/TS/React/Next.js/database
> hack-content pipeline. YouTube channel feeds need no API key; per-video views
> come from the Media RSS extension parsed in `RssCollector`.

> **Documented API quirk:** Dev.to's `top=N` parameter means "articles from N months ago",
> not "top N". We fetch `/articles/latest` and filter by recency + reactions ourselves.
> Dev.to engagement ceiling is currently ~11 reactions/week for major tags, so this source
> contributes *fresh niche articles* while popularity signals come from HN/Lobste.rs/GitHub.

### 2.4 Junk signals captured at collection time (`qualityFlags`)

| Flag | Trigger | Effect on usefulness |
|---|---|---|
| `repo_no_description` | GitHub repo with empty/"New repository" description | capped at **25** |
| `suspect_velocity` | repo <10 days old already ≥300 stars (star-farm signature) | capped at **30** |
| `emoji_heavy` | ≥2 promo symbols (⭐/emoji/mojibake U+FFFD) in title | capped at **45** |

Real example: `Alain00/blobatar ⭐ 632` — 6-day-old repo, no description → both flags →
dropped out of top ranks despite high star velocity.

---

## 3. Clustering Layer (`TrendClusterer`)

Groups related `source_items` into trends. Runs inside `DetectTrendsJob`, which is
auto-dispatched by `CollectSourceItemsJob` whenever new items were inserted
(`ShouldBeUnique` collapses concurrent chains into one run).

### Pass 1 — exact URL identity
`openTrendHashIndex()` builds `content_hash → trend_id` from open trends (<14 days).
An incoming item whose hash exists joins that trend instantly.

### Pass 2 — fuzzy title match (lexical, no AI)
`TitleSimilarity` tokenizes titles: lowercase, strip punctuation, remove stopwords,
strip collector prefixes like `[Dev.to/php]` / `[Laravel News]` (they would otherwise
block cross-source merges), then builds **word-bigram shingles** and computes Jaccard:

```
J(A,B) = |shingles(A) ∩ shingles(B)| / |shingles(A) ∪ shingles(B)|

"Malicious Rust crate Arrayref runs a build-time payload"
tokens: malicious rust crate arrayref runs build time payload
shingles: [malicious rust, rust crate, crate arrayref, arrayref runs, ...]
```

Thresholds are adaptive — short titles inflate Jaccard on weak overlap:

| Shorter title tokens | Effective threshold |
|---|---|
| ≤3 | ≥0.80 |
| 4–5 | ≥0.65 |
| ≥6 | base 0.55 |

Match order per item: existing open trend titles (max 500 recent) → trends touched in
this same batch → otherwise create a new trend.

### Cluster bookkeeping

On attach, the cluster:
- promotes the **highest-engagement item's title** as the trend title
- tracks `first_seen_at` / `last_seen_at` min/max
- counts `item_count` from the pivot table
- records a `trend_signals` row of type `source_coverage` per item (source, URL, metrics)
  → this is the evidence list shown in Trend Detail

### Classification

Title + summary + tags are matched against `technologies` (names/slugs/aliases) by
`TechnologyClassifier`, shared between clustering and the `trends:reclassify` command.
Matching is **word-boundary based** (`(?<![\p{L}\p{N}])name(?![\p{L}\p{N}])`), which
fixed the documented substring misfires — alias "git" no longer matches inside
"Arrayref", "react" no longer matches "reactive". Dotted (`next.js`) and multi-word
(`app router`) aliases work. Aliases were expanded for focus techs (artisan/eloquent/
blade → Laravel; app router/server components → Next.js; InnoDB/query plan → MySQL;
react hooks/JSX → React). First matched technology's `category_id` becomes the trend
category; up to 6 technologies sync to the pivot. LLM classification remains a Phase-5
improvement path.

Existing trends can be reclassified in place (posts preserved) with
`php artisan trends:reclassify` — it re-syncs techs/category and queues re-scoring.

---

## 4. Scoring Engine (`ScoreEngine`)

Composite formula, weights hot-loaded from `system_settings['scoring.weights.default']`:

```
trend_score = Σ(weight_i × dimension_i) − saturation_penalty_weight × saturation_score
```

Default weights (editable without redeploy):

```
freshness .16    momentum .13    technical_relevance .16    practical_usefulness .14
novelty .18      topic_focus .08 developer_interest .05     discussion_potential .05
source_reliability .05
saturation_penalty_weight .25
```

The composite is divided by the sum of positive weights, so legacy stored weight
sets (which sum ≈1.00 without `topic_focus`) and future rebalancings both produce a
0–100 score without migration.

### Dimension formulas

| Dimension | Formula | Range notes |
|---|---|---|
| freshness | `100 × 0.5^(age_hours / 36)` floor 5 | half-life 36h on newest item |
| momentum | `50 × log10(1 + total_engagement / hours_since_first_seen)` | 100 @ ~100/hour |
| relevance | `20 + 25×matched_techs + 15×(has_category)` | capped 100 |
| usefulness | `55 + 15×keyword_hits + 9×hack_hits` (max 3 hack hits), junk-flag caps applied | keywords: optimiz/performance/benchmark/debug/guide/deep dive/scaling/security… plus `config/trending.php` hack keywords (word-boundary) |
| focus | `100` focus technology attached · `55` focus category only · `0` none | soft boost only — never hides a trend |
| interest | `(100/3) × log10(1 + total_engagement)` | 100 @ ~1000 pts |
| discussion | `min(1, comments/engagement) × 200` | comment-heavy stories win |
| source_reliability | `65 + 10×distinct_sources` | capped 100 |

Engagement normalization per source type:
`primary(points|score|stars|reactions|views÷200) + 2×comments`.
YouTube views are 100–1000× larger than points/stars; the ÷200 divisor brings them
into the same order of magnitude so one viral video can't dominate momentum.

### Focus & hack style (the "practical hacks" product turn)

`config/trending.php` defines the focus technology slugs (Laravel, PHP, TypeScript,
React, Next.js, MySQL/MariaDB/PostgreSQL/SQLite) and hack keywords (tip/trick/hack/
one-liner/gotcha/EXPLAIN/query plan/index/…). Two effects, both soft:

1. `topic_focus` weight (`0.08` default) boosts focus-matching trends in ranking.
2. Hack phrasing raises `usefulness_score` and, at ≥2 distinct keywords, sets
   `metrics.hack_style = true` → `hack_style` badge in the Explorer.

Nothing is excluded: a non-focus trend with strong signals still competes, it just
lacks the boost.

### Saturation analysis (`SaturationAnalyzer`) — the anti-"already everywhere" check

```
saturation = 0.40×breadth + 0.40×sibling_density + 0.20×repetition

breadth         = covering_sources / active_sources × 100
sibling_density = near-duplicate OTHER trend titles (Jaccard ≥0.45),
                  scaled ×400 against corpus norm, capped 100
repetition      = cluster size vs corpus average, centered at 30
```

Novelty is then derived: `novelty = clamp(100 − 0.7×saturation + 0.3×freshness)`.

This enforces the core product rule: a story covered by every source with many sibling
clusters gets penalized even if raw popularity is huge, letting a fresh niche topic rank above it.

### Worked example — real trend #95 (Phase-3 snapshot)

> Historical example. Weights shown are the pre-focus defaults and the relevance
> score reflects the old substring classifier — word-boundary matching later
> corrected this exact trend to *no* technology match (it's a Rust security story).
> The computation mechanics (weighted dimensions − saturation penalty) are unchanged;
> the engine now adds `topic_focus` and normalizes by the positive weight sum.

**Input:** *"Malicious Rust crate Arrayref runs a build-time payload"* (HN, 1 item,
first/last seen 2026-08-20 ~13:23 UTC, scored ~24h later):

| Dimension | Value | Why |
|---|---|---|
| freshness | 61.29 | ≈36h old → one half-life |
| momentum | 87.75 | strong engagement-per-hour |
| relevance | 85 | matched TypeScript + Git (+category) |
| usefulness | 55 | no optimization-keyword hits, no flags |
| novelty | 100 | singleton, saturation only 13.73 |
| saturation | 13.73 | single source, no siblings yet |

```
composite = .18×61.29 + .14×87.75 + .18×85 + .15×55
          + .20×100 + .05×interest + .05×discussion + .05×reliability
          − .25×13.73
          = 75.35   ← stored trend_score
```

Every scoring run also persists a `trend_signals` row of type `score_breakdown`
(dimensions + applied weights + timestamp) — that is exactly what the Explorer detail
dialog renders as bars.

### Observed distribution (first real run)

179 trends · scores 39.87 – 82.89 · average 58.3. Junk dampening visibly reordered the
top: star-farmed repos fell behind genuine security/engineering stories.

---

## 5. Jobs & Reliability Model

| Job | Unique key | Tries/backoff | Notes |
|---|---|---|---|
| CollectSourceItemsJob | source id | 3 × [30s,120s,600s] | increments `consecutive_failures`; chains DetectTrendsJob when inserts > 0 |
| DetectTrendsJob | global, 10 min | 2 × [60s] | dispatches one scoring job per touched trend |
| CalculateTrendScoreJob | trend id, 5 min | 2 × [30s] | isolated so one bad trend can't block others |

Failure handling: every job wraps `handle()` with JobRun start/finish; failures record the
error message and rethrow so `failed_jobs` also captures them. `GET /api/jobs` surfaces
the last 50 runs with durations.

> **Operational gotcha (documented):** `queue:clear` deletes pending jobs but NOT their
> ShouldBeUnique locks — subsequent dispatches get silently dropped until lock expiry.
> If detection seems dead after a queue clear: `DELETE FROM cache_locks;`

## 6. Scheduling (Windows-native)

```
hn        0 */4 * * *     rss   20 */3 * * *
github    30 */6 * * *    lobsters 10 */3 * * *
devto     45 */8 * * *    trends:score  daily 02:00
```

All with `withoutOverlapping`. Dev: `php artisan schedule:work`.
Persistent: Windows Task Scheduler → `php artisan schedule:run` every minute.

## 7. Frontend Architecture

```
src/features/auth/      AuthProvider (token+expiry mgmt, 401 event, T-10min toast)
src/features/dashboard/ DashboardPage  ← GET /api/dashboard (60s server cache)
src/features/trends/    TrendExplorerPage (filters, cards, detail dialog, cursor paging)
src/lib/api.ts          fetch wrapper: bearer token, JSON errors, 401 → clearSession+event
```

Design tokens (`src/index.css`): semantic CSS variables mapped from the LinkedIn-inspired
palette; light+dark; tier colors `--trend-high/medium/low` used for score badges.

## 8. Monitoring

- **Debugbar v4**: every API request stores queries/cache/timeline/memory;
  JSON responses carry `phpdebugbar-id` header; AJAX capture ON.
- **job_runs table**: pipeline observability (durations, attempts, errors, meta like
  fetched/inserted/duplicates_skipped per collection).
- **Dashboard endpoint**: cached aggregates incl. `failed_jobs_24h` honesty counter.

### Model auto-discovery (`ModelCatalogService`)

The Go gateway rotates its roster without notice, so hard-coded allowlists decay.
`php artisan ai:refresh-models` (daily 03:20) and the Settings "Refresh now" button
run the same pipeline:

1. **Roster** — authenticated `GET /zen/go/v1/models` (10-min cache). General-tier
   free models (`big-pickle`, `*-free`) are API-blocked, so only the Go endpoint is
   used — every call there reports `cost: 0`.
2. **Rank** — `config/ai.php` → `auto_discover`: family base weights, a version
   bonus parsed from the id, lightweight-variant bonuses (`flash`/`lightning`/
   `lite`/`mini` beat `pro`/`max`), and excludes (`contributor`, `vision`, `omni`,
   `exp`, …). `created` timestamps are identical across the roster, so there is no
   recency signal to rank by.
3. **Probe** — tiny JSON calls to the top 10 candidates (the roster also lists
   models that fail via chat-completions, e.g. `gpt-5.6-luna` → 500).
4. **Store** — the 3 **fastest working** models (latency first, score tiebreak),
   excluding the configured allowlist, are persisted in
   `system_settings('ai.auto_models')` and appended to the provider fallback chain.

If the entire chain fails, the provider dispatches `RefreshAiModelsJob`
(unique per hour) so the next call has fresh candidates. `ai:check-models`
probes allowlist + auto models and reports working state; Settings shows the
list with latency, a "broken active model" warning, and a one-click switch.
`scripts/verify-ai-fallback.php` covers both outage scenarios (allowlist
fallback and auto-model rescue).

## 9. Content Studio & Post Lifecycle

### Variants grouped by trend
Every generation is a `ContentPost` identified by **trend × format × tone × angle**
(format/tone/angle are stored on the row; `GeneratePostJob` is unique per fingerprint).
`GET /posts/grouped` returns trends ordered by latest variant activity with their
variants eager-loaded — the Studio works on these groups ("New variant", "Delete all
variants"), and the editor shows a sibling switcher for the same trend.

### Permanent deletion
`DELETE /posts/{id}` collects image file paths first, deletes the row (DB cascades
versions + image rows), then purges files from the public disk — implemented in
`ContentPostService`, so storage side effects never leak into controllers.
`DELETE /posts?trend_id=` loops the same service for a whole group.

### Hashtags
The `post.user` prompt returns `hashtags` alongside title/hook/body; values are
normalized by `App\Support\Hashtags` (`#` stripped, spaces/hyphens → PascalCase,
alphanumeric, dedupe, max 8 × 30 chars) and persisted on the post. Posts generated
before the feature (or edited down to zero tags) can call
`POST /posts/{id}/hashtags` → `GenerateHashtagsJob` → `HashtagService`, which grounds
tags in the body + trend technologies using the `hashtags.user` prompt. Copy-for-LinkedIn
appends the tags unless the user toggles them off in Preview.

### Visuals
Snippet derivation (`SnippetService`) returns a `{code, language, title}` spec rendered
client-side by `CodeCard`: long lines wrap, type scale adapts to the longest line, and
five themes replace the old gradient card. Pending generations render a fixed-aspect
skeleton, so the panel never jumps. PNG export renders an off-screen fixed-size node
(1080×1080 or 1200×627) before `toPng`, guaranteeing complete code and zero layout shift.

## 10. UI Design System

Semantic tokens (`index.css`) on a cool neutral base with one brand accent; borders over
shadows; light + dark via `next-themes`. Shared primitives live in
`components/shared/` (`PageHeader`, `SectionHeader`, `EmptyState`, `StatusBadge`,
`ScorePill`, `StatTile`, `Field`, `HelpTip`, `ConfirmDialog`, `CodeBlock`, `Toolbar`,
`PostCard`). Formats and statuses are single-source modules (`lib/content-formats.ts`,
`lib/post-status.ts`) instead of duplicated maps. Non-obvious controls carry a `HelpTip`;
the app-level `TooltipProvider` supplies shared timing.

## 11. What Comes Next

See `PLAN.md §4`. Optional next: publishing-channel abstraction, a test suite
(Pest/Vitest), query profiling, and eventually the LLM novelty judge replacing the
heuristic usefulness scoring and keyword classification.
