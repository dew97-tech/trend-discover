# Trend Discover Project — Technical Blueprint

> Software Engineering Trend Intelligence & LinkedIn Content Manager
> Status: **Finalized plan** · Phase 1 execution in progress

---

## 1. Product Objective

A local-first trend intelligence and LinkedIn content management application focused on
software engineering topics. It continuously identifies interesting, timely, practical,
and relatively under-covered trends from the current month, then transforms them into
high-quality LinkedIn-ready posts and supporting visuals.

Core philosophy: **find what is currently interesting, useful, technically meaningful,
and worth discussing — especially topics not already everywhere on LinkedIn.**

Target domains: Software Engineering, PHP/Laravel, JS/TS, React, Backend/Frontend
Engineering, Databases & Query Optimization, API/System Design, Performance Engineering,
DevOps, AWS/Cloud, Docker/K8s, CI/CD, Caching/Queues, Observability, Security practices,
Developer Productivity, Scalability, Distributed Systems, Dev Tools.

## 2. Locked Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Backend | **Laravel 12** (modular monolith, JSON API) | Proven familiarity, built-in queues/scheduler without Redis, Windows-friendly |
| Frontend | **React 19 + Vite + TypeScript + shadcn/ui** | Modern dashboard UX, information-dense design |
| Database | **MySQL 8** | Already installed locally, production-like |
| Queue | Laravel **database queue driver** | No Redis dependency for MVP |
| Local dev | Native Windows scripts (no Docker yet) | Docker not installed; Compose documented for later |
| AI layer | `AIProvider` interface → `OpenCodeGoProvider`, `MockProvider` | Provider abstraction, cost control |
| Images | ray.so-style local code-snippet renderer + AI-generated image prompts | Offline-capable, zero-cost, post-relevant |
| Dev monitoring | **Laravel Debugbar v4** (`fruitcake/laravel-debugbar --dev`) | Queries/cache/timeline/memory/env, AJAX capture |
| Prod monitoring (future) | **Laravel Pulse** + `job_runs` table + slow-query log | Low-cost first-party telemetry |

### Runtime topology

```
React SPA (Vite, :5173)
      ↓ REST /api/*
Laravel 12 API (:8000)
      ↓                ↘
MySQL 8            queue:work (database driver)
                       ↓
                  External APIs: HN Algolia · GitHub · Reddit JSON · Dev.to · RSS · OpenCode Go AI
```

## 3. Repository Structure

```
trend-discover-project/
├── docs/
│   └── PLAN.md
├── backend/                    # Laravel 12 (API only)
│   └── app/
│       ├── Domain/
│       │   ├── Trending/
│       │   │   ├── Collectors/     HnCollector · GitHubCollector · RedditCollector ·
│       │   │   │                   DevToCollector · RssCollector
│       │   │   ├── Scoring/        ScoreEngine · DimensionScorers · WeightProfile
│       │   │   ├── Novelty/        Deduplicator · SaturationAnalyzer
│       │   │   └── Clustering/     TrendClusterer
│       │   ├── Content/
│       │   │   ├── Generation/     PostGenerator · QualityGate · PromptBuilder
│       │   │   └── Images/         SnippetRendererSpec · ImagePromptBuilder
│       │   ├── Publishing/         PublishingChannel interface (Phase 8)
│       │   └── Shared/
│       ├── Services/AI/            AIProvider · OpenCodeGoProvider · MockProvider
│       ├── Jobs/                   pipeline jobs (see §9)
│       └── Http/Controllers/Api/
└── frontend/                   # React 19 + Vite + TS + Tailwind + shadcn/ui
    └── src/
        ├── features/           dashboard/ trends/ studio/ library/ publishing/
        ├── components/ui/      shadcn primitives
        └── styles/tokens.css   semantic design tokens
```

## 4. Database Schema

Core tables (access-pattern driven):

| Table | Purpose | Key indexes / constraints |
|---|---|---|
| `sources` | Registered collectors (type, name, config JSON, enabled) | UNIQUE(name) |
| `source_items` | Raw fetched items | UNIQUE(source_id, external_id); INDEX(published_at DESC); FULLTEXT(title) |
| `categories` | Topic taxonomy | UNIQUE(slug) |
| `technologies` | Tech registry | UNIQUE(slug) |
| `trends` | Clustered trend entity | INDEX(status, trend_score DESC); INDEX(first_seen_at); FULLTEXT(title, summary); FK category_id |
| `trend_signals` | Per-dimension signal evidence | FK trend_id; INDEX(trend_id, type) |
| `trend_technology` | pivot | composite PK |
| `trend_source_item` | cluster membership pivot | composite PK |
| `content_posts` | Generated posts | INDEX(status, updated_at); FK trend_id; UNIQUE slug |
| `content_versions` | Immutable version history | FK content_post_id; INDEX(created_at DESC) |
| `content_images` | code_snippet / prompt / manual_upload | FK content_post_id; INDEX(type) |
| `ai_generations` | Every AI call: provider, kind, tokens, duration, idempotency key | UNIQUE(idempotency_key); INDEX(kind, created_at) |
| `job_runs` | Pipeline observability | INDEX(job_class, status, started_at DESC) |
| `system_settings` | Scoring weights, feature toggles, source config overrides | UNIQUE(key) |

Publishing tables deferred to Phase 8 (`publishing_accounts`, `publishing_jobs`,
`publishing_logs`) behind a `PublishingChannel` interface.

### Content lifecycle

```
DISCOVERED → RESEARCHING → GENERATING → DRAFT → REVIEW → READY → PUBLISHED → ARCHIVED
                                   ↘ FAILED_RESEARCH / FAILED_GENERATION / FAILED_VALIDATION
```

## 5. Trend Discovery & Scoring Engine

Pipeline (all queued): Collect → Normalize → Dedup (URL hash exact + fuzzy title
shingling) → Cluster into Trends → Score → Saturation analysis → Rank.

Configurable scoring (weights live in `system_settings`):

```
trend_score = Σ weightᵢ × dimensionᵢ − saturation_penalty

dimensions:
  freshness            decay curve on published_at
  momentum             comments/stars velocity vs 30-day baseline
  technical_relevance  match against technology/category registry
  practical_usefulness LLM-judged (batched, cached)
  novelty              LLM-judged (batched, cached)

saturation = cross-source repetition ratio + title-similarity density
```

Rule enforced: high popularity × high saturation ranks BELOW medium popularity × high
novelty. Weights editable at runtime without redeploy.

MVP sources (official/free APIs only): Hacker News Algolia, GitHub Search + Releases,
Reddit JSON (r/programming, r/laravel, r/webdev, r/javascript, r/devops), Dev.to API,
curated RSS feeds. Source registry is DB-driven — new source = collector class + row.

## 6. AI Layer

```php
interface AIProvider {
    public function research(Trend $trend): ResearchResult;
    public function generatePost(ResearchResult $r, PostSpec $spec): GeneratedPost;
    public function generateImagePrompt(GeneratedPost $post): string;
    public function suggestSnippet(ResearchResult $r): SnippetSpec;
    public function judgeQuality(string $post): QualityScore;
}
```

Implementations: `OpenCodeGoProvider` (key from .env), `MockProvider` (tests/dev).
Every call logged to `ai_generations` (duration, tokens, idempotency_key). Results cached
per trend+angle+format hash. No regeneration unless explicitly requested.

Post quality guardrails: no generic hooks, no unsupported statistics, no emoji excess,
no obvious AI patterns. Formats: Technical Insight, Optimization Tip, Problem→Solution,
Before→After, Engineering Lesson, Release Highlight, Tool Discovery, Performance
Breakdown, Architecture Insight, Debugging Story, Developer Debate, Case Study.

Quality gate before READY: rule checks (length, banned openers, number-claims) +
LLM rubric → Content Quality score (Technical Accuracy / Novelty / Practical Value /
Readability / Engagement / Source Confidence).

## 7. Image Pipeline (per product decision)

```
content_images.type:
├── code_snippet   AI derives illustrative snippet from research → rendered locally
│                  client-side (ray.so-style) → theme/gradient/title tweaks → PNG download
├── prompt         AI generates detailed image prompt stored with the post
└── manual_upload  user uploads finished artwork
```

Fully offline-capable and cost-free.

## 8. API Surface (initial)

```
GET   /api/dashboard                 aggregate stats + trending now + recent content
GET   /api/trends                    filterable/paginated explorer
GET   /api/trends/{id}               detail incl. signals, sources, angles
POST  /api/trends/{id}/generate      dispatch GeneratePostJob
GET   /api/posts                     library w/ filters
GET/PATCH /api/posts/{id}
POST  /api/posts/{id}/regenerate     explicit regeneration only
POST  /api/posts/{id}/generate-image snippet spec or prompt refresh
POST  /api/posts/{id}/publish        manual workflow helper (copies, state transition)
GET   /api/jobs                      job_runs monitoring
GET/PATCH /api/settings              scoring weights, toggles
```

Cursor pagination on feed-style lists; composable filters mirror UI requirements.

## 9. Background Jobs

```
CollectSourceItemsJob → NormalizeSourceDataJob → DetectTrendsJob → CalculateTrendScoreJob
→ AnalyzeContentSaturationJob → GenerateResearchJob → GeneratePostJob
→ SuggestSnippetJob / GenerateImagePromptJob → ValidateContentJob
```

All jobs: retry with backoff, idempotent, deduplicated, logged to job_runs.
UI never blocks on collection/scoring/generation.

## 10. Caching Strategy

| Cache | TTL | Invalidation |
|---|---|---|
| Dashboard aggregates | 60s | on write events |
| Technology/category metadata | 24h | on seed/update |
| AI research per trend | indefinite | on trend data change |
| Trend scores | until re-score | scheduled re-score |
Every cache documents key/TTL/reason. No blind caching.

## 11. Observability

Dev: Debugbar v4 — queries(+EXPLAIN), cache hits, timeline (`Debugbar::measure()` around
AI + scoring), memory, HTTP client latency, AJAX capture for SPA traffic. Loads only when
`APP_ENV=local && APP_DEBUG=true`.

Prod path: Laravel Pulse (slow requests/queries/jobs/outbound, CPU/memory, exceptions,
queue depth), `job_runs` metrics, slow-query log >200ms, structured log channels.

## 12. Security

Secrets via `.env` only; AI keys never sent to frontend; sanitized input; encrypted token
storage (`crypt`) when publishing arrives. No undocumented LinkedIn endpoints — official
API supports organization posts only; personal-profile posting stays manual by design.

## 13. Development Workflow (Windows native)

```bash
# backend
php artisan serve            # :8000
php artisan queue:work       # pipeline workers
php artisan schedule:work    # dev scheduler (Task Scheduler for persistent use)

# frontend
npm run dev                  # :5173
```

Docker Compose documented as future reproducibility upgrade.

## 14. Development Phases

| Phase | Deliverable | Status |
|---|---|---|
| P1 | Scaffold repo, schema/migrations, models, seeders, Debugbar | 🚧 current |
| P2 | Source collectors + normalize/dedupe/schedule jobs | pending |
| P3 | Clustering, scoring engine, saturation analyzer | pending |
| P4 | REST API + Dashboard + Trend Explorer screens | pending |
| P5 | AI abstraction + research + post generation + quality gate | pending |
| P6 | Image studio (snippet renderer + prompt generator) | pending |
| P7 | Library, statuses, copy/download workflow, job monitoring | pending |
| P8 | Publishing channel abstraction + settings toggles (optional) | pending |
| P9 | Pest/Vitest tests, query profiling pass, hardening | pending |

## 15. Risk Register

| Risk | Mitigation |
|---|---|
| No Docker on dev machine | Native scripts; Compose documented for CI/prod |
| LinkedIn personal-post API limitation | Manual-first publishing; channel abstraction for future org posting |
| Saturation analysis w/o paid search APIs | Cross-source density + LLM judgment; optional Brave/Serper later |
| AI cost creep | Idempotency keys, result caching, generation limits, no auto-regen |
| Signal quality vs rate limits | Polite polling schedules, per-source throttles, backoff |
