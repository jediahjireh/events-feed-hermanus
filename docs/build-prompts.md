# Suggested Build Prompts

These are the prompts to use with Claude Code to build the project from the design. They follow the spec's recommended flow: "Do a proper design with Claude and iterate on it. This is where tracer bullets and checks in the right places come in, and where you give Claude the principles and the decisions."

Each prompt references DESIGN.md and CLAUDE.md so Claude works from the plan, not from scratch.

---

## Phase 1: Project Setup

### Prompt 1.1 — Scaffold

```
Read CLAUDE.md and DESIGN.md in this project. Then:

0. BEFORE writing any code: web-search for the current stable versions and API patterns for Next.js (App Router), Drizzle ORM, @neondatabase/serverless, and Zod. Verify the versions in CLAUDE.md are current. If any are outdated, update CLAUDE.md first. Check for breaking changes in route handlers, schema definitions, and connection patterns. Prefer official docs over training data when they conflict.

1. Initialise a Next.js 16 project with App Router and TypeScript in this directory.
2. Install dependencies: drizzle-orm, drizzle-kit, @neondatabase/serverless, zod, ulid, anthropic.
3. Create .env.example with these keys: DATABASE_URL, ANTHROPIC_API_KEY, SERPAPI_KEY, APIFY_API_KEY.
4. Create drizzle.config.ts pointing at DATABASE_URL.
5. Set up the tsconfig.json path alias @/ → src/.
6. Create the directory structure from CLAUDE.md's project structure section.
7. Install test framework: vitest + @testing-library/react (for any future UI). Configure vitest.config.ts. Add "test" script to package.json.

Don't create any source files yet — just the scaffold, config, and test setup.
```

### Prompt 1.2 — Database Schema

```
Read the data model section of DESIGN.md. Create src/db/schema.ts using Drizzle ORM with:

1. events table — matches the Event entity exactly. Use the Temporal type as a JSON column with Zod validation.
2. event_versions table — matches the EventVersion entity.
3. sources table — matches the Source entity.
4. ingest_runs table — log each ingestion run (source_id, timestamp, events_found, events_created, events_updated, events_skipped, avg_confidence, tokens_used, cost_usd).

Use ULIDs for all IDs. Use the temporal JSON column approach (not separate tables for each temporal type — that's over-normalised for this problem).

Then create the Zod schemas in src/types/event.ts that validate the Event, Temporal, Recurrence, Location, and Source shapes. These schemas are used both for API validation and for agent extraction output validation.
```

---

## Phase 2: Core Logic (the hard part)

### Prompt 2.1 — Temporal Overlap Logic

```
Read DESIGN.md's "The key query" section and the hand-worked cases.

Create src/lib/temporal.ts with an overlaps(event: Event, travelStart: Date, travelEnd: Date): boolean function that handles all four temporal types:

- point: start_date within range
- range: start_date <= travel_end AND end_date >= travel_start
- recurring: expand occurrences within [travelStart, travelEnd] using recurrence rule, excluding exceptions
- seasonal: check if any travel month falls within [start_month, end_month], handling year-boundary wrap (e.g. Nov-Feb)
- multi-date (dates array): check if any date falls within range

Also create nextOccurrenceInRange(event: Event, travelStart: Date, travelEnd: Date): Date | null for recurring events.

Write tests in tests/temporal.test.ts covering:
1. All four hand-worked cases from DESIGN.md
2. Edge case: seasonal event wrapping year boundary (Nov-Feb)
3. Edge case: recurring event with exception on a matching date
4. Edge case: travel range of exactly one day
5. Edge case: travel range that spans a month boundary

This is the most critical code in the project. Run the tests and make sure they all pass before moving on.
```

### Prompt 2.2 — Deduplication

```
Read DESIGN.md's deduplication open decision (fuzzy matching recommendation).

Create src/lib/dedup.ts with:

1. normaliseTitle(title: string): string — lowercase, strip "the", remove punctuation, collapse whitespace.
2. titleSimilarity(a: string, b: string): number — Levenshtein distance normalised to 0-1.
3. temporalOverlap(a: Temporal, b: Temporal): boolean — do two events' temporal ranges overlap?
4. findDuplicates(newEvent: Event, existingEvents: Event[]): { match: Event, confidence: number }[] — returns potential duplicates ranked by match confidence.

Threshold: title similarity > 0.7 AND temporal overlap AND (venue matches OR either venue is null).

Write tests covering the three dedup cases from DESIGN.md (exact match, fuzzy match, false positive sub-event).
```

---

## Phase 3: API

### Prompt 3.1 — Event Endpoints

```
Read DESIGN.md's API design section.

Create the API routes in src/app/api/:

1. GET /api/events — the primary query endpoint. Query params: from, to, categories, suitable_for, min_confidence (default 0.6), status (default "active"), sort (default "relevance"), page, per_page (default 20, max 100). Response: { data: Event[], meta: { total_count, page, per_page, has_more } }.

2. GET /api/events/[id] — single event with full detail.

3. GET /api/events/[id]/versions — version history.

4. POST /api/events — create event (used by ingest agents and manual submission). Validate with Zod schema.

5. PUT /api/events/[id] — update event. Requires version field for optimistic concurrency. Creates EventVersion on change.

6. DELETE /api/events/[id] — soft delete (set status: "cancelled").

For the GET /api/events endpoint, the core logic is:
- Fetch all active events
- Filter by overlaps(event, from, to) using temporal.ts
- Filter by categories, suitable_for, min_confidence
- For recurring events, add next_occurrence_in_range to the response
- Sort by relevance_score (default) or date or confidence
- Paginate

Every response must follow { data, meta, errors } structure.
Every error must include { code, message, suggestion, retryable }.
```

### Prompt 3.2 — Support Endpoints

```
Create the remaining API routes:

1. GET /api/sources — list all configured sources with last_scraped timestamp.
2. POST /api/ingest — trigger an ingestion run. Body: { source_id } or { source_id: "all" }. Returns the run report.
3. GET /api/ingest/runs — history of ingestion runs with stats.
4. GET /api/health — system health: DB connection status, last successful ingest per source, total active events.
5. GET /api/schema — serve the OpenAPI spec (can be a static JSON file).
```

---

## Phase 4: Agents

### Prompt 4.1 — SerpAPI Ingest Agent

```
Read the ingest skill in .claude/skills/ingest/SKILL.md and DESIGN.md's sources section.

Create src/lib/sources/serpapi.ts:
- Call SerpAPI's Google Events API with engine: "google_events", q: "events in Hermanus South Africa", gl: "za".
- Paginate through all results.
- Return raw event objects.

Create src/agents/ingest.ts:
- Takes a source config.
- Calls the source's fetch function (serpapi.ts for SerpAPI).
- For each raw event, use Claude Haiku to extract and normalise into the Event schema.
- The extraction prompt must explicitly ask Claude to classify the temporal type (point/range/recurring/seasonal) and explain its reasoning.
- Run dedup against existing events.
- Create or update events, creating EventVersion records.
- Return a run report (events found, created, updated, skipped, confidence distribution, tokens used, cost).

The extraction prompt template:

"""
Extract event data from this raw listing into the following JSON schema.
Classify the temporal type as one of: "point" (single date), "range" (start and end dates), "recurring" (repeats on a schedule), or "seasonal" (happens during certain months, no specific dates).

Explain your temporal classification in one sentence.

If you're not confident about any field, set it to null and explain why in a "notes" field. Set confidence to a number between 0 and 1 based on how complete and unambiguous the source data is.

Schema: {Zod schema as JSON}

Raw listing:
{raw event data}
"""

Important: validate Claude's output against the Zod schema. If validation fails, log the error and skip the event (don't store invalid data).
```

### Prompt 4.2 — Quicket Integration

```
Quicket has no public developer API (verified Nov 2026). Use the Apify SA Events Scraper instead:
https://apify.com/gtnetworks/sa-events-listings

Create src/lib/sources/quicket.ts:
- Use the Apify API to run the SA Events Scraper actor or fetch its latest dataset.
- Filter results for events near Hermanus or in the Western Cape.
- The scraper outputs clean JSON with: title, startAt (UTC), endAt, venue, city, province, category, price range, organiser, image, link.
- Apify API key goes in APIFY_API_KEY env var (free tier available).
- Parse the response into raw event objects matching our Event schema.

Wire it into the ingest agent alongside SerpAPI. The ingest agent should handle both sources through the same normalisation pipeline.
```

### Prompt 4.3 — Claude-Powered Scraper

```
Create src/lib/sources/scraper.ts — a generic scraper that:

1. Fetches a URL using fetch().
2. Passes the HTML to Claude Haiku with an extraction prompt.
3. Claude returns an array of events in the Event schema format.
4. Validates against Zod schema.

This is used for sources without APIs (hermanus.co.za, ShowMe Hermanus, fynarts.co.za).

The extraction prompt:

"""
You are extracting event listings from a tourism website for Hermanus, South Africa.

Extract ALL events you can find on this page. For each event, provide:
- title
- description (if available)
- temporal classification: "point" (single date), "range" (date range), "recurring" (regular schedule), or "seasonal" (certain months, no dates)
- temporal details: dates, recurrence rules, or months as appropriate
- venue/location
- categories (from: music, market, wildlife, art, sport, food-wine, family)
- price indication (if mentioned)
- source URL

If the page doesn't contain event listings, return an empty array.
If you're unsure about temporal classification, default to "point" with low confidence.

Respond with valid JSON only. Schema:
{schema}

Page HTML:
{html}
"""
```

### Prompt 4.4 — Review Agent

```
Read the review skill in .claude/skills/review/SKILL.md.

Create src/agents/review.ts:
- Select events to review (upcoming 30 days, low-confidence, or all).
- For each event, re-fetch its source URL.
- Use Claude Haiku to check if the event is still listed and whether details changed.
- Update event status, confidence, and create EventVersion records.
- Lower source trust_level if >30% of events are unconfirmed.
- Return a review report.
```

---

## Phase 5: Seed and Test

### Prompt 5.1 — Seed Data

```
Create src/db/seed.ts with realistic test data for Hermanus:

1. Whale watching season (seasonal, Jun-Nov, confidence 0.99)
2. Hermanus Country Market (recurring, every Saturday, confidence 0.95)
3. FynArts Festival 2027 (range, mid-June, 5 days, confidence 0.85)
4. Hermanus Whale Festival 2027 (range, 27-28 Sep, confidence 0.80)
5. Wine tasting at Creation Wines (recurring, Fri-Sun, confidence 0.70)
6. A hypothetical cancelled event (status: "cancelled")
7. A low-confidence event (confidence: 0.4)

Also seed sources: serpapi, quicket, hermanus.co.za, manual.

This data matches the hand-worked cases in DESIGN.md so we can verify the API against expected results.

Also create tests/helpers/factories.ts with test factory functions:
- makeEvent(overrides?) — creates a valid Event with sensible defaults
- makePointEvent(overrides?) — point temporal type
- makeRangeEvent(overrides?) — range temporal type
- makeRecurringEvent(overrides?) — recurring temporal type
- makeSeasonalEvent(overrides?) — seasonal temporal type
- makeSource(overrides?) — creates a valid Source

These factories should produce valid objects that pass Zod validation. Every test file should use these instead of inline test data.
```

### Prompt 5.2 — Hand-Worked Case Tests

```
Read the "How it's checked" section of DESIGN.md.

Create tests/hand-worked-cases.test.ts that tests:

1. Case 1: Luxury couple, 14-21 Sep 2027 → whale watching YES, market YES (20 Sep), whale festival NO (27-28), FynArts NO (June)
2. Case 2: Family, June 2027 → whale watching YES, FynArts YES, market YES (4 Saturdays)
3. Case 3: Dedup — "FynArts Festival Hermanus 2027" and "Hermanus FynArts 2027" should merge
4. Case 4: Cancelled event handling — event disappears from source, confidence drops, eventually marked tentative

These tests use the seed data and hit the actual API endpoints. They are the primary acceptance tests for the system.
```

---

## Phase 6: Polish

### Prompt 6.1 — OpenAPI Spec

```
Generate an OpenAPI 3.1 spec for all API endpoints and serve it at GET /api/schema. This is what an AI agent reads to discover the API — it must be complete and accurate.
```

### Prompt 6.2 — Health Check

```
Implement GET /api/health that returns:
- Database connection status
- Last successful ingest per source (with timestamp and event count)
- Total active events by temporal type
- Total events by confidence bucket (0-0.3, 0.3-0.6, 0.6-0.8, 0.8-1.0)
```

---

## Running Order

1. Phase 1 (scaffold + schema) — do this first, verify DB connection
2. Phase 2 (temporal + dedup) — do this second, **run tests before moving on**
3. Phase 3 (API) — build endpoints, test with seed data
4. Phase 4 (agents) — wire up real sources, run first ingest
5. Phase 5 (seed + tests) — verify hand-worked cases pass
6. Phase 6 (polish) — OpenAPI spec, health check

**Tracer bullet checkpoints:**
- After Phase 2: temporal tests all pass
- After Phase 3: API returns correct results for hand-worked case queries using seed data
- After Phase 4: first real SerpAPI ingest produces valid events with correct temporal types
- After Phase 5: all hand-worked case tests pass end-to-end
