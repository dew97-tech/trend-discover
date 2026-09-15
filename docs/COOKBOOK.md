# COOKBOOK — Run Locally, Ship One LinkedIn Post a Day

> Practical playbook for the local-first workflow: every night the pipeline collects,
> clusters and scores trends; every morning you open one file, copy the post, paste it
> into LinkedIn.
>
> Companion docs: `RUNBOOK.md` (commands/troubleshooting) · `ARCHITECTURE.md` (how the
> engine works) · `PLAN.md` (roadmap) · `API.md` (endpoints).

---

## 1. One-time setup

```bash
cd "G:\Office Work Kandari\trend-discover-project\backend"
composer install
php artisan migrate --seed              # creates schema + sources/taxonomy

cd ../frontend
npm install
```

Check these in `backend/.env` once:

| Key | Why |
|---|---|
| `DB_*` | MySQL 8 local connection (`trend_discover` / `trend_app`) |
| `OPENCODE_GO_API_KEY` | AI provider for research, posts, hashtags, quality gate |
| `OPENCODE_GO_MODEL` | default `mimo-v2.5`; fallbacks are auto-discovered |
| `LOG_CHANNEL=stack`, `LOG_LEVEL=debug` | normal Laravel logging |
| `LOG_JOBS_DIR=logs/jobs`, `LOG_JOBS_MAX_FILES=30` | optional per-job log overrides |

---

## 2. Daily rhythm (the actual habit)

### Morning — 3 minutes

1. Open the backend’s exported post:

   ```powershell
   Get-Content "backend\storage\app\private\daily-posts\$(Get-Date -Format yyyy-MM-dd)-*.txt"
   ```

2. Or open the dashboard at `http://localhost:5173` → **Today's post** card →
   **Copy for LinkedIn** (hashtags included).
3. Paste into LinkedIn, publish.
4. Optional polish: **Open in Studio** to tweak the hook/body or generate a code card
   visual (Visuals tab → **Copy image**, then paste both into LinkedIn), then
   **Copy for LinkedIn** from the editor.

### Nightly — automated (if the stack is running)

| Time | Command | What it does |
|---|---|---|
| 01:00 | `pipeline:run` | fetch all sources → find trends → score → cleanup stale trends |
| 02:00 | `trends:score` | re-scores all active trends (decay stays honest) |
| 02:30 | `posts:nightly` | picks the most useful trend, generates + exports the post |
| 03:20 | `ai:refresh-models` | re-discovers fast/working AI fallbacks |
| every 15 min | `jobs:reconcile-stale` | marks dead worker runs as failed |

Keep two processes alive: `php artisan schedule:work` (or Windows Task Scheduler) and
`php artisan queue:work` — that is the whole workflow. `scripts/start-stack.ps1` opens
both (plus the frontend) for you. `posts:nightly` itself is synchronous — it works even
with no worker running.

Trends with no activity for 2+ days are removed automatically at the end of the pipeline
(soft delete: posts stay, any trend can be restored). Mark a trend **Ready** when it is
worth writing about and **Posted** once you published — posted trends are never picked
again.

---

## 3. Generate a post on demand

```bash
cd backend

php artisan posts:nightly --dry-run          # see today's ranked candidates
php artisan posts:nightly                    # generate for the best candidate
php artisan posts:nightly --trend=95         # force a trend (id from the Explorer)
php artisan posts:nightly --format=architecture_insight
php artisan posts:nightly --force            # extra post even though one exists today
```

Outputs (always the same shape):

```
storage/app/private/daily-posts/2026-09-13-<slug>.md    # context, trend, scores, post
storage/app/private/daily-posts/2026-09-13-<slug>.txt   # body + hashtags → clipboard
```

The command prints the full post to stdout too, then reports the quality verdict
(`ready` / `review` / `draft`). A `review` verdict is normal — read it, fix one line,
publish.

### How the pick works (why it stops being “random trends”)

1. `dailyCandidates()` ranks active trends: `focus×0.35 + usefulness×0.45 + trend_score×0.20`,
   excludes saturation >70, usefulness <55, and anything posted in the last 7 days.
2. Practical material wins: `metrics.hack_style` trends or titles/summaries with
   tip/trick/guide/optimiz/cache/index/architecture/debug/scale signals.
3. Format is topic-aware: SQL/MySQL/Postgres → `SQL Hack`; Laravel → `Laravel Hack`;
   React/Next.js → their hacks; otherwise a day-index rotation through
   `quick_tip → optimization_tip → architecture_insight → performance_breakdown → technical_insight`
   (so two consecutive nights never repeat the same shape).
4. Content stays grounded: research comes from the trend’s actual source items, and the
   quality gate rejects banned openers, emoji spam and sourceless percentages.

---

## 4. Logging: where to look when something breaks

Each job writes its own daily file — no more digging through one global log:

```
storage/logs/jobs/
├── collect-source-items-2026-09-13.log
├── detect-trends-2026-09-13.log
├── calculate-trend-score-2026-09-13.log
├── generate-post-2026-09-13.log
├── generate-hashtags-2026-09-13.log
├── generate-image-prompt-2026-09-13.log
├── suggest-snippet-2026-09-13.log
└── refresh-ai-models-2026-09-13.log
```

Recipes:

```powershell
# watch tonight's collection live
Get-Content backend\storage\logs\jobs\collect-source-items-$(Get-Date -Format yyyy-MM-dd).log -Wait

# everything from one job run (run id shown in the Jobs screen)
Select-String -Path backend\storage\logs\jobs\*.log -Pattern "run=2340\]"

# yesterday's detection
Get-Content backend\storage\logs\jobs\detect-trends-((Get-Date).AddDays(-1).ToString('yyyy-MM-dd')).log
```

- `GET /api/jobs/{id}/log` returns exactly that run’s lines (read from the per-job
  file; old `pipeline-*.log` history still resolves).
- Service logs outside a job (model catalog, trend deletes) stay in
  `storage/logs/pipeline-YYYY-MM-DD.log`.
- Add a new job → logging works automatically; the file name is the kebab-case class
  name minus the `Job` suffix.

---

## 5. Cookbook by goal

### “The AI got something wrong”

1. Open the post in Studio → **Write** tab.
2. Click **Suggest improvement** next to the Hook or Body field.
3. Describe the correction precisely, e.g. *“Barrel files don’t always break
   tree-shaking — add nuance, keep the same length.”* Found a better version online?
   Paste it into **Paste a reference version (optional)** — the AI adapts its accuracy,
   never copies it verbatim.
4. Any unsaved edits are saved first. The AI grounds the rewrite in the trend’s
   research; it cannot invent new statistics.
5. Review the proposal (notes + char delta + **Compare with current version**), then
   **Apply to post** (creates a version, re-runs the quality gate) or **Discard**.
6. Check the Preview tab → **Raw text** to confirm exactly what will be pasted, then
   **Copy for LinkedIn**.

Suggestions are per-field and kept as history; only one can be pending per field, and a
new request supersedes the old one. Hook and body are independent — a hook suggestion
never rewrites the body, and Copy for LinkedIn always publishes `hook + blank line + body`
exactly once.

### “I want a different flavour of content”

- Force a format: `--format=debugging_story` / `case_study` / `engineering_lesson` /
  `performance_breakdown` (see `app/Enums/ContentFormat.php` for all 17).
- Bias the trends themselves with `config/trending.php`: add `hack_keywords` or focus
  technology slugs, then `php artisan trends:reclassify` to re-tag existing trends.
- Tighten the pool: raise the usefulness threshold in
  `TrendRepository::dailyCandidates()` (`>= 55`) or lower the saturation ceiling.

### “The AI failed / gateway is flaky”

```bash
php artisan ai:check-models      # live-probe allowlist + auto-discovered models
php artisan ai:refresh-models    # re-rank and store 3 fastest working fallbacks
```

Generation failures are forensics-visible in `ai_generations` (status, model, latency,
error) and in `generate-post-*.log`. `--force` re-runs; the cache returns the previous
post otherwise (idempotent by trend+format+tone+angle).

### “Trends look stale”

```bash
php artisan trends:collect        # all sources (or hn|github|rss|devto|lobsters|youtube)
php artisan queue:work --stop-when-empty
php artisan trends:score          # optional full re-score
```

### “I edited config/prompts/scoring — nothing changed”

Long-running workers hold the config they booted with:

```bash
php artisan queue:restart
```

### “I want to see what the pipeline is doing right now”

- Dashboard → failed-jobs banner + live tiles (15 s refresh).
- Jobs screen → last 50 runs with durations, meta, per-run log expansion.
- `php artisan jobs:reconcile-stale` cleans up rows left by a killed worker.

---

## 6. Quality checklist before pasting into LinkedIn

- [ ] Hook is the first line and reads standalone (LinkedIn truncates at ~2 lines).
- [ ] Body has a concrete takeaway: a command, a before/after, a trade-off.
- [ ] No born-AI openers (“In today’s…”, “Did you know…”) — the gate flags them.
- [ ] Numbers have sources, or were removed.
- [ ] Hashtags: 3–5 focused tags (the generator targets this; edit in Studio if needed).
- [ ] Optional: add the code card visual from Studio → Visuals. Pick a theme and
      padding, then **Copy image** and paste it into LinkedIn (or download the PNG).
      Exports are 1200×1200 square / 1200×628 landscape, 2x-rendered so the code stays
      readable in the feed.

---

## 7. Weekly maintenance (10 minutes)

```bash
# Keep the DB lean — reset derived clusters, keep source items
mysql -u trend_app -p trend_discover
```

```sql
SET FOREIGN_KEY_CHECKS=0;
TRUNCATE trend_signals; TRUNCATE trend_source_item;
TRUNCATE trend_technology; TRUNCATE trends;
SET FOREIGN_KEY_CHECKS=1;
```

```bash
php artisan trends:detect        # rebuild clusters with current logic
php artisan queue:work --stop-when-empty
```

- Check `storage/logs/jobs/` size; retention is 30 days per job (`LOG_JOBS_MAX_FILES`),
  `pipeline` 14 days.
- `php artisan posts:generate-hashtags --missing` backfills hashtags if an old post
  slipped through without them.

---

## 8. File map cheat sheet

| Looking for… | File |
|---|---|
| Nightly pick logic | `app/Console/Commands/GenerateNightlyPostCommand.php` |
| Candidate ranking | `app/Repositories/Eloquent/TrendRepository.php` → `dailyCandidates()` |
| Log routing | `app/Support/RunLogger.php`, `config/logging.php` → `jobs` |
| Per-run log API | `app/Http/Controllers/Api/JobRunController.php` |
| Post quality rules | `app/Services/AI/QualityGateService.php` |
| Content formats + prompts | `app/Enums/ContentFormat.php`, `config/prompts.php` |
| Focus topics + hack keywords | `config/trending.php` |
| Schedule | `routes/console.php` |
| Exports | `storage/app/private/daily-posts/` |
| Job logs | `storage/logs/jobs/` |
