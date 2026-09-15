# Trend Discover

A local-first trend intelligence tool for software engineers, with a LinkedIn publishing workflow built in.

Trend Discover watches the places engineers actually read, groups the stories into trends, scores each trend for how interesting and useful it is, and helps you turn the best ones into posts. Everything runs on your machine: the API, the database and the AI calls.

## The goal

Most trend feeds rank by popularity, so you mostly see what is already everywhere. Trend Discover ranks for practical value and originality first, and treats overexposure as a penalty. The result is a short daily list of topics worth discussing while they are still fresh.

## What it does

- **Collect** - Hacker News, GitHub, Lobste.rs, Dev.to, engineering RSS feeds and six YouTube channels, refreshed on a schedule with duplicate protection.
- **Group** - related mentions are clustered into trends, with word-boundary technology matching.
- **Score** - freshness, buzz, topic match, practical value, focus, originality and overexposure, with weights you can tune in Settings.
- **Draft** - AI-researched LinkedIn posts in multiple styles, voices and angles, always grounded in the sources behind the trend.
- **Check** - a quality gate scores every draft, and "Suggest improvement" lets you describe a correction and get a targeted revision.
- **Publish** - copy-ready post text, hashtags, a LinkedIn-style preview and shareable code cards exported at 1200x1200.

## The workspace

| Page | What it is for |
|---|---|
| Overview | Today's generated post, key metrics, recommended topics and the publishing queue. |
| Trends | Every trend with its score breakdown, filters and manual review status. |
| Studio | Posts grouped by trend, with variants per style, voice and angle. |
| Library | Search and manage every post by status. |
| Automation | Pipeline runs with durations, failures and per-run logs. |
| Settings | Scoring weights, AI model fallback and usage limits, data sources. |

## How it works

Pipeline: `collect -> cluster -> score -> cleanup -> nightly post`, scheduled daily and executable on demand.

- Backend: Laravel 13 API, MySQL 8, database queue and scheduler. No Redis required.
- Frontend: React 19 + Vite + Tailwind v4 single-page app (design system documented in frontend/DESIGN.md).
- AI: a provider abstraction with automatic model discovery and fallback, so a changing gateway roster does not break generation.

## Getting started

Requirements: PHP 8.3+, Composer, Node 20+, MySQL 8.

1. Backend

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
# set DB_* and the AI gateway values (OPENCODE_GO_API_KEY, OPENCODE_GO_BASE_URL) in .env
php artisan migrate --seed
php artisan serve
```

2. Frontend (second terminal)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Login sessions last 60 minutes.

To run the scheduler, queue worker and dev server together:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-stack.ps1
```

Optional: set `GITHUB_TOKEN` in `.env` to raise GitHub API limits.

## Documentation

- docs/ARCHITECTURE.md - pipeline, data model and design decisions
- docs/API.md - endpoint reference
- docs/RUNBOOK.md - daily operation and troubleshooting
- docs/COOKBOOK.md - the nightly post workflow
- docs/PLAN.md - roadmap, progress and decision log
- frontend/DESIGN.md - the Signal Desk UI system

## Status

Actively developed. Current focus: the publishing workflow and automated quality checks.
