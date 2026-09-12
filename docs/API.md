# API Reference

Base URL: `http://localhost:8000/api` (dev). All responses JSON.
Auth: `Authorization: Bearer <token>` — tokens expire **60 minutes** after issue.

---

## Authentication

### `POST /auth/register`
```json
{ "name": "Dew Mallick", "email": "dew@trend.local",
  "password": "…", "password_confirmation": "…" }
```
**201** → `{ user: {id, name, email, created_at}, token, expires_at }` (auto-login)

### `POST /auth/login`  (throttled 5/min per email+IP)
```json
{ "email": "dew@trend.local", "password": "…" }
```
**200** → same shape as register. Wrong credentials → **422**
`{ message: "The provided credentials are incorrect." }`

### `POST /auth/logout` 🔒 — revokes the current token
### `GET /auth/me` 🔒 → current user

Unauthenticated calls to protected routes return clean **401**
`{"message":"Unauthenticated."}` (no redirect attempts).

---

## Dashboard

### `GET /dashboard` 🔒
Aggregates, server-cached 60s:
```json
{
  "new_trends": 179, "high_potential": 3,
  "trending_now": [ TrendResource… ],
  "generated_posts": 0, "pending_review": 0, "published": 0,
  "recent_items_7d": 182, "failed_jobs_24h": 7
}
```

## Sources & Collection

### `GET /sources` 🔒
```json
[{ "id":1, "name":"hacker-news", "type":"hn", "is_enabled":true,
   "last_collected_at":"…", "consecutive_failures":0, "items_count":100 }]
```

### `POST /sources/{id}/collect-now` 🔒 → **202** queues an immediate run

## Jobs Monitoring

### `GET /jobs` 🔒 — last 50 runs
```json
[{ "id":18, "job_class":"App\\Jobs\\CollectSourceItemsJob", "status":"success",
   "attempts":1, "started_at":"…", "finished_at":"…", "duration_ms":1700,
   "meta":{"fetched":34,"inserted":34,"duplicates_skipped":0} }]
```
Failed runs include `"error"` and omit nothing else.

---

## Trends

### `GET /trends` 🔒

Composable filters (all optional):

| Param | Type | Notes |
|---|---|---|
| `search` | string | FULLTEXT(title, summary) |
| `category_id` | int | |
| `technology_id` | int | |
| `status` | discovered\|researching\|researched\|archived | |
| `min_trend_score`, `min_novelty_score` | 0–100 | |
| `max_saturation` | 0–100 | |
| `focus` | boolean | only trends matching focus topics (Laravel/PHP/TS/React/Next.js/databases) |
| `from` | date | first_seen_at ≥ from |
| `per_page` | 5–50 (default 25) | cursor pagination |
| `cursor` | opaque string | from previous response |

**200**:
```json
{
  "data": [{
    "id":95, "title":"Malicious Rust crate Arrayref runs a build-time payload",
    "status":"discovered",
    "category":{"id":2,"name":"Frontend Engineering","slug":"frontend-engineering"},
    "scores":{"trend":75.35,"novelty":100,"freshness":61.29,"momentum":87.75,
              "relevance":85,"usefulness":55,"focus":0,"saturation":13.73},
    "hack_style": false,
    "item_count":1, "first_seen_at":"…", "last_seen_at":"…"
  }],
  "next_cursor": "…" | null
}
```

- `scores.focus` — focus-topic alignment: 100 = focus technology attached,
  55 = focus category only, 0 = none (soft boost only, never an exclusion).
- `hack_style` — true when ≥2 hack/tip/trick keywords appear in title+summary.

Example: top high-scoring security trends this week:
```
GET /api/trends?min_trend_score=70&from=2026-08-14&per_page=12
```

### `GET /trends/{id}` 🔒 — detail + everything the Explorer dialog shows

Extends the list shape with:
- `summary`, `technologies[]`
- `score_breakdown` — dimensions of the latest scoring run
- `applied_weights` — weights actually used (provenance)
- `sources[]` — coverage evidence: source name, title, url, engagement metrics
- `post_statuses[]` — content posts generated for this trend

### `POST /trends/{id}/rescore` 🔒 → **202** queues immediate re-score

## Taxonomy

### `GET /taxonomy` 🔒 (cached 24h)
Categories + active technologies for building filter dropdowns.

---

## Settings & AI models

### `GET /settings` 🔒
Weights, limits, active model, `auto_discover`, `auto_models`, `models_refreshed_at`.

### `PATCH /settings` 🔒
Accepts `weights`, `limits`, `model` (allowlist ∪ auto-discovered ids), `auto_discover` (boolean).

### `GET /settings/models` 🔒
Merged catalogue with live status:
```json
{ "models": [
    { "id": "mimo-v2.5", "label": "MiMo-V2.5", "reasoning": true,
      "source": "allowlist", "on_gateway": true, "working": null, "latency_ms": null },
    { "id": "deepseek-v4.1-flash", "label": "Deepseek V4 1 Flash", "reasoning": false,
      "source": "auto", "on_gateway": true, "working": true, "latency_ms": 2049 }
  ],
  "active": "mimo-v2.5",
  "gateway_reachable": true,
  "auto_discover": true,
  "last_refreshed_at": "2026-09-12T17:37:44+00:00" }
```

### `POST /settings/models/refresh` 🔒 → **202**
Queues `RefreshAiModelsJob`: fetches the live Go-tier roster, ranks candidates
cheap/fast-first, probes the top 10, and stores the 3 fastest working models as
automatic fallbacks (`system_settings.ai.auto_models`). Scheduled daily at 03:20
and triggered automatically when the whole provider chain fails.

> OpenCode's public free tier (`big-pickle`, `*-free`) is API-blocked; discovery
> only uses the Go subscription endpoint (`/zen/go/v1`, cost 0).

## Posts

Every generated variant is a `ContentPost` (format × tone × angle per trend).

### `GET /posts` 🔒
Flat lifecycle list. Query: `filter[status]` (comma-separated), `filter[format]`,
`filter[trend_id]`, `filter[search]`, `per_page` (1–50, default 20), `cursor`.

### `GET /posts/grouped` 🔒
Posts grouped under their trend — powers the Studio. Query: `status`, `format`,
`search`, `per_page` (1–25, default 10), `cursor` (paginates **trend groups**).

```json
{
  "data": [{
    "trend": { "id": 235, "title": "118M Queries per Second on Neki",
               "category": {"id":3,"name":"Databases & Query Optimization","slug":"databases"},
               "trend_score": 59.26, "focus_score": 100, "hack_style": false, "deleted": false },
    "post_count": 1,
    "latest_at": "…",
    "posts": [ ContentPost… ]
  }],
  "next_cursor": "…" | null
}
```

### `GET /posts/{id}` 🔒 — full post + `versions` count + trend title
### `PATCH /posts/{id}` 🔒 — edit `title`/`hook`/`body`/`hashtags[]`; every save snapshots a version
### `POST /posts/{id}/status` 🔒 — `draft|review|ready|archived`
### `POST /posts/{id}/regenerate` 🔒 → **202** queues a fresh draft with the same format/tone/angle (lands as a new variant)
### `POST /posts/{id}/hashtags` 🔒 → **202** queues AI hashtag selection (worker fills the post)
### `DELETE /posts/{id}` 🔒 — **permanent**: versions + image rows cascade, stored image files are purged
### `DELETE /posts?trend_id={id}` 🔒 — permanent delete of every variant for one trend

`PostResource` fields: `id, trend_id, trend{id,title}, title, hook, body, hashtags[],
format, tone, angle, status, quality_score, quality_breakdown, word_count,
version_count, generated_at, updated_at`.

Hashtags are normalized server-side: `#` stripped, spaces/hyphens joined PascalCase,
alphanumeric only, deduped, max 8 tags × 30 chars.

### Post formats
`quick_tip`, `laravel_hack`, `sql_hack`, `react_hack`, `nextjs_hack`,
`technical_insight`, `optimization_tip`, `problem_solution`, `before_after`,
`engineering_lesson`, `release_highlight`, `tool_discovery`,
`performance_breakdown`, `architecture_insight`, `debugging_story`,
`developer_debate`, `case_study`.

## Visual assets

### `GET /posts/{post}/images` 🔒 — snippet / prompt / upload rows
### `POST /posts/{post}/images/snippet` 🔒 → **202** queue a code-card spec (`?force` to regenerate)
### `POST /posts/{post}/images/prompt` 🔒 → **202** queue an AI image prompt
### `POST /posts/{post}/images/upload` 🔒 — multipart `image` (max 4MB)
### `DELETE /images/{id}` 🔒 — removes the row and its file
