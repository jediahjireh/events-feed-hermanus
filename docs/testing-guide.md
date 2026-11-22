# Testing Guide

Complete testing guide for the Hermanus Event Feed API — setup, automated tests, manual API testing with curl, and source adapter verification.

## Environments

| Environment | Base URL | Use for |
|---|---|---|
| **Production** | `https://events-feed-hermanus.vercel.app` | Demo, agent integration, verification |
| **Local dev** | `http://localhost:3000` | Development, debugging, hot reload |

Both environments connect to the same Neon database — writes from either URL affect the same data. All endpoints (GET, POST, PUT, DELETE) work identically from both. Ingest triggers cost ~$0.01/run in Apify compute regardless of which URL you call.

---

## Table of Contents

1. [Testing with Claude / Codex](#testing-with-claude--codex)
2. [Prerequisites](#prerequisites)
3. [Environment Setup](#environment-setup)
4. [Automated Tests](#automated-tests)
5. [Running the Dev Server](#running-the-dev-server)
6. [API Endpoint Testing (curl)](#api-endpoint-testing-curl)
7. [Source Adapter Testing](#source-adapter-testing)
8. [Ingestion Pipeline Testing](#ingestion-pipeline-testing)
9. [Response Format Reference](#response-format-reference)
10. [Hand-Worked Acceptance Cases](#hand-worked-acceptance-cases)
11. [Troubleshooting](#troubleshooting)

---

## Testing with Claude / Codex

The API is agent-friendly. Paste the prompt below into any Claude or Codex session for a full end-to-end verification. The same 19 checks are also available in the browser at `/admin` > E2E Tests tab. A standalone copy of this prompt lives at [quick-test-prompt.md](quick-test-prompt.md) for easy sharing.

### Full E2E test prompt

Paste this into a Claude session. It runs all checks (read-only + agents) and reports PASS/FAIL.

```text
Run a full end-to-end test of the Hermanus Event Feed API at https://events-feed-hermanus.vercel.app. Test ALL of the following and report PASS/FAIL for each:

1. Health: GET /api/health → status "healthy", 5+ active events, 7 sources
2. Schema: GET /api/schema → openapi "3.1.0", 10 paths
3. Sources: GET /api/sources → 7 sources, pagination works (per_page=2)
4. Events: GET /api/events → 5+ events, response has data/meta/errors shape
5. Category filter: ?categories=wildlife → only wildlife events
6. Confidence: default excludes <0.6, ?min_confidence=0 includes low-confidence
7. Cancelled: default excludes cancelled, ?status=cancelled shows them
8. Case 1 (DESIGN.md): ?from=2027-09-14&to=2027-09-21&suitable_for=couples,luxury → exactly Whale Watching, Country Market, Wine Tasting. NOT Whale Festival or FynArts
9. Case 2: ?from=2027-06-01&to=2027-06-30&suitable_for=families → exactly Whale Watching, Country Market. NOT FynArts
10. Case 4: Cancelled Beach Concert in cancelled list, absent from active
11. Pagination: per_page=2 pages through all events, meta has total_count/has_more
12. Sorting: sort=date, sort=confidence, sort=relevance all return results
13. Relevance: ?suitable_for=luxury&sort=relevance → Wine Tasting in top 3
14. Error handling: nonexistent event → 404, bad body → 422, reversed dates → 400, bad review JSON → 400, invalid scope → 422
15. Cron auth: GET /api/cron without header → 401 UNAUTHORIZED
16. Ingest runs: GET /api/ingest/runs → has data with run stats
17. Review agent: POST /api/review with empty body → 200 with events_checked
18. CRUD: create a test event (source_id=manual, start_date=2099-12-31), read it, update title (version=1), verify version conflict (reuse version=1 → 409), check versions trail, delete it, verify it's cancelled
19. Manual submission: POST /api/events with source_id=manual, title="Claude Manual Test Event", temporal type=point start_date=2099-01-15, categories=["art"], suitable_for=["solo"], confidence=0.7. Verify 201 response with source_id=manual. Then delete it (DELETE /api/events/:id) and verify cancelled.

Report a summary table. For any FAIL, show the actual vs expected result.
```

For local dev, replace the URL with `http://localhost:3000`.

### Quick smoke test (9 checks, copy-paste)

```bash
BASE=https://events-feed-hermanus.vercel.app
curl -sf $BASE/api/health | jq -e '.data.status == "healthy"' && echo "1. Health: PASS" || echo "1. Health: FAIL"
curl -sf "$BASE/api/events" | jq -e '.meta.total_count >= 5' && echo "2. Events: PASS" || echo "2. Events: FAIL"
curl -sf "$BASE/api/events?from=2027-09-14&to=2027-09-21&suitable_for=couples,luxury" | jq -e '[.data[].title] | length == 3' && echo "3. Case 1: PASS" || echo "3. Case 1: FAIL"
curl -sf "$BASE/api/events?from=2027-06-01&to=2027-06-30&suitable_for=families" | jq -e '[.data[].title] | length == 2' && echo "4. Case 2: PASS" || echo "4. Case 2: FAIL"
curl -sf "$BASE/api/events?status=cancelled" | jq -e '[.data[].title] | any(contains("Cancelled"))' && echo "5. Cancelled: PASS" || echo "5. Cancelled: FAIL"
curl -sf "$BASE/api/schema" | jq -e '.openapi == "3.1.0"' && echo "6. Schema: PASS" || echo "6. Schema: FAIL"
curl -sf "$BASE/api/sources" | jq -e '[.data[].id] | length == 7' && echo "7. Sources: PASS" || echo "7. Sources: FAIL"
curl -sf -X POST "$BASE/api/review" -H 'Content-Type: application/json' -d '{"scope":"upcoming"}' | jq -e '.data | has("events_checked")' && echo "8. Review: PASS" || echo "8. Review: FAIL"
curl -sf "$BASE/api/cron" 2>/dev/null; test $? -ne 0 && echo "9. Cron auth: PASS" || echo "9. Cron auth: FAIL"
```

---

## Prerequisites

- **Node.js** 18+
- **pnpm** (package manager)
- **API keys** (see [Environment Setup](#environment-setup))
- **Neon PostgreSQL database** (free tier at [neon.tech](https://neon.tech))

---

## Environment Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local` with your actual keys:

```env
# Database (Neon PostgreSQL)
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

# Anthropic (Claude Haiku for extraction/review agents)
ANTHROPIC_API_KEY=sk-ant-...

# SerpAPI (Google Events + Eventbrite search engines)
SERPAPI_API_KEY=...

# Apify (Facebook Events, TripAdvisor, Quicket actors)
APIFY_API_KEY=...
```

**Where to get each key:**

| Key | Where | Free tier |
|---|---|---|
| `DATABASE_URL` | [neon.tech](https://neon.tech) — create a project, copy the connection string | 1 GB storage |
| `ANTHROPIC_API_KEY` | [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) | Pay-as-you-go (Haiku is ~$0.002/page) |
| `SERPAPI_API_KEY` | [serpapi.com/manage-api-key](https://serpapi.com/manage-api-key) | 250 searches/month |
| `APIFY_API_KEY` | [console.apify.com/account/integrations](https://console.apify.com/account/integrations) | $5 free credit (Facebook, TripAdvisor, Quicket actors) |

### 3. Push the database schema

```bash
pnpm drizzle-kit push
```

### 4. Seed test data

```bash
pnpm tsx src/db/seed.ts
```

Expected output:

```
Seeding database...

Cleared existing data.
Inserted 7 sources.
Inserted 8 events with version records.

Seed data summary:
  Sources: google-events, facebook, eventbrite, tripadvisor, quicket, hermanus-co-za, manual (3 events)
  Events:
    - Southern Right Whale Watching Season (seasonal, confidence: 0.99, status: active)
    - Hermanus Country Market (recurring, confidence: 0.95, status: active)
    - FynArts Festival 2027 (range, confidence: 0.85, status: active)
    - Hermanus Whale Festival 2027 (range, confidence: 0.8, status: active)
    - Wine Tasting at Creation Wines (recurring, confidence: 0.7, status: active)
    - Cancelled Beach Concert 2027 (point, confidence: 0.6, status: cancelled)
    - Possible Pop-up Dinner at Wine Farm (point, confidence: 0.4, status: active)
    - Hermanus Craft Gin & Jazz Evening (point, confidence: 0.7, status: active) [manual]

Done.
```

---

## Automated Tests

### Run all tests

```bash
pnpm test
```

Expected: **125 tests passing** across 6 test files.

### Test files

| File | Tests | What it covers |
|---|---|---|
| `tests/temporal.test.ts` | 34 | Overlap logic for all 4 temporal types (point, range, recurring, seasonal), `nextOccurrenceInRange`, edge cases (wrap-around months, exception dates) |
| `tests/dedup.test.ts` | 16 | Fuzzy title matching, date proximity, venue matching, dedup threshold handling, non-duplicate detection |
| `tests/hand-worked-cases.test.ts` | 36 | End-to-end acceptance tests from DESIGN.md Cases 1–4 — simulates the full API query pipeline (temporal overlap + category + suitable_for + confidence filters) against seed data |
| `tests/relevance.test.ts` | 21 | Relevance agent scoring: category-profile matrix, multiple categories, suitable_for boost, edge cases, seed data scenarios |
| `tests/ingest.test.ts` | 8 | Ingest agent pipeline: extraction of all 4 temporal types, markdown-wrapped JSON handling, invalid JSON errors, multi-event accumulation, cost calculation (mocked Anthropic + DB) |
| `tests/review.test.ts` | 10 | Review agent verification: event confirmation, cancellation detection, 404 handling, fetch errors, detail changes, links.source_url fallback, cost calculation (mocked Anthropic + DB + fetch) |

### Run a specific test file

```bash
pnpm vitest run tests/temporal.test.ts
pnpm vitest run tests/dedup.test.ts
pnpm vitest run tests/hand-worked-cases.test.ts
pnpm vitest run tests/relevance.test.ts
pnpm vitest run tests/ingest.test.ts
pnpm vitest run tests/review.test.ts
```

### Watch mode (re-runs on file changes)

```bash
pnpm vitest
```

---

## Running the Dev Server

```bash
pnpm dev
```

The server starts at `http://localhost:3000`. All API endpoints are under `/api/`.

The production deployment is at `https://events-feed-hermanus.vercel.app` — same endpoints, same database.

### Verify it's running

```bash
curl -s $BASE/api/health | jq .
```

Expected response (after seeding):

```json
{
  "data": {
    "status": "healthy",
    "database": { "connected": true },
    "events": {
      "total_active": 6,
      "by_temporal_type": {
        "point": 1,
        "range": 2,
        "recurring": 2,
        "seasonal": 1
      },
      "by_confidence": {
        "0.0-0.3": 0,
        "0.3-0.6": 1,
        "0.6-0.8": 1,
        "0.8-1.0": 4
      }
    },
    "sources": [
      { "source_id": "google-events", "source_name": "Google Events (SerpAPI)", "last_completed": null, "events_found": 0 },
      { "source_id": "facebook", "source_name": "Facebook Events (Apify)", "last_completed": null, "events_found": 0 },
      { "source_id": "eventbrite", "source_name": "Eventbrite (SerpAPI)", "last_completed": null, "events_found": 0 },
      { "source_id": "tripadvisor", "source_name": "TripAdvisor (Apify)", "last_completed": null, "events_found": 0 },
      { "source_id": "quicket", "source_name": "Quicket (Apify)", "last_completed": null, "events_found": 0 },
      { "source_id": "hermanus-co-za", "source_name": "hermanus.co.za", "last_completed": null, "events_found": 0 },
      { "source_id": "manual", "source_name": "Manual Submission", "last_completed": null, "events_found": 0 }
    ],
    "timestamp": "2026-11-21T..."
  },
  "meta": {},
  "errors": []
}
```

---

## API Endpoint Testing (curl)

> All examples below use `$BASE` as the API root. Set it for your environment:
>
> ```bash
> # Production
> BASE=https://events-feed-hermanus.vercel.app
>
> # Local dev
> BASE=http://localhost:3000
> ```
>
> Pipe through `jq` for readable JSON: `curl -s <url> | jq .`
>
> Both environments share the same Neon database — writes from either URL affect the same data. Ingest triggers cost ~$0.01/run in Apify compute.

### GET /api/events — Query events

**Basic list (all active events with confidence >= 0.6):**

```bash
curl -s "$BASE/api/events" | jq .
```

Returns 5+ active events (the low-confidence pop-up dinner is excluded by the default `min_confidence=0.6`, the cancelled concert is excluded by default `status=active`).

**Date range query — luxury couple trip, 14–21 September 2027:**

```bash
curl -s "$BASE/api/events?from=2027-09-14&to=2027-09-21&suitable_for=couples,luxury" | jq .
```

Expected results:
- **Whale watching season** (seasonal: Sep is within Jun–Nov) — matches couples, luxury
- **Hermanus Country Market** (recurring: Sat 20 Sep falls in range) — matches couples
- **Wine Tasting at Creation Wines** (recurring: Fri 19 Sep) — matches couples, luxury

The **Whale Festival** (Sep 27–28) should NOT appear — it's outside the 14–21 range.
**FynArts** (June) should NOT appear — wrong month.

**Family trip, full June 2027:**

```bash
curl -s "$BASE/api/events?from=2027-06-01&to=2027-06-30&suitable_for=families" | jq .
```

Expected results:
- **Whale watching season** (seasonal: Jun–Nov overlaps June) — matches families
- **Hermanus Country Market** (recurring: 4 Saturdays in June) — matches families

FynArts does NOT appear because its `suitable_for` is `["couples", "solo", "luxury"]` — no "families".

**Category filter:**

```bash
curl -s "$BASE/api/events?categories=wildlife" | jq .
```

Returns: Whale watching season, Whale Festival 2027.

**Low confidence threshold (see all events including unverified):**

```bash
curl -s "$BASE/api/events?min_confidence=0" | jq .
```

Returns all 6 active events (including the pop-up dinner at confidence 0.4).

**Include cancelled events:**

```bash
curl -s "$BASE/api/events?status=cancelled" | jq .
```

Returns: Cancelled Beach Concert 2027.

**Pagination:**

```bash
curl -s "$BASE/api/events?per_page=2&page=1" | jq .
curl -s "$BASE/api/events?per_page=2&page=2" | jq .
```

Check `meta.total_count`, `meta.has_more`, `meta.page`.

**Sort options:**

```bash
# By relevance (default)
curl -s "$BASE/api/events?sort=relevance" | jq '.data[].title'

# By confidence
curl -s "$BASE/api/events?sort=confidence" | jq '.data[].title'

# By date
curl -s "$BASE/api/events?sort=date" | jq '.data[].title'
```

### GET /api/events/:id — Single event

First, get an event ID from the list:

```bash
EVENT_ID=$(curl -s "$BASE/api/events?per_page=1" | jq -r '.data[0].id')
echo $EVENT_ID
```

Then fetch it:

```bash
curl -s "$BASE/api/events/$EVENT_ID" | jq .
```

**Non-existent ID:**

```bash
curl -s "$BASE/api/events/nonexistent" | jq .
```

Returns 404 with `{ code: "NOT_FOUND", message: "Event 'nonexistent' not found", retryable: false }`. No `suggestion` field.

### POST /api/events — Create an event

```bash
curl -s -X POST $BASE/api/events \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "Test Point Event",
    "location": {
      "name": "Test Venue",
      "town": "Hermanus",
      "region": "Overberg",
      "province": "Western Cape",
      "country": "ZA"
    },
    "temporal": {
      "type": "point",
      "start_date": "2027-12-25",
      "end_date": null,
      "start_month": null,
      "end_month": null,
      "recurrence": null,
      "dates": null
    },
    "categories": ["family"],
    "source_id": "manual",
    "confidence": 0.8,
    "suitable_for": ["families"]
  }' | jq .
```

Returns 201 with the created event. Save the returned `id` for update/delete tests.

**Validation error (missing required field):**

```bash
curl -s -X POST $BASE/api/events \
  -H 'Content-Type: application/json' \
  -d '{"title": "Missing fields"}' | jq .
```

Returns 422 with validation errors.

**Non-existent source:**

```bash
curl -s -X POST $BASE/api/events \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "Bad source",
    "location": {"name":"x","town":"Hermanus","region":"Overberg","province":"Western Cape","country":"ZA"},
    "temporal": {"type":"point","start_date":"2027-01-01","end_date":null,"start_month":null,"end_month":null,"recurrence":null,"dates":null},
    "source_id": "does-not-exist"
  }' | jq .
```

Returns 404 with `SOURCE_NOT_FOUND`.

### PUT /api/events/:id — Update an event

Requires the current `version` for optimistic concurrency:

```bash
# Get current version
EVENT_ID="<paste id from create above>"
VERSION=$(curl -s "$BASE/api/events/$EVENT_ID" | jq '.data.version')

# Update the title
curl -s -X PUT "$BASE/api/events/$EVENT_ID" \
  -H 'Content-Type: application/json' \
  -d "{\"version\": $VERSION, \"title\": \"Updated Test Event\"}" | jq .
```

Returns 200 with the updated event (version incremented).

**Version conflict:**

```bash
# Use the OLD version (should fail)
curl -s -X PUT "$BASE/api/events/$EVENT_ID" \
  -H 'Content-Type: application/json' \
  -d "{\"version\": $VERSION, \"title\": \"Stale update\"}" | jq .
```

Returns 409 with `VERSION_CONFLICT` and suggestion to re-fetch.

### DELETE /api/events/:id — Soft-delete (cancel)

```bash
curl -s -X DELETE "$BASE/api/events/$EVENT_ID" | jq .
```

Returns 200 with the event's status set to `"cancelled"`. The event is still in the database — it just won't appear in default queries.

Verify it no longer appears in default results:

```bash
curl -s "$BASE/api/events" | jq '.data[].title'
```

But it appears with the cancelled filter:

```bash
curl -s "$BASE/api/events?status=cancelled" | jq '.data[].title'
```

### GET /api/events/:id/versions — Audit trail

```bash
curl -s "$BASE/api/events/$EVENT_ID/versions" | jq .
```

Returns paginated version history showing each change, who made it, and a full snapshot at that version. After create + update + delete, there should be 3 versions.

### GET /api/sources — List sources

```bash
curl -s "$BASE/api/sources" | jq .
```

Returns all 7 configured sources with their trust levels and last scrape timestamps.

### POST /api/ingest — Trigger ingestion

```bash
# Trigger for a single source
curl -s -X POST $BASE/api/ingest \
  -H 'Content-Type: application/json' \
  -d '{"source_id": "google-events"}' | jq .

# Trigger for all sources
curl -s -X POST $BASE/api/ingest \
  -H 'Content-Type: application/json' \
  -d '{"source_id": "all"}' | jq .
```

Returns 202 with an ingest run record (status: "running"). The actual ingestion pipeline runs asynchronously.

### GET /api/ingest/runs — Ingestion history

```bash
curl -s "$BASE/api/ingest/runs" | jq .

# Filter by source
curl -s "$BASE/api/ingest/runs?source_id=google-events" | jq .
```

Returns paginated list of ingestion runs with stats (events found/created/updated/skipped, tokens used, cost).

### POST /api/review — Trigger event review

Re-verifies existing events against their source URLs using the review agent (Claude Haiku).

```bash
# Review upcoming events (default scope)
curl -s -X POST $BASE/api/review \
  -H 'Content-Type: application/json' \
  -d '{"scope": "upcoming"}' | jq .

# Review low-confidence events only
curl -s -X POST $BASE/api/review \
  -H 'Content-Type: application/json' \
  -d '{"scope": "low-confidence"}' | jq .

# Review all events
curl -s -X POST $BASE/api/review \
  -H 'Content-Type: application/json' \
  -d '{"scope": "all"}' | jq .
```

Returns 200 with a review report:

```json
{
  "data": {
    "events_checked": 5,
    "events_confirmed": 3,
    "events_updated": 1,
    "events_stale": 1,
    "tokens_used": 2000,
    "cost_usd": 0.0012,
    "errors": []
  },
  "meta": {},
  "errors": []
}
```

- `events_confirmed`: Still found at source, details unchanged
- `events_updated`: Found but details changed (e.g. new dates) or cancelled
- `events_stale`: Source URL returned 404 or event no longer listed — confidence lowered
- Only events with a `source_url` (or `links.source_url`) are reviewed; others are skipped

**Validation error:**

```bash
curl -s -X POST $BASE/api/review \
  -H 'Content-Type: application/json' \
  -d '{"scope": "invalid"}' | jq .
```

Returns 422 with `VALIDATION_ERROR`.

### GET /api/cron — Vercel Cron handler

Protected by `CRON_SECRET`. Called automatically by Vercel Cron daily at 06:00 UTC. Triggers ingest for all sources; on Mondays also runs the review agent.

**Without valid secret (should return 401):**

```bash
curl -s $BASE/api/cron | jq .
```

Returns: `{ "errors": [{ "code": "UNAUTHORIZED", "message": "Invalid or missing cron secret" }] }`

**With valid secret:**

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" $BASE/api/cron | jq .
```

Returns 200 with ingest run IDs and review results (if Monday). Example:

```json
{
  "data": {
    "ingest": { "sources_triggered": 7, "run_ids": ["01J..."] },
    "review": { "skipped": true, "reason": "Not Monday" },
    "triggered_at": "2026-11-22T06:00:00.000Z"
  },
  "meta": {},
  "errors": []
}
```

After deployment, check the Vercel dashboard under **Cron Jobs** to see execution history, status, and logs.

### GET /api/schema — OpenAPI spec

```bash
curl -s "$BASE/api/schema" | jq .
```

Returns the full OpenAPI 3.1 JSON specification. This is what AI agents and tools like Swagger UI read to discover the API.

To view in Swagger UI, paste the production URL `https://events-feed-hermanus.vercel.app/api/schema` into [editor.swagger.io](https://editor.swagger.io) or use:

```bash
# Save locally and open with any OpenAPI viewer
curl -s "$BASE/api/schema" > openapi.json
```

---

## Source Adapter Testing

Each source adapter can be tested independently. Google Events and Eventbrite require `SERPAPI_API_KEY`; Facebook, TripAdvisor, and Quicket require `APIFY_API_KEY` in `.env.local`.

> **Cost note:** SerpAPI searches use free tier credits (~250/month). Apify actor runs cost ~$0.01–0.02 per run. The first run for each actor takes 30–120 seconds; subsequent runs reuse cached datasets.
>
> **Data sparsity:** Hermanus is a small town (~91K population). Event data is significantly sparser than Cape Town or Johannesburg. Some sources return 0 events — this is expected and documented.

### Google Events (SerpAPI)

```bash
pnpm tsx -e "
import 'dotenv/config';
import { fetchGoogleEvents } from './src/lib/sources/google-events';
async function main() {
  const events = await fetchGoogleEvents();
  console.log('Found', events.length, 'events');
  for (const e of events) {
    console.log('-', e.title, '|', e.date?.when ?? 'no date');
  }
}
main();
"
```

Expected: **0–5 events**. Hermanus is sparse on Google Events (3–5 results vs 20+ for Cape Town). 0 results is a valid outcome. Uses SerpAPI `google_events` engine with query `"Events in Hermanus"`.

### Facebook Events (Apify)

```bash
pnpm tsx -e "
import 'dotenv/config';
import { fetchFacebookEvents } from './src/lib/sources/facebook';
async function main() {
  const events = await fetchFacebookEvents();
  console.log('Found', events.length, 'events');
  for (const e of events) {
    console.log('-', e.name, '|', e.utcStartDate ?? e.startTime ?? 'no date', '|', e.address ?? 'no address');
  }
}
main();
"
```

Expected: **0–5 events**. Facebook Events data is restricted since 2019. The actor may return `{ error: "no_items" }` for Hermanus — the adapter filters these out and returns an empty array. Actor: `apify/facebook-events-scraper`.

### Eventbrite (SerpAPI)

```bash
pnpm tsx -e "
import 'dotenv/config';
import { fetchEventbriteEvents } from './src/lib/sources/eventbrite';
async function main() {
  const events = await fetchEventbriteEvents();
  console.log('Found', events.length, 'Hermanus-area events');
  for (const e of events) {
    const venue = e.venue as Record<string, unknown> | undefined;
    console.log('-', e.title, '|', e.start_date, '|', venue?.city ?? 'no city');
  }
}
main();
"
```

Expected: **0–10 events** after Hermanus filter. The adapter searches via SerpAPI `eventbrite` engine with location `"Hermanus, Western Cape, South Africa"` and applies a GPS bounding box filter for the Hermanus area.

### TripAdvisor (Apify)

```bash
pnpm tsx -e "
import 'dotenv/config';
import { fetchTripAdvisorItems } from './src/lib/sources/tripadvisor';
async function main() {
  const items = await fetchTripAdvisorItems();
  console.log('Found', items.length, 'attractions');
  for (const item of items) {
    console.log('-', item.name, '|', item.category, '|', item.rating);
  }
}
main();
"
```

Expected: **0–20 attractions** (after filtering out restaurants/hotels). TripAdvisor data is *places/attractions*, not time-bound events — the Claude extraction agent classifies these as "recurring" or "seasonal". Actor: `maxcopell/tripadvisor`.

### Quicket (Apify)

```bash
pnpm tsx -e "
import 'dotenv/config';
import { fetchQuicketEvents } from './src/lib/sources/quicket';
async function main() {
  const events = await fetchQuicketEvents();
  console.log('Found', events.length, 'Hermanus/WC events');
  for (const e of events) {
    console.log('-', e.title, '|', e.venueName, '|', e.isFree ? 'Free' : 'Paid');
  }
}
main();
"
```

Expected: **1–10 events**. Quicket is SA's primary ticketing platform and consistently returns Hermanus events (concerts, festivals, markets). Actor: `gtnetworks~sa-events-listings`.

> Note: The first run for any actor may trigger a new Apify run if no cached dataset exists. This takes 30–120 seconds.

### Generic scraper (Claude-powered)

```bash
pnpm tsx -e "
import 'dotenv/config';
import { scrapeUrl } from './src/lib/sources/scraper';
async function main() {
  const result = await scrapeUrl('https://www.hermanus.co.za/what-to-do/annual-events/index.html');
  console.log('Extracted', result.events.length, 'events (tokens:', result.tokens_used + ')');
  for (const e of result.events.slice(0, 5)) {
    console.log('-', e.title);
  }
}
main();
"
```

This fetches the page, sends the HTML to Claude Haiku, and extracts structured event data. Costs ~$0.002 per page.

### Adapter results summary (Nov 2026 baseline)

| Source | Engine / Actor | Typical results | Notes |
| --- | --- | --- | --- |
| Google Events | SerpAPI `google_events` | 0–5 | Sparse for Hermanus |
| Facebook | Apify `apify/facebook-events-scraper` | 0–5 | Restricted since 2019, often empty |
| Eventbrite | SerpAPI `eventbrite` | 0–10 | Filtered to Hermanus area |
| TripAdvisor | Apify `maxcopell/tripadvisor` | 0–20 | Attractions, not time-bound events |
| Quicket | Apify `gtnetworks~sa-events-listings` | 1–10 | Most reliable for Hermanus |
| hermanus.co.za | *(Claude scraper)* | 2–8 | Local tourism site |
| manual | *(none)* | N/A | Manual submissions |

---

## Ingestion Pipeline Testing

The full ingest pipeline (fetch -> extract -> deduplicate -> store) can be tested via the API endpoint.

> Ingestion triggers SerpAPI searches or Apify actor runs (~$0.01 each) and writes to the shared Neon database. Works from either environment.

### Run ingestion via API (recommended)

The simplest way to test the full pipeline.

```bash
BASE=https://events-feed-hermanus.vercel.app  # or http://localhost:3000

# Trigger ingestion for a single source (202 Accepted, runs async)
curl -s -X POST $BASE/api/ingest \
  -H 'Content-Type: application/json' \
  -d '{"source_id": "quicket"}' | jq .

# Wait 30-60 seconds, then check the run result
curl -s "$BASE/api/ingest/runs?source_id=quicket" | jq '.data[0]'
```

**Test each source** (recommended order — most reliable first):

```bash
# 1. Quicket — most reliable, usually 1-10 results
curl -s -X POST $BASE/api/ingest \
  -H 'Content-Type: application/json' \
  -d '{"source_id": "quicket"}'

# 2. Eventbrite — good structured data, 0-10 results after Hermanus filter
curl -s -X POST $BASE/api/ingest \
  -H 'Content-Type: application/json' \
  -d '{"source_id": "eventbrite"}'

# 3. Google Events — sparse for Hermanus, often 0 results
curl -s -X POST $BASE/api/ingest \
  -H 'Content-Type: application/json' \
  -d '{"source_id": "google-events"}'

# 4. Facebook — restricted data, often empty
curl -s -X POST $BASE/api/ingest \
  -H 'Content-Type: application/json' \
  -d '{"source_id": "facebook"}'

# 5. TripAdvisor — attractions/places, sparse after filtering
curl -s -X POST $BASE/api/ingest \
  -H 'Content-Type: application/json' \
  -d '{"source_id": "tripadvisor"}'
```

**Check all run results:**

```bash
curl -s "$BASE/api/ingest/runs" | jq '.data[] | {source_id, status, events_found, events_created, avg_confidence, cost_usd}'
```

### Verify ingested events

After running ingestion, check that new events appear:

```bash
# All events including newly ingested
curl -s "$BASE/api/events?per_page=50" | jq '.data[] | {title, source_id, confidence, temporal_type: .temporal.type}'

# Updated health stats
curl -s $BASE/api/health | jq '.data.events'
```

**What to check in each run:**

- `status` is `"completed"` (not `"failed"`)
- `events_found` >= 0 (0 is valid for sparse sources)
- `events_created` > 0 on first run for sources with data
- `events_skipped` for duplicates (on subsequent runs)
- `avg_confidence` > 0.5 when events are found
- `tokens_used` and `cost_usd` are non-zero when events are found
- `error` is null

### Expected cost per full ingestion cycle

| Source | Apify cost | Haiku cost | Total |
| --- | --- | --- | --- |
| Quicket | ~$0.01 | ~$0.001 | ~$0.011 |
| Eventbrite | ~$0.01 | ~$0.001 | ~$0.011 |
| Google Events | ~$0.01 | ~$0.001 | ~$0.011 |
| Facebook | ~$0.01 | ~$0.001 | ~$0.011 |
| TripAdvisor | ~$0.01 | ~$0.001 | ~$0.011 |
| **Total (all 5)** | **~$0.05** | **~$0.005** | **~$0.055** |

---

## Manual Submission Testing

Manual events can be submitted via `POST /api/events` with `source_id: "manual"`. This is how venue owners or tourism agents submit events directly — no scraper or actor involved.

### Via curl

```bash
BASE=https://events-feed-hermanus.vercel.app  # or http://localhost:3000

curl -s -X POST $BASE/api/events \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "Sunset Kayak Tour",
    "description": "Guided kayak tour along the Hermanus coast at sunset.",
    "location": {
      "name": "Hermanus New Harbour",
      "venue": "Hermanus Adventures",
      "town": "Hermanus",
      "region": "Overberg",
      "province": "Western Cape",
      "country": "ZA"
    },
    "temporal": {
      "type": "point",
      "start_date": "2027-08-10",
      "end_date": null,
      "start_month": null,
      "end_month": null,
      "recurrence": null,
      "dates": null
    },
    "categories": ["sport", "family"],
    "source_id": "manual",
    "confidence": 0.7,
    "suitable_for": ["couples", "families", "adventure"]
  }' | jq .
```

Returns 201 with the created event. The event appears immediately in `GET /api/events` queries (confidence 0.7 is above the default 0.6 threshold).

### Via Claude (web / desktop)

Paste this into any Claude session with web fetch capability to test manual submission end-to-end:

```text
Test manual event submission on the Hermanus Event Feed API at https://events-feed-hermanus.vercel.app.

1. Create a manual event: POST /api/events with this JSON body:
   {
     "title": "Claude Manual Test Event",
     "description": "Submitted via Claude to test manual submission flow.",
     "location": {"name": "Hermanus", "town": "Hermanus", "region": "Overberg", "province": "Western Cape", "country": "ZA"},
     "temporal": {"type": "point", "start_date": "2099-01-15"},
     "categories": ["art"],
     "source_id": "manual",
     "confidence": 0.7,
     "suitable_for": ["solo"]
   }
2. Verify 201 response with source_id=manual and an id in the response.
3. Read it back: GET /api/events/:id — confirm title and source_id match.
4. Update it: PUT /api/events/:id with {"version": 1, "title": "Claude Manual Test (Updated)"}. Confirm version incremented.
5. Check versions: GET /api/events/:id/versions — should have 2 version records.
6. Delete it: DELETE /api/events/:id — confirm status changed to "cancelled".
7. Verify absent from default listing: GET /api/events should NOT contain the test event.

Report PASS/FAIL for each step. Clean up by deleting the event (step 6).
```

### Seed data

The seed includes one active manual submission event: **"Hermanus Craft Gin & Jazz Evening"** (point event, 2027-07-19, confidence 0.7). This event appears in default queries and demonstrates a real-world manual entry from a venue owner.

---

## Response Format Reference

Every API response follows this structure:

### Success (single item)

```json
{
  "data": { ... },
  "meta": {},
  "errors": []
}
```

### Success (paginated list)

```json
{
  "data": [ ... ],
  "meta": {
    "total_count": 7,
    "page": 1,
    "per_page": 20,
    "has_more": false
  },
  "errors": []
}
```

### Error

```json
{
  "data": null,
  "meta": {},
  "errors": [
    {
      "code": "NOT_FOUND",
      "message": "Event 'abc' not found",
      "suggestion": "Check the event ID",
      "retryable": false
    }
  ]
}
```

### Error codes

| Code | HTTP Status | Meaning |
|---|---|---|
| `INVALID_QUERY` | 400 | Bad query parameters (Zod validation failure) |
| `NOT_FOUND` | 404 | Event or source not found |
| `SOURCE_NOT_FOUND` | 404 | Referenced source doesn't exist |
| `VALIDATION_ERROR` | 422 | Request body validation failed |
| `VERSION_CONFLICT` | 409 | Optimistic concurrency — event was modified since you last read it |
| `HEALTH_CHECK_FAILED` | 503 | Database unreachable |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## Hand-Worked Acceptance Cases

These are the cases from DESIGN.md, verified by the automated test suite (`tests/hand-worked-cases.test.ts`). Use them to validate the API manually after any changes to temporal logic or query filtering.

### Case 1: Luxury couple trip, 14–21 September 2027

```bash
curl -s "$BASE/api/events?from=2027-09-14&to=2027-09-21&suitable_for=couples,luxury" | jq '.data[].title'
```

**Should return:**
- "Southern Right Whale Watching Season" (seasonal: Sep in Jun–Nov)
- "Hermanus Country Market" (recurring: Sat 20 Sep, has `next_occurrence_in_range`)
- "Wine Tasting at Creation Wines" (recurring: Fri 19 Sep)

**Should NOT return:**
- "Hermanus Whale Festival 2027" (Sep 27–28 is outside the 14–21 range)
- "FynArts Festival 2027" (June, not September)
- "Cancelled Beach Concert" (status: cancelled)
- "Possible Pop-up Dinner" (confidence 0.4, below default 0.6 threshold)

### Case 2: Family trip, full month of June 2027

```bash
curl -s "$BASE/api/events?from=2027-06-01&to=2027-06-30&suitable_for=families" | jq '.data[].title'
```

**Should return:**
- "Southern Right Whale Watching Season" (seasonal: Jun in Jun–Nov, suitable for families)
- "Hermanus Country Market" (recurring: 4 Saturdays in June, suitable for families)

**Should NOT return:**
- "FynArts Festival 2027" — it overlaps June temporally but its `suitable_for` is `["couples", "solo", "luxury"]` (no "families")

### Case 3: Duplicate detection

Tested automatically — when two sources return the same event with different title formatting, the dedup logic merges them and boosts confidence.

### Case 4: Cancelled event handling

```bash
# Active query excludes cancelled
curl -s "$BASE/api/events" | jq '.data[] | select(.title | contains("Cancelled"))'
# (empty — correct)

# Cancelled filter includes it
curl -s "$BASE/api/events?status=cancelled" | jq '.data[].title'
# "Cancelled Beach Concert 2027"
```

---

## Troubleshooting

### "APIFY_API_KEY environment variable is not set"

Your `.env.local` is missing the key, or the dev server didn't pick it up. Restart with `pnpm dev`. This key is used for Apify actors (Facebook, TripAdvisor, Quicket). Google Events and Eventbrite use SerpAPI instead (`SERPAPI_API_KEY`).

### "Apify run trigger failed: 404 Not Found"

The actor ID in the URL is malformed. Apify's REST API requires `username~actor-name` (tilde separator), not `username/actor-name` (slash). The shared utility in `src/lib/sources/apify.ts` normalises this automatically — if you see this error, the normalisation is not being applied.

### "Apify dataset fetch failed: 404"

No previous actor run exists. The adapter will automatically trigger a new run. Wait up to 2 minutes.

### "Apify run timed out waiting for dataset"

The actor run took longer than 2 minutes, or the actor returned 0 items. Check the run status at [console.apify.com](https://console.apify.com). For sparse sources (Google Events, Facebook for Hermanus), 0 results is expected — the adapter returns an empty array.

### Database connection errors

- Check `DATABASE_URL` format: `postgresql://user:password@host/dbname?sslmode=require`
- Neon databases go idle after 5 minutes of inactivity — the first query may take 1–2 seconds to wake up
- Run `pnpm drizzle-kit push` if you see "relation does not exist" errors

### Tests fail after changing temporal logic

Run the full suite — the hand-worked cases are the most sensitive:

```bash
pnpm vitest run tests/hand-worked-cases.test.ts
```

If a hand-worked case fails, the test output shows exactly which events were returned vs expected.

### Build errors

```bash
pnpm build
```

Must complete with 0 errors and show all 13 API endpoints. TypeScript errors will be caught here.

### "Model not found" or Anthropic API errors

Verify your `ANTHROPIC_API_KEY` is valid and has credits. The model used is `claude-haiku-5-5` (alias, not a dated version).

## Quick Validation Checklist

### Local dev (after code changes)

```bash
BASE=http://localhost:3000

# 1. All 125 tests pass
pnpm test

# 2. Build is clean (13 API endpoints, 0 errors)
pnpm build

# 3. Health check returns "healthy"
curl -s $BASE/api/health | jq '.data.status'

# 4. Events query returns seed data
curl -s "$BASE/api/events" | jq '.meta.total_count'

# 5. Hand-worked Case 1 returns correct events
curl -s "$BASE/api/events?from=2027-09-14&to=2027-09-21&suitable_for=couples,luxury" | jq '[.data[].title] | sort'

# 6. OpenAPI spec is valid JSON
curl -s $BASE/api/schema | jq '.openapi'
```

### Production (after deploy)

```bash
BASE=https://events-feed-hermanus.vercel.app

# 1. Health check returns "healthy"
curl -s $BASE/api/health | jq '.data.status'

# 2. Events query returns seed data + ingested events
curl -s "$BASE/api/events" | jq '.meta.total_count'

# 3. Hand-worked Case 1 returns correct events
curl -s "$BASE/api/events?from=2027-09-14&to=2027-09-21&suitable_for=couples,luxury" | jq '[.data[].title] | sort'

# 4. OpenAPI spec is valid JSON
curl -s $BASE/api/schema | jq '.openapi'

# 5. Sources all registered
curl -s $BASE/api/sources | jq '[.data[].id] | length'
```

### Extended checklist (live integration)

Run these if you've changed source adapters, the ingest pipeline, or the review agent. Requires `APIFY_API_KEY` and `ANTHROPIC_API_KEY`. Costs ~$0.02 per source for ingest, ~$0.001 per event for review.

```bash
BASE=https://events-feed-hermanus.vercel.app  # or http://localhost:3000

# 7. Quicket adapter fetches real events
curl -s -X POST $BASE/api/ingest \
  -H 'Content-Type: application/json' \
  -d '{"source_id": "quicket"}'
# Wait 30-60s, then:
curl -s "$BASE/api/ingest/runs?source_id=quicket" | jq '.data[0] | {status, events_found, events_created}'

# 8. Eventbrite adapter fetches real events
curl -s -X POST $BASE/api/ingest \
  -H 'Content-Type: application/json' \
  -d '{"source_id": "eventbrite"}'
# Wait 30-60s, then:
curl -s "$BASE/api/ingest/runs?source_id=eventbrite" | jq '.data[0] | {status, events_found, events_created}'

# 9. Ingested events appear in the API
curl -s "$BASE/api/events?per_page=50" | jq '.meta.total_count'

# 10. Review agent verifies events against source URLs
curl -s -X POST $BASE/api/review \
  -H 'Content-Type: application/json' \
  -d '{"scope": "all"}' | jq '.data | {events_checked, events_confirmed, events_stale}'

# 11. Relevance scoring works with suitable_for + sort=relevance
curl -s "$BASE/api/events?from=2027-09-14&to=2027-09-21&suitable_for=luxury&sort=relevance" | jq '.data[].title'
```
