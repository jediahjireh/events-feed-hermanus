# Hermanus Event Feed — Design Write-up

## Summary

An event feed for Hermanus, South Africa that collects, normalises, and serves local events so travel agents and AI trip-planning agents can answer: *"What is on in Hermanus while my traveller is there?"*

The system ingests events from a ranked set of sources (Apify actors for Google Events, Facebook Events, Eventbrite, TripAdvisor, and Quicket; local tourism site scrapers; manual submission), normalises them into a unified temporal model that handles four event shapes (point-in-time, multi-date/running, far-future, seasonal), exposes an agent-friendly REST API, and uses Claude as an ingestion and relevance-scoring agent.

A travel planner books 6–18 months out and revisits the same destination months apart. The feed must carry events that far ahead, handle sparse data for a coastal town (~91K people in the broader urban area), and let agents filter by traveller profile (age, interests) without over-engineering a recommendation engine.

---

## Data Model

### Core entity: `Event`

```
Event
├── id                    string (ulid)
├── title                 string
├── slug                  string (url-safe, derived)
├── description           string | null
├── location              Location
├── temporal              Temporal            ← the key design decision
├── categories            string[]            ← ["music", "market", "wildlife", "art", "sport", "food-wine", "family"]
├── source                Source
├── relevance_score       float (0–1)         ← agent-assigned, recalculated on ingest
├── confidence            float (0–1)         ← how sure we are the data is correct
├── status                "active" | "cancelled" | "tentative" | "past"
├── links                 { website?, tickets?, source_url }
├── images                string[]
├── price_indication      string | null       ← "free", "R50–R200", "from R1500"
├── suitable_for          string[]            ← ["couples", "families", "adventure", "luxury", "solo"]
├── created_at            datetime
├── updated_at            datetime
├── ingested_at           datetime
├── last_verified_at      datetime | null
└── version               int                 ← bumped on every update, enables diffing
```

### Temporal — the hard part

A single `temporal` object models all four event shapes with one structure:

```
Temporal
├── type        "point" | "range" | "recurring" | "seasonal"
├── start_date  date | null       ← null for seasonal
├── end_date    date | null
├── start_month int | null        ← 1–12, for seasonal (e.g. 6 = June)
├── end_month   int | null        ← 1–12, for seasonal (e.g. 11 = November)
├── recurrence  Recurrence | null ← only for recurring
└── dates       date[] | null     ← explicit dates for multi-date events (theatre with 81 dates)
```

```
Recurrence
├── frequency   "daily" | "weekly" | "monthly"
├── day_of_week int | null        ← 0=Mon … 6=Sun
├── interval    int               ← every N weeks/months
└── exceptions  date[]            ← dates when it doesn't happen
```

**Why this shape:**

| Event type | Example | How it's stored |
|---|---|---|
| Point-in-time | J. Cole concert, 12 Dec 2026 | `type: "point", start_date: "2026-12-12"` |
| Running/range | Exhibition open Jan–Dec 2027 | `type: "range", start_date: "2027-01-15", end_date: "2027-12-31"` |
| Multi-date | Theatre show, 81 specific dates | `type: "range", start_date: first, end_date: last, dates: [all 81]` |
| Recurring | Saturday market, weekly | `type: "recurring", recurrence: { frequency: "weekly", day_of_week: 5 }` |
| Seasonal | Whale watching, June–November | `type: "seasonal", start_month: 6, end_month: 11` |

**The key query** is: *"What overlaps with a date range?"* Given a traveller's dates (e.g. 14–21 September 2027), the API must return: the Saturday market (recurring, falls on a Saturday within the range), whale watching (seasonal, September is within June–November), and any point/range events that overlap. This is an `overlaps(travel_start, travel_end)` function that checks each type differently:

- **point**: `start_date >= travel_start AND start_date <= travel_end`
- **range**: `start_date <= travel_end AND end_date >= travel_start`
- **recurring**: expand occurrences within `[travel_start, travel_end]` using recurrence rule, check for exceptions
- **seasonal**: `travel_month overlaps [start_month, end_month]` (handles wrap-around for southern hemisphere seasons)
- **multi-date** (dates array): `any date in dates[] falls within [travel_start, travel_end]`

### Location

```
Location
├── name          string           ← "Hermanus Country Market"
├── venue         string | null    ← "Hermanus Cricket Club"
├── town          string           ← "Hermanus"
├── region        string           ← "Overberg"
├── province      string           ← "Western Cape"
├── country       string           ← "ZA"
├── lat           float | null
├── lng           float | null
└── radius_km     float | null     ← for "near Hermanus" searches
```

### Source

```
Source
├── id            string
├── name          string           ← "google-events", "facebook-events", "eventbrite", "tripadvisor", "quicket", "hermanus.co.za", "manual"
├── url           string | null
├── trust_level   float (0–1)      ← affects confidence scoring
├── last_scraped  datetime | null
└── scrape_config object | null    ← source-specific config (selectors, API params)
```

### EventVersion (audit trail)

```
EventVersion
├── event_id      string
├── version       int
├── changed_at    datetime
├── changed_by    string           ← "ingest-agent", "manual", "review-agent"
├── diff          object           ← what changed
└── snapshot       Event           ← full event at this version
```

This enables the spec's question: *"How would you go back to see what effect a change had?"* Every ingestion run creates a new version if anything changed. You can diff any two versions to see what the agent changed and whether it improved or degraded the data.

---

## API Design

### Principles for agent-friendliness

1. **Structured JSON everywhere.** Every response has `{ data, meta, errors }`. No freeform text.
2. **Self-describing schemas.** OpenAPI spec with rich descriptions. An agent reading the spec can call every endpoint without human documentation.
3. **Token-aware responses.** Pagination defaults to 20 items. `meta.total_count` and `meta.has_more` let agents decide whether to paginate. No unbounded responses.
4. **Idempotent mutations.** `PUT /events/:id` with version check. Agent retries don't create duplicates.
5. **Actionable errors.** Error responses include `{ code, message, suggestion, retryable }`.

### Endpoints

```
GET  /api/events
     ?from=2027-09-14&to=2027-09-21        ← date range (the primary query)
     &categories=music,wildlife             ← filter by category
     &suitable_for=couples,luxury           ← filter by traveller profile
     &min_confidence=0.6                    ← only show events we're fairly sure about
     &status=active                         ← default: active only
     &sort=relevance|date|confidence        ← default: relevance
     &page=1&per_page=20

GET  /api/events/:id                        ← single event with full detail
GET  /api/events/:id/versions               ← version history (audit trail)

POST /api/events                            ← create (manual submission or agent ingest)
PUT  /api/events/:id                        ← update (requires version for optimistic concurrency)
DELETE /api/events/:id                       ← soft-delete (sets status to "cancelled")

GET  /api/sources                           ← list all configured sources
POST /api/ingest                            ← trigger an ingestion run for a source
GET  /api/ingest/runs                       ← history of ingestion runs with stats
POST /api/review                            ← trigger a review pass on existing events

GET  /api/cron                              ← Vercel Cron handler (daily ingest + weekly review)
GET  /api/health                            ← system health + last successful ingest per source
GET  /api/schema                            ← OpenAPI spec (for agent self-discovery)
```

### Example: agent query

An agent planning a luxury couple's trip to Hermanus for 14–21 September 2027:

```
GET /api/events?from=2027-09-14&to=2027-09-21&suitable_for=couples,luxury&min_confidence=0.6
```

Response:
```json
{
  "data": [
    {
      "id": "01J5...",
      "title": "Southern Right Whale Watching Season",
      "temporal": { "type": "seasonal", "start_month": 6, "end_month": 11 },
      "categories": ["wildlife"],
      "relevance_score": 0.95,
      "confidence": 0.99,
      "price_indication": "free (land-based) / from R1200 (boat)",
      "suitable_for": ["couples", "families", "luxury", "solo"]
    },
    {
      "id": "01J5...",
      "title": "Hermanus Country Market",
      "temporal": { "type": "recurring", "recurrence": { "frequency": "weekly", "day_of_week": 5 } },
      "categories": ["market", "food-wine"],
      "relevance_score": 0.82,
      "confidence": 0.95,
      "price_indication": "free entry",
      "next_occurrence_in_range": "2027-09-20"
    }
  ],
  "meta": { "total_count": 7, "page": 1, "per_page": 20, "has_more": false }
}
```

Note `next_occurrence_in_range` — for recurring events, the API pre-computes the next date within the query range so the agent doesn't have to do recurrence math.

---

## Agent Architecture

Three agents, each with a single job:

### 1. Ingest Agent

**Job:** Given a source, fetch raw data and produce normalised `Event` objects.

**How it works:**
- Receives raw HTML/JSON from a source (Apify actor response, scraped page)
- Uses Claude Haiku to extract event data into the `Event` schema
- Assigns initial `confidence` based on source trust level and extraction clarity
- Deduplicates against existing events using fuzzy matching on (title + date + venue)
- Creates or updates events, bumping version on changes

**Why Claude for extraction:** Small-town tourism sites have inconsistent formats. A regex-based scraper breaks every time the site changes. Claude reads messy HTML and extracts structured data reliably. The cost is ~$0.002 per page with Haiku 5.5 ($0.10/M input).

**Tracer bullet:** After ingestion, the agent outputs a `run_report` with: events found, events created, events updated, events skipped (duplicate), and confidence distribution. If average confidence drops below 0.5, the run is flagged for review.

### 2. Relevance Agent

**Job:** Score events for relevance given a traveller profile.

**How it works:**
- Called at query time (or pre-computed on a schedule)
- Takes event metadata + traveller profile (age range, interests, trip type)
- Returns a `relevance_score` (0–1)
- Simple rules first, Claude for edge cases:
  - Whale watching + "wildlife" interest → 0.95
  - Rugby match + "luxury couples" → 0.4 (might be relevant, but not core)
  - FynArts + "art, culture" → 0.9
- Falls back to Claude Haiku for events that don't match simple rules

**Why not always use Claude:** Cost and latency. Simple keyword matching handles 80% of cases. Claude handles the long tail.

### 3. Review Agent

**Job:** Periodically verify that stored events are still correct.

**How it works:**
- Runs weekly (or on-demand)
- For each event approaching its date (within 30 days), re-checks the source
- Updates status (confirmed → cancelled, date changed, etc.)
- For events with `confidence < 0.7`, attempts to find a second source for verification
- Logs all changes to `EventVersion`

**Tracer bullet:** Outputs a `review_report` with: events checked, events confirmed, events updated, events marked stale (source gone). If >20% of events are stale, the source's `trust_level` is lowered.

---

## Sources — Ranked by Expected Yield

| Priority | Source | Method | Expected yield | Cost |
|---|---|---|---|---|
| 1 | Google Events | Apify actor (Google Events Scraper) | Medium-high | ~$0.002/result ($2/1K results) |
| 2 | Facebook Events | Apify actor (Facebook Events Scraper) | High (dominant platform in SA) | ~$0.003/result |
| 3 | Quicket | Apify actor (Quicket scraper) | Medium | ~$0.002/result |
| 4 | Eventbrite | Apify actor (Eventbrite Scraper) | Medium | ~$0.002/result |
| 5 | TripAdvisor | Apify actor (TripAdvisor Scraper) | Low-medium (tourist-facing events) | ~$0.003/result |
| 6 | hermanus.co.za | Scrape (Haiku 5.5 extracts) | Medium | ~$0.01/run |
| 7 | ShowMe Hermanus | Scrape (Haiku 5.5 extracts) | Medium | ~$0.01/run |
| 8 | fynarts.co.za | Scrape (seasonal) | Low (but high-value) | ~$0.003/run |
| 9 | Whale Festival site | Scrape (seasonal) | Low | ~$0.003/run |
| 10 | SA-Venues | Scrape | Low-medium | ~$0.005/run |
| 11 | Manual submission | Form/API | High (over time) | Free |

**Why this order:** All Apify-based sources use one API key and one billing model, simplifying operations. Google Events aggregates what Google already indexes — the broadest net. Facebook Events is the dominant event platform in SA and now accessible via Apify actor (bypassing Facebook's restricted APIs). Quicket is South Africa's primary ticketing platform — if an event sells tickets, it's likely on Quicket. Eventbrite covers professionally organised events. TripAdvisor surfaces tourist-facing activities and experiences. Local tourism sites fill the gap for community events. Manual submission is the long-term play for events no scraper can find (church fetes, pop-up dinners, wine farm events announced only via email newsletters).

**What we won't get (the honest gap):** No combination of APIs and scrapers gives full coverage for a town of ~91K people. Informal community events, last-minute pop-ups, and wine farm email-only events will be missed. The manual submission form and local partnerships (tourism bureau, Hermanus Times newspaper) are essential for filling this gap. The system is designed to start sparse and improve as sources are added.

---

## Principles

### 1. Sparse and correct beats complete and wrong

**Rule:** Only show events with `confidence >= 0.6` by default. Surface low-confidence events behind a flag, never in the default feed.

**What you accept:** The feed will miss events, especially early on. A travel agent seeing 5 real events is more useful than 20 events where 8 are wrong (cancelled, wrong date, duplicate). Trust is earned by accuracy, not volume.

**Trade-off:** A competing system that shows everything looks richer at first glance. We look better after the agent books a client for a cancelled event based on bad data.

### 2. The temporal model must be a first-class concept, not a string

**Rule:** Every event has a typed `Temporal` object with explicit `type` discriminator. No freeform date strings, no "TBD" dates stored as nulls pretending to be point events.

**What you accept:** Ingestion is harder — the agent must classify each event into one of four types. Some events won't fit cleanly (a festival that's "usually in June" but hasn't announced dates yet → stored as `seasonal` with `start_month: 6, end_month: 6` until confirmed).

**Trade-off:** Simpler systems store `start_date` and `end_date` and call it done. Those systems can't answer "what's happening in Hermanus in whale season?" because seasonal events have no dates.

### 3. Agent-first, human-readable

**Rule:** The API is designed for Claude/Codex to consume. Structured responses, self-describing schemas, pre-computed fields like `next_occurrence_in_range`. The UI (if built) reads the same API.

**What you accept:** The API may feel over-structured for a human developer used to simple REST. Every field has a reason, and removing fields to "simplify" degrades agent performance.

**Trade-off:** An API designed purely for a human frontend would be simpler (just return events as a list, let the frontend compute what it needs). An agent-first API does more work server-side so the agent's context window stays clean.

### 4. Version everything, diff anything

**Rule:** Every event change creates a versioned snapshot. Sources track their last scrape. Ingestion runs are logged with stats.

**What you accept:** Storage grows linearly with changes. For a small-town feed, this is negligible (<1 GB/year). The audit trail is essential for the spec's question: *"How would you go back to see what effect a change had?"*

**Trade-off:** A simpler system overwrites events in place. You lose the ability to debug bad ingestion runs, track source quality degradation, or answer "what did the feed look like last month?"

### 5. Start manual, automate what proves valuable

**Rule:** Build the ingestion pipeline and manual submission first. Add scrapers one at a time, starting with the highest-yield sources. Don't build 10 scrapers before validating that the data model works.

**What you accept:** The first version will have fewer automated sources. That's fine — the design supports adding sources without changing the data model or API.

**Trade-off:** A "build everything" approach would have more data on day one but higher maintenance burden and more broken scrapers to fix when sites change.

---

## Open Decisions

### 1. Database: PostgreSQL vs SQLite

**Recommendation:** PostgreSQL (via Supabase or Neon).

**Under PostgreSQL:** Full-text search, JSON columns for flexible metadata, PostGIS for location queries, concurrent access for multiple agents, production-ready. Supabase gives a free tier with 500 MB.

**Under SQLite:** Zero infrastructure, embedded, great for prototyping. But: no concurrent writes (problem when ingest and review agents run simultaneously), no full-text search without extensions, harder to deploy as a web service.

**Worked example:** The ingest agent runs at 2 AM and processes 50 events. The review agent also runs at 2 AM and checks 30 existing events. With PostgreSQL, both run concurrently with row-level locking. With SQLite, one blocks the other — the review agent waits or fails.

### 2. Scraping: Claude extraction vs CSS selectors

**Recommendation:** Claude extraction (Haiku) with CSS selectors as fallback for structured sources.

**Under Claude extraction:** Resilient to HTML changes, handles messy formatting, extracts semantics (not just text). Cost: ~$0.01 per page. For 10 sources scraped daily, that's ~$3/month.

**Under CSS selectors:** Free, fast, deterministic. But brittle — when hermanus.co.za changes their HTML, the scraper breaks silently and returns empty data until someone notices.

**Worked example:** hermanus.co.za lists events in a `<div class="event-listing">` today. If they redesign and use `<article class="event-card">`, CSS selectors break. Claude reads both layouts and extracts the same data because it understands the content semantically.

### 3. Deduplication: strict vs fuzzy

**Recommendation:** Fuzzy matching with human-in-the-loop for low-confidence matches.

**Under strict (exact title + date):** "Hermanus Country Market" from Google Events and "Hermanus Country Market (Weekly)" from hermanus.co.za are treated as different events. You get duplicates.

**Under fuzzy (Levenshtein + date proximity + venue):** The same events are merged. But "FynArts Festival 2027" and "FynArts: Opening Night 2027" might be incorrectly merged — one is the festival, the other is a sub-event.

**Worked example:** Google Events returns "Hermanus Whale Festival 2027, 27–28 Sep" and Quicket returns "Whale Festival Hermanus, 27 September 2027 – 28 September 2027". Fuzzy matching on normalised title (lowercase, remove "the", strip punctuation) + overlapping dates → merge with confidence boost (two sources agree).

---

## How It's Checked — Hand-Worked Cases

### Case 1: Luxury couple trip, 14–21 September 2027

**Input:** `GET /api/events?from=2027-09-14&to=2027-09-21&suitable_for=couples,luxury`

**Expected events (worked by hand):**

| Event | Type | Why it matches | Confidence |
|---|---|---|---|
| Whale watching season | seasonal (Jun–Nov) | September is within Jun–Nov | 0.99 |
| Hermanus Country Market | recurring (Sat) | 20 Sep 2027 is a Saturday | 0.95 |
| Hermanus Whale Festival | point/range (late Sep, ~27–28 Sep) | Doesn't overlap 14–21 Sep | Should NOT appear |
| Wine farm dinner at Creation | point (18 Sep 2027, hypothetical) | Falls within range | 0.70 |
| FynArts Festival | point/range (June 2027) | June ≠ September | Should NOT appear |

**Verification:** The whale festival is the tricky one. If the festival is 27–28 Sep, it falls outside the 14–21 range and should NOT be returned. This tests whether the overlap logic is correct (`start_date <= travel_end AND end_date >= travel_start` → `2027-09-27 <= 2027-09-21` is false → correctly excluded).

### Case 2: Family trip, full month of June 2027

**Input:** `GET /api/events?from=2027-06-01&to=2027-06-30&suitable_for=families`

**Expected events:**

| Event | Type | Why |
|---|---|---|
| Whale watching season | seasonal (Jun–Nov) | June is within range |
| FynArts Festival | range (mid-June, ~5 days) | Falls within June |
| Hermanus Country Market | recurring (Sat) | 4 Saturdays in June |
| Fernkloof wildflower walk | recurring? seasonal? | Depends on data — Sept is peak, June may be early |

**Verification:** `next_occurrence_in_range` for the market should return "2027-06-07" (first Saturday). FynArts dates should be specific if the programme is published, or approximate if not.

### Case 3: Duplicate detection across sources

**Input:** Google Events returns `"FynArts Festival Hermanus 2027"` and hermanus.co.za returns `"Hermanus FynArts 2027 — Annual Arts Festival"`.

**Expected behaviour:** Fuzzy match detects these as the same event (normalised titles share "fynarts", "hermanus", "2027"; dates overlap). The event is merged, `confidence` increases (two sources agree), and both source URLs are stored in `links`.

### Case 4: Cancelled event handling

**Input:** An event was ingested 3 months ago. The review agent re-checks and the source page now says "CANCELLED" or returns 404.

**Expected behaviour:** Event `status` changes from "active" to "cancelled". A new `EventVersion` is created with the diff. The event stops appearing in default queries but is still accessible via `?status=cancelled` for audit purposes. If the source returns 404 (page gone, not necessarily cancelled), `confidence` drops but status stays "active" with a flag for manual review.

---

## Execution Plan

| Step | What | Risk | Impact | Depends on |
|---|---|---|---|---|
| 1 | Data model + DB schema (PostgreSQL) | Low | High | Nothing |
| 2 | API endpoints (Next.js API routes) | Low | High | Step 1 |
| 3 | Apify ingest agents (Google Events, Facebook, Eventbrite, TripAdvisor) | Medium (actor response formats) | High (primary data sources) | Step 1, 2 |
| 4 | Overlap query logic (the core algorithm) | Medium (recurrence math) | Critical | Step 1 |
| 5 | Quicket (Apify actor) integration | Low (Apify actor API) | Medium | Step 1, 2 |
| 6 | One scraper (hermanus.co.za) with Claude extraction | Medium (site structure) | Medium | Step 1, 2 |
| 7 | Deduplication logic | Medium (fuzzy matching edge cases) | High | Step 3, 5, 6 |
| 8 | Review agent (re-verification) | Low | Medium | Step 1, 2 |
| 9 | Manual submission endpoint | Low | Medium (long-term value) | Step 2 |
| 10 | Relevance scoring | Low | Medium | Step 2 |

**Critical path:** Steps 1 → 2 → 3 → 4. Everything else can run in parallel after step 2.

**Highest risk:** Step 4 (overlap query logic for recurring/seasonal events). The recurrence expansion and seasonal month-range overlap are where bugs hide. This gets the most tracer bullets: hand-worked test cases run against the actual query function.

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router) | Stable LTS. API routes + potential UI in one project. |
| Language | TypeScript | Type safety on the event model. Four temporal types need compile-time checks. |
| Database | PostgreSQL (Neon free tier) | Concurrent agents, JSON columns, full-text search. 1 GB free. |
| ORM | Drizzle | Lightweight, type-safe, SQL-first. No magic. |
| AI (extraction) | Claude Haiku 5.5 | Cheapest model that reliably extracts structured data from messy HTML. $0.10/M input, $0.50/M output. |
| AI (relevance) | Claude Haiku 5.5 | Only for edge cases. Most relevance is rule-based. |
| Event sources | Apify actors (Google Events, Facebook Events, Eventbrite, TripAdvisor, Quicket), fetch + Claude for scraping | One API key, one billing model. Ranked by yield. |
| Scheduling | Vercel Cron (or simple setInterval in dev) | Trigger daily/weekly ingestion and review runs. |
| Validation | Zod | Runtime schema validation on all ingest data. |
| Deployment | Vercel ([live](https://events-feed-hermanus.vercel.app)) | Zero-config Next.js deployment. Free tier sufficient. |

**Why not FastAPI/Python:** Next.js API routes handle this well, keep everything in one repo and one language. If the ingestion pipeline needed heavy ML processing or complex data pipelines, Python would be warranted. For structured API + Claude calls + DB operations, TypeScript is simpler.

---

## Cost Estimate

### Build phase
- Claude Opus/Sonnet (via Claude Code): included in Claude Max subscription — $0 marginal
- Apify actors (Google Events, Facebook, Eventbrite, TripAdvisor, Quicket): free tier ($5/month platform credits) — $0
- Neon PostgreSQL: free tier — $0
- Vercel: free tier — $0

### Weekly production run (v1 — Hermanus only)
| Item | Volume | Cost |
|---|---|---|
| Apify actors (all sources) | ~200 results/week (~800/month, within $5/month free credits) | $0/week |
| Claude Haiku 5.5 (ingestion) | ~50 pages, ~100K tokens total | ~$0.02/week |
| Claude Haiku 5.5 (review) | ~30 events, ~60K tokens | ~$0.01/week |
| Claude Haiku 5.5 (relevance) | ~10 queries, ~20K tokens | ~$0.005/week |
| Database (Neon) | <100 MB | $0/week (1 GB free tier) |
| Vercel hosting | Hobby tier | $0/week |
| **Total weekly** | | **~$0.04/week** |
| **Monthly estimate** | | **~$0.15/month** |

### Scaling cost projection
| Destinations | Apify results/month | Apify/month | Haiku 5.5/month | Total/month |
|---|---|---|---|---|
| 1 (Hermanus) | ~800 (within $5 free credits) | $0 | $0.15 | **$0.15** |
| 10 | ~8K (~$2/1K avg across actors) | $16 | $1.50 | **$18** |
| 50 | ~40K | $80 | $7.50 | **$88** |
| 100 | ~80K | $160 | $15 | **$175** |

Apify is the dominant cost at scale, but pricing is pay-per-result with no plan tiers to jump between. Costs scale linearly with usage. One API key and one billing model across all five source actors simplifies operations. Claude Haiku 5.5 at $0.10/M input tokens is essentially free for structured extraction workloads.

### Model choices rationale
- **Haiku 5.5 for extraction/review:** $0.10/M input, $0.50/M output. 90% cheaper than Haiku 4.5. Structured extraction from HTML doesn't need reasoning — Haiku handles it at a fraction of a cent per page.
- **Sonnet for design iteration:** Used during the design phase (this document), not in production.
- **Opus for complex decisions only:** Not used in production. Overkill for this workload.

---

## How to Improve Later

1. **Add sources incrementally.** Each new source is a new `Source` config + an adapter function. The data model doesn't change.

2. **Track source quality over time.** The `EventVersion` table enables: for each source, what percentage of its events get corrected by the review agent? Sources with high correction rates get lower `trust_level`, which lowers default `confidence` on their events.

3. **A/B test relevance scoring.** Store the scoring algorithm version in `EventVersion.changed_by`. Compare click-through or booking rates across versions. This requires downstream integration with the trip planner — not in scope for v1 but the data model supports it.

4. **Expand to other destinations.** The Location model supports any town. Add a `destination` parameter to the API (`?destination=hermanus`). Source configs are per-destination. The core model and API don't change.

5. **Community submission.** A simple form where local businesses submit events. These go in with `source: "manual"` and `confidence: 0.5` (unverified). The review agent can bump confidence if it finds a matching event from another source.

6. **iCal/RSS feed output.** Expose `/api/events.ics` and `/api/events.rss` so travel agents can subscribe in their calendar apps. This is a view on the same data, not a new data model.
