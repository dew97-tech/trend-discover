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
php artisan trends:collect hn       # by type: hn|github|rss|devto|lobsters
php artisan trends:collect youtube  # by source name when a type has >1 source
php artisan trends:detect           # cluster ungrouped items + queue scoring
php artisan trends:score            # re-score all active trends
php artisan trends:score --trend=95 # score a single trend
php artisan trends:reclassify --dry-run  # what the word-boundary matcher would change
php artisan trends:reclassify       # re-sync techs/category on existing trends + re-score
php artisan ai:check-models         # live-probe every allowlisted AI model
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

**RSS/blog/YouTube feed (no code):**

1. Add `{name, url}` to the right source in `SourceSeeder` — blogs go under
   `engineering-rss`, videos under `youtube` (YouTube channel RSS:
   `https://www.youtube.com/feeds/videos.xml?channel_id=UC…`; find the ID via
   the channel page's `externalId` meta). `media:statistics` views are captured
   automatically and counted as views ÷ 200 in engagement.
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
