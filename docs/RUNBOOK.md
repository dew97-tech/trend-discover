# Runbook — Daily Operation & Troubleshooting

> Everything needed to run and debug Trend Discover on the dev machine.

---

## 1. Starting the stack (3 terminals)

```bash
# Terminal 1 — API + scheduler
cd "G:\Office Work Kandari\trend-discover-project\backend"
php artisan serve                # :8000
php artisan schedule:work        # cron runner for dev

# Terminal 2 — queue workers (pipeline)
php artisan queue:work --sleep=0 # add -v for verbose

# Terminal 3 — frontend
cd ../frontend
npm run dev                      # :5173 (proxies /api → :8000)
```

Login at `http://localhost:5173` — sessions last 60 minutes.

## 2. Manual pipeline commands

```bash
php artisan trends:collect          # collect from ALL enabled sources
php artisan trends:collect hn       # one source: hn|github|rss|devto|lobsters
php artisan trends:detect           # cluster ungrouped items + queue scoring
php artisan trends:score            # re-score all active trends
php artisan trends:score --trend=95 # score a single trend
```

Normal flow needs none of these — collection auto-chains detection which auto-chains
scoring. Use them for testing/tuning.

## 3. Database access

```bash
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" \
  -u trend_app -p trend_discover
```

Root password is in your password manager / `.env` history; app credentials live ONLY in
`backend/.env`. Key tables: `source_items` → `trend_source_item` → `trends` → `trend_signals`.

## 4. Resetting the derived data (items are kept)

```sql
SET FOREIGN_KEY_CHECKS=0;
TRUNCATE trend_signals; TRUNCATE trend_source_item;
TRUNCATE trend_technology; TRUNCATE trends;
SET FOREIGN_KEY_CHECKS=1;
```
Then `php artisan trends:detect` to rebuild clusters with current logic.
(Used repeatedly during Phase 3 tuning.)

## 5. Debugbar

- Visible on any Blade-rendered page; API requests store data server-side and return a
  `phpdebugbar-id` header.
- Enabled only when `APP_ENV=local && APP_DEBUG=true`.
- Collectors on: queries(+EXPLAIN), cache, timeline, memory, jobs, HTTP client, route,
  models, phpinfo/env.

## 6. Known pitfalls & their fixes (learned the hard way)

| Symptom | Cause | Fix |
|---|---|---|
| cURL error 60 SSL | Windows PHP has no CA bundle | `curl.cainfo`/`openssl.cafile` = `C:/tools/cacert.pem` in `C:\php\php.ini` (already set) |
| Job silently never runs after `queue:clear` | ShouldBeUnique lock persists | `DELETE FROM cache_locks;` |
| 401 from GitHub in worker but OK in tinker | stale long-running processes hold old config | kill stray `php.exe artisan serve`/workers (`tasklist`, `taskkill //PID x //F`) |
| Eloquent says table `source_item_trend` missing | default pivot naming vs our migration | pivot names are explicit in all `belongsToMany` calls |
| Titles like `[Dev.to/php] …` block cross-source merge | collector prefixes pollute shingles | stripped inside `TitleSimilarity::tokenize` |
| **API field is `{}` object but only on some requests** | rich object (Collection/Model) cached via `Cache::remember`; unserialize → `__PHP_Incomplete_Class` → JSON object | **Plain arrays/scalars only ever cross a cache boundary** (`->values()->all()` / `->resolve()`). See DashboardController §recent_content. Blank screens client-side = check ErrorBoundary output first. |

## 7. Adding a new source (checklist)

1. Create `app/Domain/Trending/Collectors/MyCollector.php` implementing
   `CollectorInterface` → return `Collection<RawItem>`
2. Add case to `App\Enums\SourceType` (+ value string)
3. Add match arm in `CollectorFactory`
4. Add config entry in `SourceSeeder` + insert row into `sources` (or re-seed)
5. Optional: schedule line in `routes/console.php`
6. Test: `php artisan trends:collect <type>` then `queue:work --stop-when-empty`,
   verify rows in `source_items`, second run must insert 0

## 8. Tuning knobs

| Knob | Where | Effect |
|---|---|---|
| Scoring weights | `system_settings` key `scoring.weights.default` | composite formula (hot) |
| Cluster threshold | `TrendClusterer` ctor default 0.55 | title-merge aggressiveness |
| Saturation sibling threshold | `SaturationAnalyzer` 0.45 | what counts as duplicate coverage |
| Source filters (min points/stars/score, windows) | `sources.config` JSON | per-source quality bar |
| Junk flag thresholds | `TrendClusterer::qualityFlags()` | star-farm detection sensitivity |
| AI model | `.env` `OPENCODE_GO_MODEL` | allowlist: ox-alpha-free, hy3, mimo-v2.5 |

## 8b. OpenCode Go gateway notes

- `OPENCODE_GO_BASE_URL` = **API root** (e.g. `https://opencode.ai/zen/go/v1`).
  The provider appends `/chat/completions`; pasting the full endpoint also works
  (defensively normalized in `OpenCodeGoProvider::apiRoot()`).
- Model output is decoded defensively: direct JSON → markdown-fenced → brace-extracted.
- **Reasoning models** (hy3, mimo-v2.5) stream chain-of-thought into a separate
  `reasoning_content` field. If `max_tokens` is exhausted by thinking, `content`
  arrives EMPTY with `finish_reason=length`. Counters, in order
  (`OpenCodeGoProvider::completeWithEscalation`):
    1. Per-model `reasoning_effort` from its profile (hy3 → `none` = direct answers)
    2. On empty+length: lower effort one step, then double max_tokens (up to ×4)
    3. Truthful error after ladder exhaustion — never a generic "empty content"
- Profiles live in `config/ai.php`; model switchable at runtime via Settings.
- ⚠️ **Go-tier model IDs differ from the public Zen docs table.** Verified live:
  `ox-alpha-free`, `hy3`, `mimo-v2.5` (docs list `mimo-v2.5-free` / `x-preview-f-free`
  for the general tier — those 401 on the Go endpoint). Trust only the
  `on_gateway` flag from `GET /api/settings/models`; unavailable models are
  disabled in the Settings picker and can't be selected.
- **Cheapest-first fallback** (`OpenCodeGoProvider::complete`): gateway 5xx /
  unsupported-model errors walk `fallback_order` from `config/ai.php`
  (ox-alpha-free → mimo-v2.5 → hy3); empty-content reasoning burn escalates
  budget once on-model before switching. Every transition lands in the
  pipeline log; `scripts/verify-ai-fallback.php` replays a simulated outage.
- Failed AI calls are recorded in `ai_generations` with `status=failed`
  (+ model, duration, error) — check there when generations misbehave.
- Stale "running" job rows self-heal: `jobs:reconcile-stale` runs every
  15 minutes and marks anything stuck >2h as failed.

## 8c. Pipeline logging

- Channel `pipeline` (daily file, 14-day retain): every job logs structured events
  tagged `[JobName run={id}]` — start/finish/verdicts/failures included.
- `GET /api/jobs/{id}/log` returns that run's lines; the Pipeline Jobs screen
  expands rows to show them inline. Re-score toasts link straight to the screen.
- **All AI operations are queued** — snippet suggestion and image prompts too
  (`SuggestSnippetJob` / `GenerateImagePromptJob`, unique per post). Controllers
  create `pending` ContentImage rows and return 202 instantly; workers fill them
  (AI calls take 30–90s+, which would fatal inside web requests). Frontend polls
  the images endpoint; failed rows surface a retry button.

## 8d. Trend lifecycle

- `DELETE /api/trends/{id}` = **soft delete**: trend hidden from all queries,
  source items detached (free to re-cluster), generated posts preserved in library.
- `POST /api/trends/{id}/restore` brings it back; both write to the pipeline log.
- Manual detection: `POST /api/pipeline/detect` or the "Run detection" button
  on Pipeline Jobs — same path as the auto-chain after collections.

## 9. Git conventions

- Commit per phase: `Phase N: <summary>` · main branch · no secrets ever committed
  (`.env` gitignored by Laravel default).
