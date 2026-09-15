# Runbook — Daily Operation & Troubleshooting

> Everything needed to run and debug Trend Discover on the dev machine.

---

## 1. Starting the stack

```powershell
# one command: opens scheduler + worker (+ frontend) in separate terminals
powershell -ExecutionPolicy Bypass -File scripts/start-stack.ps1

# ...or manually (2 terminals):
cd "G:\Office Work Kandari\trend-discover-project\backend"
php artisan serve                 # :8000 (API)
php artisan schedule:work         # triggers pipeline:run daily at 01:00
php artisan queue:work --sleep=1  # executes every job (fetch → trends → score → cleanup)
```

That is the whole daily workflow — `pipeline:run` fetches every enabled source, then
finds/groups new trends, scores them and cleans up stale trends, all automatically.
Frontend: `cd ../frontend; npm run dev` → http://localhost:5173 (proxies `/api` → :8000).
Login sessions last 60 minutes.

## 2. Manual pipeline commands

```bash
php artisan pipeline:run            # full daily workflow (fetch → trends → score → cleanup)
php artisan pipeline:run --dry-run  # list the sources that would be fetched
php artisan trends:collect          # collect from ALL enabled sources
php artisan trends:collect hn       # by type: hn|github|rss|devto|lobsters
php artisan trends:collect youtube  # by source name when a type has >1 source
php artisan trends:detect           # cluster ungrouped items + queue scoring
php artisan trends:score            # re-score all active trends
php artisan trends:score --trend=95 # score a single trend
php artisan trends:cleanup --dry-run  # trends with no activity for 2+ days
php artisan trends:cleanup            # soft-delete them (posts stay, restorable)
php artisan trends:reclassify --dry-run  # what the word-boundary matcher would change
php artisan trends:reclassify       # re-sync techs/category on existing trends + re-score
php artisan ai:check-models         # live-probe allowlisted + auto-discovered AI models
php artisan ai:refresh-models       # re-discover the 3 fastest working fallbacks
php artisan posts:generate-hashtags --missing  # backfill AI hashtags for posts without them
php artisan posts:split-hooks --apply   # strip duplicated hook lines from pre-separation bodies
php artisan posts:nightly --dry-run # today's LinkedIn post candidates (no AI call)
php artisan posts:nightly           # generate + export today's LinkedIn post
```

Normal flow needs none of these — `pipeline:run` runs daily at 01:00 via `schedule:work`,
then `trends:score` (02:00) and `posts:nightly` (02:30). Use them for testing/tuning.
Stale trends (no activity for 2+ days) are cleaned up automatically at the end of the
pipeline; `posts:nightly` never picks trends marked **Posted**.

## 3. Database access

```bash
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u trend_app -p trend_discover
```

MySQL prompts for the password. The app credentials live ONLY in `backend/.env`
(`DB_USERNAME`, `DB_PASSWORD`). Key tables: `source_items` → `trend_source_item` → `trends` → `trend_signals`.

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
| `Generate post` says queued but nothing in the worker | Identical style/voice/angle already queued, or a stale unique lock from a cleared queue | The API now answers **409** with the reason — wait or change the angle. Stale lock: `DELETE FROM cache_locks;` |
| Very long custom angle did nothing (fixed) | Unique lock key embedded the raw angle → overflowed `cache_locks.key` varchar(255); Laravel swallowed the insert error and dropped the dispatch silently | Fixed — `GeneratePostJob::uniqueId()` hashes the spec (key ~110 chars). Keep new unique IDs short/hashed |
| `Unknown prompt template […]` / stale model config in jobs | long-running `queue:work` keeps the config it booted with | **After editing `config/*.php` or prompts: `php artisan queue:restart`** (workers respawn with fresh config). `config:clear` alone is not enough for a running worker. |
| 401 from GitHub in worker but OK in tinker | stale long-running processes hold old config | kill stray `php.exe artisan serve`/workers (`tasklist`, `taskkill //PID x //F`) |
| Eloquent says table `source_item_trend` missing | default pivot naming vs our migration | pivot names are explicit in all `belongsToMany` calls |
| Titles like `[Dev.to/php] …` block cross-source merge | collector prefixes pollute shingles | stripped inside `TitleSimilarity::tokenize` |
| **API field is `{}` object but only on some requests** | rich object (Collection/Model) cached via `Cache::remember`; unserialize → `__PHP_Incomplete_Class` → JSON object | **Plain arrays/scalars only ever cross a cache boundary** (`->values()->all()` / `->resolve()`). See DashboardController §recent_content. Blank screens client-side = check ErrorBoundary output first. |

## 7. Adding a new source (checklist)

**RSS/blog/YouTube feed (no code):**

1. Add `{name, url}` to the right source in `SourceSeeder` — blogs go under
   `engineering-rss`, videos under `youtube` (YouTube channel RSS:
   `https://www.youtube.com/feeds/videos.xml?channel_id=UC…`; find the ID via
   the channel page's `externalId` meta — a consent cookie
   `CONSENT=YES+cb.20210328-17-p0.en+FX+917` makes the page render without the
   redirect). `media:statistics` views are captured automatically and counted as
   views ÷ 200 in engagement. Current channels: KodeKloud, Laravel Daily,
   Learn with Sumit, Web Dev Cody, ByteByteGo, CodeWithHarry.
2. `php artisan db:seed --class=SourceSeeder`
3. Optional cron line in `routes/console.php` (youtube already runs at `35 */6`)
4. Test: `php artisan trends:collect <source-name>` then `queue:work --stop-when-empty`;
   verify rows in `source_items`, second run must insert 0

**New API collector (code):**

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
| Scoring weights | `system_settings` key `scoring.weights.default` | composite formula (hot); composite is normalized by the sum of positive weights so old sets keep working |
| Focus topics | `config/trending.php` `focus.*` | which tech slugs / categories earn the `topic_focus` boost (soft, never hides trends) |
| Hack keywords | `config/trending.php` `hack_keywords` | tips/tricks/hacks phrasing that boosts usefulness + sets the `hack_style` badge |
| Cluster threshold | `TrendClusterer` ctor default 0.55 | title-merge aggressiveness |
| Saturation sibling threshold | `SaturationAnalyzer` 0.45 | what counts as duplicate coverage |
| Source filters (min points/stars/score, windows) | `sources.config` JSON | per-source quality bar |
| Junk flag thresholds | `TrendClusterer::qualityFlags()` | star-farm detection sensitivity |
| AI model | Settings UI (`system_settings.ai.model`) or `.env` `OPENCODE_GO_MODEL` | allowlist: mimo-v2.5 (default), deepseek-v4-flash, glm-5.3-flash |

## 8b. OpenCode Go gateway notes

- `OPENCODE_GO_BASE_URL` = **API root** (e.g. `https://opencode.ai/zen/go/v1`).
  The provider appends `/chat/completions`; pasting the full endpoint also works
  (defensively normalized in `OpenCodeGoProvider::apiRoot()`).
- ⚠️ **`x-opencode-session` header is mandatory** (gateway rule, 2026-09). Without
  it every model returns `400 MissingSessionID` and the whole AI layer silently
  fails. The provider sends a stable UUID: `OPENCODE_GO_SESSION_ID` env → or
  auto-generated once and persisted in `system_settings('ai.session_id')`.
  If generations suddenly stop with MissingSessionID, check that setting exists.
- Model output is decoded defensively: direct JSON → markdown-fenced → brace-extracted.
- **Reasoning models**: all allowlisted models stream chain-of-thought into a
  separate `reasoning_content` field. `reasoning_effort` rules verified live:
  `mimo-v2.5` accepts `none`; `deepseek-v4-flash` and `glm-5.3-flash` need `low`
  (glm rejects `none` with "always engages in thinking", and rejects
  `max_tokens <= 1024`). Profiles encode this; `max_output` is 8192 for all three.
  If `max_tokens` is exhausted by thinking, `content` arrives EMPTY with
  `finish_reason=length`; the provider then doubles the budget once before
  falling to the next model.
- Profiles live in `config/ai.php`; model switchable at runtime via Settings.
- **Allowlist (verified 2026-09-12):** `mimo-v2.5` (default), `deepseek-v4-flash`,
  `glm-5.3-flash`. Removed: `ox-alpha-free` (gateway dropped it),
  `hy3` (upstream 400). The Go tier's `/models` listing can be broader than what
  actually answers — **trust `php artisan ai:check-models`**, not the docs table
  or the `on_gateway` flag alone (which only checks listing membership).
- **Reliability-ordered fallback** (`OpenCodeGoProvider::complete`): gateway 5xx /
  unsupported-model / empty-content errors walk `fallback_order` from
  `config/ai.php` (mimo-v2.5 → deepseek-v4-flash → glm-5.3-flash). All Go-tier
  calls report `cost: 0`, so the order favors verified reliability, not price.
  If the stored `ai.model` is no longer allowlisted, the provider logs and
  self-heals to the config default instead of hard-failing.
  Every transition lands in the pipeline log; `scripts/verify-ai-fallback.php`
  replays a simulated outage and asserts the session header is present.
- **Model auto-discovery (fallbacks that never expire):** `php artisan ai:refresh-models`
  (scheduled daily 03:20) fetches `/zen/go/v1/models`, ranks candidates cheap/fast-first
  (`config/ai.php` → `auto_discover`), probes the top 10 with tiny requests and stores
  the 3 fastest working ids in `system_settings('ai.auto_models')` — excluding the
  configured allowlist so the fallbacks add coverage. The provider appends them after
  the allowlist, and dispatches `RefreshAiModelsJob` automatically when the whole chain
  fails (unique per hour). Both outage scenarios are covered by
  `scripts/verify-ai-fallback.php`. Manage or trigger from Settings → **Model resilience**.
- ⚠️ OpenCode's general-tier free models (`big-pickle`, `mimo-v2.5-free`, …) are
  **API-blocked** ("free tier can only be used in OpenCode"). Discovery therefore uses
  the Go subscription roster only; never point the app at the general `/zen/v1`
  endpoint (it would bill credits instead of using the Go plan).
- Failed AI calls are recorded in `ai_generations` with `status=failed`
  (+ model, duration, error) — check there when generations misbehave.
- Stale "running" job rows self-heal: `jobs:reconcile-stale` runs every
  15 minutes and marks anything stuck >2h as failed.

## 8c. Pipeline logging

- **Per-job daily files**: every job run writes to
  `storage/logs/jobs/{job-kebab}-YYYY-MM-DD.log` — e.g.
  `collect-source-items-2026-09-13.log`, `detect-trends-2026-09-13.log`,
  `generate-post-2026-09-13.log`. Retention 30 days
  (`LOG_JOBS_MAX_FILES`, dir override `LOG_JOBS_DIR`).
- Every line keeps the `[JobName run={id}]` marker, so `GET /api/jobs/{id}/log`
  filters one execution out of its job's daily file; the Pipeline Jobs screen
  expands rows to show them inline. Legacy `pipeline-*.log` files are still
  read so pre-migration runs remain inspectable.
- Services/commands that log outside a job context (e.g. `ModelCatalogService`,
  `TrendController`) still use the `pipeline` channel — a 14-day daily file.
  `CollectSourceItemsJob` was moved onto the per-job channel; it no longer
  leaks to `laravel.log`.
- `RunLogger::fileStem()` maps a job class to its file stem (accepts FQCN or
  basename); add a new job and logging works with zero config.
- **All AI operations are queued** — snippet suggestion and image prompts too
  (`SuggestSnippetJob` / `GenerateImagePromptJob`, unique per post). Controllers
  create `pending` ContentImage rows and return 202 instantly; workers fill them
  (AI calls take 30–90s+, which would fatal inside web requests). Frontend polls
  the images endpoint; failed rows surface a retry button.

## 8c.1 Nightly LinkedIn post (`posts:nightly`)

```bash
php artisan posts:nightly              # generate today's post + export
php artisan posts:nightly --dry-run    # ranked candidates, no AI call
php artisan posts:nightly --trend=95   # force a trend
php artisan posts:nightly --format=architecture_insight
php artisan posts:nightly --force      # another post even if today's exists
```

- **Selection**: `TrendRepository::dailyCandidates()` ranks by
  `focus 0.35 + usefulness 0.45 + trend_score 0.20`, drops saturation >70 and
  usefulness <55, excludes trends posted in the last 7 days, then prefers
  `metrics.hack_style` / practical-phrasing candidates (tip, optimiz, cache,
  index, architecture, …).
- **Format**: topic-aware — SQL/MySQL/Postgres topics → SQL Hack, Laravel →
  Laravel Hack, React/Next.js → their hack formats; otherwise a
  day-index rotation across tips/optimization/architecture/performance.
- Runs synchronously (no worker needed) through `PostGenerationService` +
  `QualityGateService`; budget guard skips when <4 AI calls remain.
- **Export**: `storage/app/private/daily-posts/{date}-{slug}.md` (context +
  metadata) and `.txt` (body + `#hashtags`, paste-ready). Also printed to
  stdout. Scheduled daily at 02:30 after the 02:00 re-score.

## 8d. Post lifecycle & Studio

- **Studio** (`/studio`) groups posts under the trend they came from: variant rows show
  format · tone · angle, quality, hashtag count and status. "New variant" re-opens the
  format picker for that trend; the editor has a variant switcher for siblings.
- `DELETE /api/posts/{id}` is **permanent** — versions and image rows cascade and stored
  files under `storage/app/public/post-images/{post}` are purged. `DELETE /api/posts?trend_id=`
  removes all variants of a trend. Both are behind confirmation dialogs in the UI.
- **Hashtags**: generated together with the post (3–5, PascalCase, no `#`), editable as
  chips in the editor, and appended to the clipboard text when "Copy for LinkedIn" runs
  (toggle in the Preview tab). Old posts can be backfilled with
  `posts:generate-hashtags --missing` + a worker, or per-post via the editor button.
- **Mark as posted**: Studio rows, the Library menu, the editor action bar and the
  dashboard Today's-post tile all call `POST /api/posts/{id}/status` with `published`;
  the Copy-for-LinkedIn toast also offers a one-click action. This stamps
  `published_at` + `published_channel=linkedin`, marks the source trend **Posted**
  (the nightly picker stops suggesting it) and moves the post to the Posted tabs.
  **Unmark as posted** clears the stamp and restores the trend to Ready when no other
  published post remains. Soft-deleted trends never block the transition.
- **Snippet cards**: the Visuals tab derives a code card via AI; the card is designed at
  1x and exported at 2x (**1200×1200** / **1200×628**) with Shiki highlighting and
  JetBrains Mono, so code stays readable in the LinkedIn feed. **Copy image** puts the
  PNG straight on the clipboard.
- **Hook & Body are separate fields** — the body never contains the hook. Copy-for-LinkedIn,
  the dashboard Today's-post button, and `posts:nightly` compose `hook + blank line + body`
  so the published text is complete exactly once. Pre-separation posts were repaired with
  `php artisan posts:split-hooks` (dry-run by default; `--apply` strips the duplicated
  hook only when the body's first line matches the Hook field; mismatches are reported).
- **Suggest improvement (AI revisions)**: Hook and Body each have a button that opens a
  correction box (optional "paste a reference version"). Queues `RevisePostJob` →
  `post_revisions` proposal; **Apply** writes only the targeted field, creates a version,
  and queues a quality re-check; **Discard** keeps the proposal as history. One pending
  suggestion per target. Proposals use trend research as ground truth and are length-capped
  (hook ≤210 chars, body ±15%). The Preview tab has a **Raw text** switch showing exactly
  what gets copied.

## 8e. Trend lifecycle

- `DELETE /api/trends/{id}` = **soft delete** (labelled "Remove trend" in the UI):
  trend hidden from all queries, source items detached (free to re-cluster), generated
  posts preserved in the library.
- `POST /api/trends/{id}/restore` brings it back; both write to the pipeline log.
- **Automatic cleanup**: `CleanupOldTrendsJob` runs at the end of every daily pipeline and
  soft-deletes trends with no activity (`last_seen_at`) for 2+ days
  (`TREND_CLEANUP_DAYS` / `config/trending.php`). Posts survive; trends are restorable.
  Manual: `trends:cleanup --dry-run` then `trends:cleanup`.
- **Workflow status** (manual): `PATCH /api/trends/{id}/workflow-status` with
  `draft|ready|posted`. Set it from the Trends page (filter + badge + detail dialog).
  `posted` trends are excluded from the nightly post picker.
- Manual detection: `POST /api/pipeline/detect` or the "Find new trends" button
  on Automation — same path as the pipeline's detection step.

## 9. Git conventions

- Commit per phase: `Phase N: <summary>` · main branch · no secrets ever committed
  (`.env` gitignored by Laravel default).

## 10. Tests

```bash
cd backend
php artisan test                        # full suite (PHPUnit, sqlite :memory:)
php artisan test --filter=RunLogger     # log-driver suite
php artisan test --filter=NightlyPost   # nightly selection suite
```

- The suite uses SQLite `:memory:` (see `phpunit.xml`), so `pdo_sqlite` and
  `sqlite3` must be enabled in `C:\php\php.ini` (both are on this machine;
  a backup of the pre-change ini is at `C:\php\php.ini.bak-opencode`).
- Migrations skip MySQL-only FULLTEXT indexes on non-MySQL drivers, so a fresh
  MySQL install keeps identical indexes while tests run anywhere.
- Current coverage: `RunLogger::fileStem` mapping, per-job log file writing
  (one file per job per day, no shared pipeline file), nightly candidate
  filtering/ranking, practical-preference, recency exclusion, and format
  matching/rotation.
