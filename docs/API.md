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
              "relevance":85,"usefulness":55,"saturation":13.73},
    "item_count":1, "first_seen_at":"…", "last_seen_at":"…"
  }],
  "next_cursor": "…" | null
}
```

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
