# Trend Discover Project — Master Plan & Progress

> Software Engineering Trend Intelligence & LinkedIn Content Manager
> Local-first · Laravel 13 API + React 19 SPA · MySQL 8
> **Last updated: Phase 3 complete** — see `ARCHITECTURE.md` for logic details,
> `API.md` for endpoint reference, `RUNBOOK.md` for daily operation.

---

## 1. Product Objective (unchanged)

Continuously identify interesting, timely, practical, under-covered software-engineering
trends from the current month and transform them into high-quality LinkedIn-ready posts.

Core philosophy: **find what is currently interesting, useful, technically meaningful, and
worth discussing — especially topics not already everywhere on LinkedIn.** High popularity
combined with high saturation must rank BELOW moderate popularity with high novelty.

## 2. Locked Architecture Decisions

| Decision | Choice | Notes |
|---|---|---|
| Backend | **Laravel 13** (upgraded from planned 12 — current major) | API-only, modular monolith |
| Frontend | React 19 + Vite 8 + TypeScript + shadcn/ui + Tailwind v4 | Port 5173, proxies `/api` to :8000 |
| Database | MySQL 8.0.46 local | DB `trend_discover`, least-privilege user `trend_app` |
| Queue | Laravel **database queue driver** | No Redis dependency |
| Auth | Sanctum personal access tokens, **hard 60-min expiry** | Open multi-user, auto-login after signup |
| AI layer | `AIProvider` interface → `OpenCodeGoProvider` + `MockProvider` | Phase 5 |
| Images | ray.so-style local snippet renderer + AI-generated prompts | Phase 6; no paid image API |
| Dev monitoring | Laravel Debugbar v4 (`--dev`) | Verified on every API call incl. JSON |
| Prod monitoring (future) | Laravel Pulse + `job_runs` + slow-query log | Low-cost path |
| Sources | HN Algolia, GitHub (token), Lobste.rs, Dev.to, RSS | **Reddit removed** — see decision log |

## 3. Decision Log (chronological)

| # | Decision | Rationale |
|---|---|---|
| D1 | Laravel over FastAPI | Proven familiarity, queues/scheduler without Redis, Windows-native |
| D2 | shadcn/ui over DaisyUI | Professional information-dense dashboard fit |
| D3 | No AI image generation | ray.so-style local renderer + AI-written prompts instead — offline, free |
| D4 | Debugbar v4 over New Debug Bar | NDB is sponsor-gated + Livewire-injected (poor fit for separate-origin SPA) |
| D5 | 60-min hard token expiry | User requirement; UX safeguards: T-10min toast, re-auth flow, draft preservation |
| D6 | Open multi-user registration | User choice; shared workspace |
| D7 | Collection = scheduled + manual button | Both worlds; ShouldBeUnique prevents pile-ups |
| D8 | **Reddit removed, Lobste.rs added** | Reddit's Responsible Builder Policy (Nov 2025) gates new app creation behind manual review with denials/no SLA; Lobste.rs offers an open JSON API serving the same community-discussion signal |
| D9 | Lexical-only clustering (no embeddings in loop) | Free, deterministic, predictable; LLM judgment deferred to P5 research call |
| D10 | Detection auto-chains after every collection | Dashboard always current; unique locks collapse concurrent runs |
| D11 | Layered architecture mandatory | Controller → Request → Service → Repository → Resource on every endpoint |

## 4. Progress Status

| Phase | Deliverable | Status |
|---|---|---|
| P1 | Scaffold, blueprint, schema (23 tables), seeders, Debugbar wiring | ✅ complete |
| P2 | Auth (60-min tokens), repositories, 5 collectors, pipeline jobs, scheduling, monitoring APIs, frontend auth | ✅ complete |
| P2.5 | Reddit removal, Lobste.rs source, GitHub token activation | ✅ complete |
| P3 | Trend clustering, configurable scoring engine, saturation analysis, Trends API, Explorer UI | ✅ complete |
| P4 | Dashboard polish + publishing-queue preview | ⬜ next |
| P5 | AI provider abstraction → research → post generation → quality gate → LLM novelty judge | ⬜ |
| P6 | Image studio: ray.so-style snippet renderer + AI image-prompt generator | ⬜ |
| P7 | Content library, lifecycle UI, copy/download workflow, jobs monitoring screen | ⬜ |
| P8 | Publishing channel abstraction + settings toggles (optional) | ⬜ |
| P9 | Pest/Vitest tests, query profiling pass, hardening | ⬜ |

### Current system state (verified)

- **208 source items** across 5 sources: HN(100), RSS(45), GitHub(34), Lobste.rs(18), Dev.to(11)
- **179 trends** clustered; scores range 39.9–82.9 (avg 58.3)
- Dedup proven idempotent (re-run inserts 0)
- Junk detection live: star-farmed repos dampened (usefulness → 25–30)
- All collections auto-chain into clustering + scoring

## 5. Repository Layout

```
trend-discover-project/
├── docs/                    PLAN.md · ARCHITECTURE.md · API.md · RUNBOOK.md
├── backend/                 Laravel 13 API
│   ├── app/Domain/Trending/
│   │   ├── Collectors/      CollectorInterface · RawItem · CollectorFactory
│   │   │                    HnCollector · GitHubCollector · LobsteRsCollector
│   │   │                    DevToCollector · RssCollector
│   │   ├── Clustering/      TrendClusterer · TitleSimilarity
│   │   └── Scoring/         ScoreEngine · DimensionScorers · SaturationAnalyzer
│   ├── app/Jobs/            CollectSourceItemsJob → DetectTrendsJob → CalculateTrendScoreJob
│   ├── app/Repositories/    Contracts/* + Eloquent/* (all complex queries live here)
│   ├── app/Services/        AuthService (60-min tokens)
│   └── app/Http/            Controllers/Api · Requests · Resources
└── frontend/                React 19 SPA
    └── src/features/        auth/ · dashboard/ · trends/
```

## 6. Risk Register (updated)

| Risk | Status / Mitigation |
|---|---|
| ~~No Docker~~ | Native scripts work well; Compose still optional future item |
| ~~LinkedIn personal-post API~~ | Manual-first by design (P8) |
| Reddit access blocked | ✅ resolved via Lobste.rs; official path may be re-tried later with aged account |
| GitHub star-farm spam polluting rankings | ✅ mitigated heuristically (quality flags); final fix = P5 LLM judge |
| Keyword-based category misclassification | Known limitation — e.g. Rust security story classified "Frontend Engineering" because 'git' substring-matched; improve with better matching rules or P5 LLM classification |
| Corpus too small for saturation signals to differentiate | Expected — saturation becomes meaningful as multi-day corpus grows |
