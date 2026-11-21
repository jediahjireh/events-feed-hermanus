---
name: ingest
description: Run or build an event ingestion pipeline for a specific source. TRIGGER when adding a new source, running an ingestion, or debugging ingestion output.
user-invocable: true
disable-model-invocation: true
argument-hint: "[source-name | 'all' | 'dry-run']"
---

# Ingest Skill — Event Data Ingestion

Ingest events from a configured source into the normalised event store.

## Process

### 1. Identify the source

If a source name is given, load its config from the `sources` table or `src/lib/sources/`.
If "all", iterate through all active sources in priority order (SerpAPI first, then Quicket, then scrapers).
If "dry-run", do everything except write to the database — output what would be created/updated.

### 2. Fetch raw data

- **SerpAPI**: Call the Google Events API with query `"events in Hermanus South Africa"` and location params. Paginate through all results.
- **Quicket**: Call `GET /api/events?location=Hermanus` via their REST API. Use the API key from env.
- **Scrapers**: Fetch the page HTML via `fetch()`, pass to Claude Haiku with extraction prompt.

### 3. Extract and normalise

For each raw event:

1. Map to the `Event` schema (see DESIGN.md data model).
2. **Classify the temporal type** — this is the critical step:
   - Has a single specific date → `"point"`
   - Has start and end dates → `"range"`
   - Mentions "every Saturday" / "weekly" / "monthly" → `"recurring"` (extract recurrence rule)
   - Mentions months but no specific dates (e.g. "June to November") → `"seasonal"`
   - Has multiple specific dates listed → `"range"` with `dates[]` array
3. Assign `confidence` based on: source trust level × extraction clarity.
4. Assign initial `categories` and `suitable_for` based on content analysis.

### 4. Deduplicate

For each extracted event, check existing events for fuzzy matches:
- Normalise title: lowercase, strip "the", remove punctuation, collapse whitespace.
- Match criteria: normalised title similarity > 0.7 AND dates overlap AND (venue matches OR venue is null).
- If match found: update existing event (merge data, bump confidence if multi-source), create new EventVersion.
- If no match: create new event.

### 5. Report

Output a run report:
```
Source: serpapi
Timestamp: 2027-01-15T02:00:00Z
Events found: 12
Events created: 4
Events updated: 3
Events skipped (duplicate): 5
Confidence distribution: [0.6-0.7: 2, 0.7-0.8: 3, 0.8-0.9: 5, 0.9-1.0: 2]
Tokens used: 4,200 (Haiku)
Cost: $0.003
```

## Tracer Bullets

After every ingestion run:
1. Check that all created events have valid temporal types (no nulls on required fields).
2. Check that no event has `confidence > source.trust_level` (can't be more confident than the source).
3. Check for any events with `temporal.type === "point"` and `start_date` in the past — these should be `status: "past"`.
4. Check that the total event count didn't decrease (ingestion should add, not remove).

## Adding a New Source

1. Create `src/lib/sources/{name}.ts` with a `fetch()` and `extract()` function.
2. Add source config to the `sources` table (name, URL, trust_level).
3. Write an extraction prompt specific to the source's HTML/API format.
4. Run `/ingest {name} --dry-run` first. Check output against the actual page by hand.
5. If dry-run looks correct, run `/ingest {name}` for real.
6. Check the run report and spot-check 3 events against the source.
