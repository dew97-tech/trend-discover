# Trend Discover Project — Master Plan & Progress

> Software Engineering Trend Intelligence & LinkedIn Content Manager
> Local-first · Laravel 13 API + React 19 SPA · MySQL 8
> **Last updated: Phase 12 + U1 (Signal Desk redesign)** — see
> `ARCHITECTURE.md` for logic details, `API.md` for endpoint reference,
> `RUNBOOK.md` for daily operation, `COOKBOOK.md` for the nightly
> post-generation workflow, and `frontend/DESIGN.md` for the UI system.

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
| Sources | HN Algolia, GitHub (token), Lobste.rs, Dev.to, RSS + 6 YouTube channels | **Reddit removed** — see decision log |
| Content focus | Laravel · PHP/TypeScript · React · Next.js · databases, hack/tip style | Soft boost via `topic_focus` + hack keywords — nothing excluded (D12) |

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
| D12 | Focus topics as a **soft boost**, not a hard filter | User decision: Laravel, PHP/TypeScript, React, Next.js, databases in hack/tip style rank higher; nothing is hidden, so novelty can still win |
| D13 | `x-opencode-session` header + model allowlist refresh | Go gateway added the mandatory header (all models 400 without it); `ox-alpha-free` removed, `hy3` broken — allowlist now mimo-v2.5 → deepseek-v4-flash → glm-5.3-flash, verified by `ai:check-models` |
| D14 | YouTube via channel RSS (no Data API) | Free, keyless; `media:statistics` views captured as engagement (views ÷ 200); KodeKloud + Laravel Daily feeds |
| D15 | Word-boundary technology matching | Fixes substring misfires ("git" inside "Arrayref"); shared by clusterer and `trends:reclassify` so existing trends can be corrected without losing generated posts |
| D16 | Design system: cool neutral tokens, borders over shadows, light+dark | De-generic-ify the UI; `next-themes` wired, global `HelpTip` tooltips, shared primitives; measurable naming across nav/pages |
| D17 | Studio groups variants under their trend + permanent delete | Same trend × format × tone × angle = a managed variant row, not an anonymous post; delete cascades versions and purges image files |
| D18 | Hashtags generated with the post + AI backfill | 3–5 grounded PascalCase tags stored on the post, editable chips, included in Copy by default; `posts:generate-hashtags` backfills older posts |
| D19 | Auto-discovered model fallbacks (Settings → Model resilience) | Gateway roster churns; daily scan ranks models cheap/fast-first, probes the top 10, stores the 3 fastest working (daily 03:20 + on total chain failure). OpenCode's general free tier is API-blocked — discovery uses the Go roster (cost 0); verify with `scripts/verify-ai-fallback.php` |
| D20 | YouTube channels expanded to 6 | Sumit Saha (Learn with Sumit), Web Dev Cody, ByteByteGo, CodeWithHarry join KodeKloud + Laravel Daily; views captured from `media:statistics` and counted ÷200 |
| D21 | ray.so-style snippet cards + 2x clipboard export | First live LinkedIn run showed 11px code in a 1080² frame → unreadable after LinkedIn's downscale. Cards are now designed at 600px/1x and exported at 2x (1200×1200 / 1200×628), Shiki-highlighted, JetBrains Mono embedded; "Copy image" pastes straight into LinkedIn |
| D22 | Collapsible sidebar icon rail | Sidebar toggles w-60 ↔ w-16 with tooltip icons, persisted in `localStorage`; navigation stays visible without eating content width |
| D23 | AI revision suggestions (hook/body) + polished preview | Wrong-answer posts are fixed by describing the correction (optional reference paste) → `RevisePostJob` proposes in `post_revisions`; Apply writes the targeted field + version + queues quality re-check. Grounded in trend research, length-capped ±15%, markdown stripped for LinkedIn; Preview gains block rendering + Raw toggle |
| D24 | Hook and body separated + fixed app shell | Body no longer stores the hook; Copy/Preview/exports compose `hook + body` exactly once; revisions are target-scoped; `posts:split-hooks` repaired the corpus. Shell is `h-svh` with `main` as the only scroll container, so the collapsible sidebar stays put while content scrolls |
| D25 | "Signal Desk" redesign (D24 shell superseded) | Colleague feedback: the shadcn-default look read as AI-generated. Full design-system rebuild: paper/ink tokens with one signal accent, Geist + Newsreader + JetBrains Mono, Phosphor icons, top nav + ⌘K command palette, hairline ledgers, URL-synced filters, a11y baseline. Guidance applied from `minimalist-ui`, `redesign-existing-projects`, `design-taste-frontend`, `web-design-guidelines`, `frontend-design`; source of truth is `frontend/DESIGN.md` |
| D25 | One daily workflow + auto-cleanup + manual trend status + plain-language UI | `pipeline:run` (01:00) batches every source, then chains detection → scoring → cleanup, so only `schedule:work` + `queue:work` run; `CleanupOldTrendsJob` soft-deletes trends idle 2+ days (posts survive); `workflow_status` (draft/ready/posted) is manually set and excluded from the nightly picker; all technical labels renamed (Automation, Post Studio, Originality, Overexposure, Style/Voice, "… Tip" formats, etc.) via shared label modules |

## 4. Progress Status

| Phase | Deliverable | Status |
|---|---|---|
| P1 | Scaffold, blueprint, schema (23 tables), seeders, Debugbar wiring | ✅ complete |
| P2 | Auth (60-min tokens), repositories, 5 collectors, pipeline jobs, scheduling, monitoring APIs, frontend auth | ✅ complete |
| P2.5 | Reddit removal, Lobste.rs source, GitHub token activation | ✅ complete |
| P3 | Trend clustering, configurable scoring engine, saturation analysis, Trends API, Explorer UI | ✅ complete |
| P4 | Dashboard polish + publishing-queue preview | ✅ complete |
| P5 | AI provider abstraction → research → post generation → quality gate | ✅ complete |
| P6 | Image studio: ray.so-style snippet renderer + AI image-prompt generator | ✅ complete |
| P7 | Content library, lifecycle UI, copy/download workflow, jobs monitoring screen, Settings | ✅ complete |
| P8 | AI gateway session-header repair, model refresh, focus/hack scoring, curated sources, hack post formats | ✅ complete |
| P9 | Design system (tokens, primitives, HelpTips), AppShell + mobile nav, theme toggle, shared format/status modules | ✅ complete |
| P10 | Grouped Studio, variant management, permanent delete (API + UI), editor full-width tabs, Visuals/CodeCard rebuild | ✅ complete |
| P11 | Intelligent hashtags: bundled generation, editable chips, AI suggest/backfill, copy integration | ✅ complete |
| P12 | Overview/Trends/Jobs/Settings/Auth refresh + model auto-discovery + YouTube expansion | ✅ complete |
| U1 | "Signal Desk" UI redesign — tokens, shell, pages, a11y (`frontend/DESIGN.md`, D25) | ✅ complete |
| P13 | Publishing channel abstraction + settings toggles (optional) | ⬜ next |
| P14 | Pest/Vitest tests, query profiling pass, hardening | ⬜ |

### Current system state (verified 2026-09-12)

- **633 source items** across 6 sources: RSS(218), HN(200), YouTube(90), GitHub(68), Lobste.rs(32), Dev.to(25)
- **403 trends** clustered and scored with the focus dimensions
- AI pipeline verified end-to-end; all posts have hashtags (12 backfilled via `posts:generate-hashtags --missing`)
- **Model resilience live**: auto-discovered fallbacks `deepseek-v4.1-flash`, `qwen3.8-flash`, `glm-5.1`
  (fastest working after probing the roster); both outage scenarios pass `scripts/verify-ai-fallback.php`
- **YouTube: 6 channels** (KodeKloud, Laravel Daily, Learn with Sumit, Web Dev Cody, ByteByteGo, CodeWithHarry),
  15 items/feed with view metrics captured
- Word-boundary reclassification corrected 46 existing trends in place (posts preserved)
- Dedup proven idempotent (re-run inserts 0); junk dampening live; collections auto-chain
  into clustering + scoring

## 5. Repository Layout

```
trend-discover-project/
├── docs/                    PLAN.md · ARCHITECTURE.md · API.md · RUNBOOK.md · COOKBOOK.md
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
| ~~Keyword-based category misclassification~~ | ✅ resolved — word-boundary matching (D15) + `trends:reclassify`; LLM classification remains a future refinement |
| Corpus too small for saturation signals to differentiate | Expected — saturation becomes meaningful as multi-day corpus grows |
| Gateway model churn (dead/renamed ids) | ✅ mitigated — strict allowlist + `ai:check-models` + stored-model self-healing; re-verify after gateway changes |
