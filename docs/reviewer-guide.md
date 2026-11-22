# Hermanus Event Feed — Reviewer Guide

## Table of Contents

- [What It Is](#what-it-is)
- [What It Does](#what-it-does)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Key Numbers](#key-numbers)
- [Try It — Ask Claude to Plan a Trip](#try-it--ask-claude-to-plan-a-trip)
- [Full Technical Verification](#full-technical-verification)
- [Key Links](#key-links)
- [What I'd Improve Next](#what-id-improve-next)

---

## What It Is

An event feed for Hermanus, South Africa. Collects events from 7 sources, normalises them into a unified temporal model that handles 4 event shapes, and serves an agent-friendly REST API so travel planners can answer: **"What is on while my traveller is there?"**

## What It Does

- **Ingests** from Google Events, Facebook, Eventbrite, TripAdvisor, Quicket, hermanus.co.za, and manual submission
- **Normalises** into 4 temporal types: point (single date), range (multi-day), recurring (weekly/monthly), seasonal (months, no dates)
- **Deduplicates** with fuzzy title matching + temporal overlap (including cross-type: seasonal vs recurring) + venue proximity; merge prefers the rarer temporal classification (seasonal > range > point > recurring)
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
| Tests | 184 (134 backend + 50 season-dates) |
| Frontend pages | 3 (feed, detail, admin) |
| Event sources | 7 |
| Temporal types | 4 (point, range, recurring, seasonal) |
| Production lessons | 23 (in `tasks/lessons.md`) |
| Weekly run cost | ~$0.04 (all free tiers) |
| Build time | ~2h 50min personal time |

---

## Try It — Ask Claude to Plan a Trip

The point of this system is that a travel planner (human or AI) can ask "what is on while my traveller is there?" and get a useful answer. Paste any of the prompts below into a Claude chat to see it work.

### Prompt 1 — Luxury couple, September 2027

> On GitHub, click the copy button on the code block below.

```text
I'm putting together a week in Hermanus for a couple — they arrive September 14, leave September 21, 2027. Luxury end, into wine and nature.

I've got a local event feed for the area: https://events-feed-hermanus.vercel.app/api/events (docs at /api/schema if you need them — it takes `from`/`to` date params, `suitable_for` traveller profiles, and `sort=relevance`).

What's happening while they're there? Anything worth extending the trip for? Put together a briefing I can send them.
```

**What this tests:** Claude uses the hinted params to query with date range + traveller profile filters, uses relevance sorting, and presents results as a natural trip briefing. Expected: whale watching (seasonal), country market (recurring Saturday), wine tasting (recurring Friday). The Whale Festival (Sep 27-28) should appear as a near-miss worth extending for — not as an overlap.

### Prompt 2 — Family trip, June 2027

```text
I've got a family booking for Hermanus — two kids, 8 and 12, arriving June 2027. Parents are outdoorsy, keen on nature, but everything needs to work for the kids.

I use this event feed to track what's on locally: https://events-feed-hermanus.vercel.app/api/events (full docs at /api/schema — key params are `from`/`to` for dates, `suitable_for=families` for profile filtering, `categories` for event types).

What would you recommend for them? And flag anything that's on during their dates but wouldn't suit young kids — I'd rather know now than deal with a disappointed 8-year-old.
```

**What this tests:** Family profile filtering, June date range (whale season starts, FynArts overlaps but isn't family-tagged), natural presentation with practical family advice.

### Prompt 3 — General exploration

```text
I'm building out Hermanus, South Africa as a new destination in our portfolio. Need to understand the annual rhythm — what happens when, what's seasonal, where the gaps are.

There's a local event feed I've been pointed to: https://events-feed-hermanus.vercel.app/api/events (health check at /api/health, source info at /api/sources, full docs at /api/schema). Events endpoint takes `from`/`to`, `categories`, `suitable_for`, and `sort` params.

Can you pull everything from the feed and give me a month-by-month picture? I want to know when to send couples, when to send families, and when the town's quiet.
```

**What this tests:** Claude explores the full API (health, sources, events), understands seasonal vs recurring vs point events, and synthesises a year-round overview. Shows the API is genuinely agent-friendly — a model can self-discover and use it without hand-holding.

---

## Full Technical Verification

For systematic endpoint-by-endpoint testing, use the structured test prompts in the [testing guide](testing-guide.md#testing-with-claude--codex) or the admin panel's E2E test runner:

1. Go to [events-feed-hermanus.vercel.app/admin](https://events-feed-hermanus.vercel.app/admin)
2. Click the **E2E Tests** tab
3. Click **Run All** — runs 19 checks including CRUD lifecycle, manual submission, review agent, and error handling

The E2E runner executes all HTTP methods (GET, POST, PUT, DELETE) from the browser and reports PASS/FAIL with actual values. This covers everything the Claude prompts above cannot test (write operations, exact HTTP status codes, version conflicts).

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

3. **Clickable location links** — Make event locations clickable (like the Website button), linking to Google Maps with the lat/lng coordinates from the location field.

4. **Map visualization** — Add a map view showing event locations geographically, so travellers can see what's near their accommodation at a glance.

5. **iCal/RSS output** — `/api/events.ics` and `/api/events.rss` for calendar subscriptions.
