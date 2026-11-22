# Hermanus Event Feed — Reviewer Guide

## Table of Contents

- [What It Is](#what-it-is)
- [What It Does](#what-it-does)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Key Numbers](#key-numbers)
- [Quick Test Prompt](#quick-test-prompt)
- [Full CRUD Testing](#full-crud-testing)
- [Key Links](#key-links)
- [What I'd Improve Next](#what-id-improve-next)

---

## What It Is

An event feed for Hermanus, South Africa. Collects events from 7 sources, normalises them into a unified temporal model that handles 4 event shapes, and serves an agent-friendly REST API so travel planners can answer: **"What is on while my traveller is there?"**

## What It Does

- **Ingests** from Google Events, Facebook, Eventbrite, TripAdvisor, Quicket, hermanus.co.za, and manual submission
- **Normalises** into 4 temporal types: point (single date), range (multi-day), recurring (weekly/monthly), seasonal (months, no dates)
- **Deduplicates** with fuzzy title matching + temporal overlap + venue proximity
- **Scores** confidence (source trust x extraction clarity) and relevance (traveller profile match)
- **Versions** every change with full snapshot + diff audit trail
- **Serves** 13 REST endpoints with filtering by date range, categories, traveller profile, confidence, and status
- **Frontend** with natural language date picker ("winter", "whale season", "next friday"), filter presets, event detail with version history, and admin panel with live E2E test runner

## Architecture

```
Sources (7)  →  Ingest Agent  →  Claude Haiku 5.5 extraction  →  Zod validation
                                                                        ↓
                                                              Dedup check (fuzzy)
                                                                        ↓
                                                              PostgreSQL (Neon)
                                                                        ↓
                                                              REST API (13 endpoints)
                                                                        ↓
Review Agent (re-verify)  ←─────────────────────────── Relevance Agent (score)
```

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router) | API routes + UI in one repo |
| Language | TypeScript | Type safety on 4 temporal types |
| Database | PostgreSQL (Neon) | Concurrent agent access, JSON columns |
| ORM | Drizzle | Type-safe, SQL-first, readable |
| AI | Claude Haiku 5.5 | $0.10/M input — cheapest reliable extractor |
| Validation | Zod | Same schemas for API input, extraction output, DB inserts |
| Sources | SerpAPI + Apify | Hybrid: SerpAPI for search APIs, Apify for scraping |
| Deployment | Vercel | Zero-config, free tier, cron jobs |

## Key Numbers

| Metric | Value |
|---|---|
| API endpoints | 13 |
| Tests | 175 (125 backend + 50 season-dates) |
| Frontend pages | 3 (feed, detail, admin) |
| Event sources | 7 |
| Temporal types | 4 (point, range, recurring, seasonal) |
| Production lessons | 20 (in `tasks/lessons.md`) |
| Weekly run cost | ~$0.04 (all free tiers) |
| Build time | ~2h 50min personal time |

---

## Quick Test Prompt

Paste the prompt below into any Claude session (claude.ai, desktop app, or API) to run a live test of the production API. All requests are GET — no auth or write access needed. Claude uses web fetch to hit each endpoint and reports PASS/FAIL.

> On GitHub, click the copy button on the code block below.

```text
Test the Hermanus Event Feed API at https://events-feed-hermanus.vercel.app.

For each test below, fetch the URL, check the response against the expected result, and report PASS or FAIL with the actual values. All requests are GET.

1. Health check
   GET /api/health
   Expected: status "healthy", total_active_events >= 5, sources array with 7 entries

2. OpenAPI schema
   GET /api/schema
   Expected: openapi "3.1.0", paths object with 10 entries

3. Sources list
   GET /api/sources?per_page=2
   Expected: data array with 2 items, meta.total_count >= 7, meta.has_more = true

4. Events list
   GET /api/events
   Expected: response has data, meta, errors keys; meta.total_count >= 5

5. Category filter
   GET /api/events?categories=wildlife
   Expected: every event in data has "wildlife" in its categories array

6. Confidence filter
   GET /api/events (note the minimum confidence of returned events)
   GET /api/events?min_confidence=0
   Expected: default results all have confidence >= 0.6; min_confidence=0 returns more events

7. Cancelled filter
   GET /api/events (check no event has status "cancelled")
   GET /api/events?status=cancelled
   Expected: default excludes cancelled; ?status=cancelled returns 1+ cancelled events

8. Hand-worked Case 1 — luxury couple, Sep 14-21 2027
   GET /api/events?from=2027-09-14&to=2027-09-21&suitable_for=couples,luxury
   Expected: results include Whale Watching, Country Market, Wine Tasting
   Expected: results do NOT include Whale Festival or FynArts

9. Hand-worked Case 2 — family, June 2027
   GET /api/events?from=2027-06-01&to=2027-06-30&suitable_for=families
   Expected: results include Whale Watching, Country Market
   Expected: results do NOT include FynArts

10. Hand-worked Case 4 — cancelled Beach Concert
    GET /api/events?status=cancelled
    Expected: Beach Concert appears in cancelled list
    GET /api/events
    Expected: Beach Concert does NOT appear in active list

11. Pagination
    GET /api/events?per_page=2&page=1
    GET /api/events?per_page=2&page=2
    Expected: page 1 has 2 items with has_more=true; page 2 has items; total_count is consistent

12. Sorting
    GET /api/events?sort=date
    GET /api/events?sort=confidence
    GET /api/events?sort=relevance
    Expected: all three return results without errors

13. Relevance scoring
    GET /api/events?suitable_for=luxury&sort=relevance
    Expected: Wine Tasting appears in the top 3 results

14. Error handling
    GET /api/events/nonexistent-id-99999
    Expected: 404 response
    GET /api/events?from=2027-12-31&to=2027-01-01
    Expected: 400 response (reversed date range)

15. Cron auth
    GET /api/cron
    Expected: 401 response (missing authorization header)

16. Ingest run history
    GET /api/ingest/runs
    Expected: response has data array

Summarise with a table showing each test number, name, PASS/FAIL, and key actual values.
Report the total: X/16 PASS.
```

---

## Full CRUD Testing

The 16 tests above cover the read path. For full write-path testing (create, update, version conflicts, delete), use the admin panel:

1. Go to [events-feed-hermanus.vercel.app/admin](https://events-feed-hermanus.vercel.app/admin)
2. Click the **E2E Tests** tab
3. Click **Run All** — runs 19 checks including CRUD lifecycle, manual submission, and review agent

The E2E runner executes POST, PUT, and DELETE from the browser and reports PASS/FAIL with actual values.

---

## Key Links

| Resource | URL |
|---|---|
| Live site | [events-feed-hermanus.vercel.app](https://events-feed-hermanus.vercel.app) |
| Admin panel | [events-feed-hermanus.vercel.app/admin](https://events-feed-hermanus.vercel.app/admin) |
| API health | [events-feed-hermanus.vercel.app/api/health](https://events-feed-hermanus.vercel.app/api/health) |
| OpenAPI spec | [events-feed-hermanus.vercel.app/api/schema](https://events-feed-hermanus.vercel.app/api/schema) |
| Design write-up | `DESIGN.md` in repo root |
| Pen-and-paper notes | `docs/pen-and-paper/` |
| Agent setup | `CLAUDE.md`, `.claude/skills/`, `.claude/WORKFLOW.md` |
| Process docs | `docs/prompts-collection.md` |

---

## What I'd Improve Next

1. **Event website URLs** — The extraction prompt now asks Claude to find event-specific URLs (website, ticket links, organiser pages) and stores them in the `links` field. New ingests populate this automatically; existing events get backfilled when dedup merges. The frontend "Website" button falls back to `source_url` when `links.website` is null, so every event with a source link is clickable.

2. **Source quality tracking** — Track what percentage of a source's events get corrected by the review agent. High correction rates should automatically lower trust_level.

3. **iCal/RSS output** — `/api/events.ics` and `/api/events.rss` for calendar subscriptions.
