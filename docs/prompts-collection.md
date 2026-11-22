# Prompts Collection — How I Built the Event Feed

This document captures the full prompt chain from initial research through to working code. It shows the process, not just the output — which prompts led to which design decisions, and how the solution evolved.

References to "recent projects" and "engineering templates" refer to other codebases I've built, whose patterns (skills, CLAUDE.md conventions, task management) were adapted for this project.

---

> **Historical note (Nov 2026):** The prompts below reference SerpAPI as the initial Google Events data source. During build, we briefly migrated to all-Apify actors, then restored SerpAPI when Apify's Google Events and Eventbrite actors returned sparse/empty results for Hermanus. Final architecture is a **hybrid**: SerpAPI for Google Events + Eventbrite (reliable structured search); Apify actors for Facebook, TripAdvisor, and Quicket (social media scraping). Both `SERPAPI_API_KEY` and `APIFY_API_KEY` are required. The prompts are preserved as-is for process documentation.

## Phase 1: Research and Context Gathering

### 1.1 — Read the spec and handbook

```
Read the homework PDF (docs/homework/Magic Safari homework - Event Feed.pdf). Then read the Magic Safari handbook at magicsafari.com/handbook/,
especially AI & automation, how we prioritise, how we communicate, and our tech stack.

Extract: what they value in an engineer, what anti-patterns they watch for, and any
tech stack constraints that should shape this project.
```

**What it produced:** Understanding that process > output, the three anti-patterns to avoid (meat proxy, Dunning-Kruger on AI, not diving into details), and that they value boring tech, clear writing, and tracer bullets.

### 1.2 — Research Hermanus event sources

```
Search for event sources specific to Hermanus, South Africa. I need to know:
- What APIs exist (SerpAPI Google Events, Quicket, etc.)
- What local tourism sites list events (hermanus.co.za, ShowMe, etc.)
- What the Facebook Events situation is in SA (API restrictions)
- How sparse the digital event data is for a town of ~91K people (broader urban area)

Also search GitHub for existing event feed / event aggregation projects
(Next.js, Claude extraction, multi-source). I need prior art references.
```

**What it produced:** 8 ranked sources, the honest gap analysis (Facebook Events restricted since 2019), discovery that Hermanus data is sparser than expected (3-5 SerpAPI results vs 20+ for Cape Town), and 7 GitHub reference projects.

### 1.3 — Research temporal modelling and agent-friendly APIs

```
Search for how to model recurring events, seasonal events, and date ranges
in a single data model. Check schema.org/Event, schema.org/Schedule, and
Martin Fowler's recurring events pattern.

Also search for agent-friendly API design patterns — how to build APIs that
Claude/Codex can consume efficiently (structured output, token-aware responses,
self-describing schemas).
```

**What it produced:** The four temporal types (point, range, recurring, seasonal) as the core design decision. Schema.org Event/Schedule for vocabulary. 6 agent-friendly API pattern references.

---

## Phase 2: Design (Pen-and-Paper + DESIGN.md)

### 2.1 — Pen-and-paper sketches

_Done physically — 6 pages:_

1. The problem + primary query ("what is on while my traveller is there?")
2. Data model — Event entity + four temporal types
3. Overlap query logic + hand-worked Case 1 (Sep 14-21 traveller)
4. System architecture + three agents (ingest, review, relevance)
5. Source priority ranking + data gaps (the honest assessment)
6. Quality model — confidence scoring + versioning + API shape

_Photos in `docs/pen-and-paper/`_

### 2.2 — Design write-up

```
Read my pen-and-paper notes [photos attached]. Write a comprehensive DESIGN.md
following the homework spec's skeleton:

- Summary of the plan
- Data model (the four temporal types are the core design decision)
- API design (agent-friendly, structured responses)
- Agent architecture (ingest, review, relevance — 3 agents with single jobs)
- 3-5 principles (each with rule + what you accept by choosing it)
- Open decisions (recommendation + worked example under both options)
- Hand-worked cases (4 cases with expected results)
- Execution plan (steps sized by risk and impact)
- Tech stack justification
- Cost estimate

The key insight: events have four different temporal shapes, and the primary
query is "what overlaps with these travel dates?" — that's what the whole
system serves.
```

**What it produced:** DESIGN.md — the main deliverable. 480 lines covering every section from the spec's skeleton.

### 2.3 — Hand-worked test cases

```
Work through 4 specific cases by hand against the data model:

1. Luxury couple, 14-21 Sep 2027 — whale watching YES, market YES (Sat 20th),
   whale festival NO (27-28 Sep outside range), FynArts NO (June)
2. Family, June 2027 — whale watching YES, FynArts YES, market YES (4 Saturdays)
3. Dedup: "FynArts Festival Hermanus 2027" vs "Hermanus FynArts 2027" — merge
4. Cancelled event: source page returns 404, confidence drops, eventually tentative

For each case, work out the expected API response and verify the overlap
logic handles all four temporal types correctly.
```

**What it produced:** The 4 hand-worked cases in DESIGN.md. These became the acceptance tests.

---

## Phase 3: Agent Setup (CLAUDE.md + Skills)

### 3.1 — Project CLAUDE.md

```
Create CLAUDE.md for this project. It should include:
- Project description and tech stack (Next.js 16, TypeScript, Drizzle, Neon, Zod, Haiku 5.5)
- Code style rules (minimal, DRY, separation of concerns)
- Workflow rules (plan mode, lessons tracking, bug autonomy)
- The four temporal types as standing orders (never store as strings, never fake seasonal dates)
- Confidence and versioning rules
- Agent-friendly API rules
- Full project structure

Reference patterns from my recent projects — the skill system, task management
(todo.md, lessons.md, feature briefs, fixes knowledge base), session resumability.
```

**What it produced:** CLAUDE.md — 246 lines of project-specific standing orders.

### 3.2 — Engineering skills

```
Create 6 core engineering skills adapted for this project:
- implement (plan → build → verify)
- verify (audit for correctness + CLAUDE.md compliance)
- commit-plan (group changes into logical commits — does NOT commit)
- log-fix (record fixes to knowledge base)
- security-check (OWASP audit for Next.js + PostgreSQL)
- deploy (Vercel staging → production)

Plus 3 domain skills:
- ingest (event ingestion pipeline)
- review (re-verify events against sources)
- source-eval (evaluate potential new sources)

Each skill needs YAML frontmatter, specific steps, and tracer bullets.
```

**What it produced:** 9 skills in `.claude/skills/`, plus WORKFLOW.md and settings.json.

### 3.3 — Build prompts

```
Create 12 sequential build prompts that will take the project from scaffold
to working code. Each prompt should reference DESIGN.md and CLAUDE.md so
Claude works from the plan. Order by the execution plan in DESIGN.md:

Phase 1: Scaffold + DB schema
Phase 2: Temporal overlap logic + dedup (highest risk — most tests here)
Phase 3: API endpoints
Phase 4: Agents (SerpAPI ingest, Quicket, scraper, review)
Phase 5: Seed data + hand-worked case tests
Phase 6: OpenAPI spec + health check

Include tracer bullet checkpoints after each phase.
```

**What it produced:** `docs/build-prompts.md` — 12 prompts with running order and verification checkpoints.

---

## Phase 4: Build

_Prompts executed in a Claude Code session within the events-feed-hermanus codebase._

**Opening prompt (kicks off the build):**

```text
Read tasks/todo.md and start building. Execute the build prompts
from docs/build-prompts.md in order, starting from the first
unchecked item. Follow the Build Tracking rules in CLAUDE.md.
```

Claude reads CLAUDE.md automatically, picks up the todo, reads each build prompt from the file, executes it, checks it off, and updates the status blocks below.

### 4.1 — Scaffold (Prompt 1.1)

> Status: done
> Executed: 2026-11-21
> Notes: Next.js 16.4.6, pnpm, Drizzle 0.45.4, Zod 4.6.7, vitest 5.1.1. All npm references across docs/skills updated to pnpm. Build succeeds.

### 4.2 — Database schema (Prompt 1.2)

> Status: done
> Executed: 2026-11-21
> Notes: Drizzle schema (events, event_versions, sources, ingest_runs) + Zod 4 types (TemporalSchema discriminated union, EventSchema, CreateEventSchema, UpdateEventSchema, API helpers). All schemas validated at runtime.

### 4.3 — Temporal overlap logic (Prompt 2.1)

> Status: done
> Executed: 2026-11-21
> Notes: All 4 temporal types implemented (point, range, recurring, seasonal) + multi-date support. 34 tests covering hand-worked cases and edge cases. Tracer bullet: all temporal tests pass.

### 4.4 — Deduplication (Prompt 2.2)

> Status: done
> Executed: 2026-11-21
> Notes: Levenshtein + Dice coefficient (token-level). Handles word reordering across sources. 16 tests including DESIGN.md Case 3 (FynArts cross-source merge). Tracer bullet: all dedup tests pass.

### 4.5 — Event API endpoints (Prompt 3.1)

> Status: done
> Executed: 2026-11-21
> Notes: GET/POST events, GET/PUT/DELETE events/:id, GET events/:id/versions. All routes follow { data, meta, errors } shape. Optimistic concurrency on PUT. Soft delete on DELETE. Build passes clean.

### 4.6 — Support endpoints (Prompt 3.2)

> Status: done
> Executed: 2026-11-21
> Notes: GET /api/sources, POST /api/ingest, GET /api/ingest/runs, GET /api/health (full stats), GET /api/schema (placeholder). 8 total API routes, all build successfully.

### 4.7 — SerpAPI ingest agent (Prompt 4.1) _(later replaced — see historical note)_

> Status: done
> Executed: 2026-11-21
> Notes: Originally built with SerpAPI adapter + pagination. Briefly replaced with Apify actors, then restored to hybrid: SerpAPI for Google Events + Eventbrite (reliable Hermanus results), Apify for Facebook + TripAdvisor + Quicket (social/scraping sources). Full ingest pipeline unchanged: Claude Haiku extraction → Zod validation → dedup → create/update with EventVersion. Run report with token/cost tracking.

### 4.8 — Quicket integration (Prompt 4.2)

> Status: done
> Executed: 2026-11-21
> Notes: Apify SA Events Scraper adapter. Fetches latest dataset or triggers new run. Filters for Hermanus/Western Cape events.

### 4.9 — Claude-powered scraper (Prompt 4.3)

> Status: done
> Executed: 2026-11-21
> Notes: Generic scraper: fetch URL → Claude Haiku extraction → structured events. 100K char truncation. Manual submission handler also added.

### 4.10 — Review agent (Prompt 4.4)

> Status: done
> Executed: 2026-11-21
> Notes: Review agent with 3 scopes (upcoming/low-confidence/all). Re-fetches source URLs, verifies via Claude Haiku, handles source-gone/cancelled/changed scenarios. Relevance agent (rule-based) also added.

### 4.11 — Seed data + hand-worked case tests (Prompts 5.1 + 5.2)

> Status: done
> Executed: 2026-11-21
> Notes: Seed script populates 4 sources + 7 events (all 4 temporal types). Test factories in tests/helpers/factories.ts. Hand-worked case tests (36 tests) verify Cases 1-4 from DESIGN.md: temporal overlap, query filtering, dedup, cancelled event handling. Tracer bullet: 86/86 tests pass.

### 4.12 — OpenAPI spec + health check (Prompts 6.1 + 6.2)

> Status: done
> Executed: 2026-11-21
> Notes: Full OpenAPI 3.1 spec at GET /api/schema covering all 9 endpoints with complete component schemas (Event, Temporal discriminated union, Location, Recurrence, Links, Source, IngestRun, EventVersion, HealthStatus). Health check already implemented in Phase 3 — verified against Prompt 6.2 requirements.

---

## Phase 5: Iterate and Verify

_Captured during the build session._

### Corrections and lessons

**Pre-build verification (21 Nov 2026):** Before starting the build, a full audit of all project files caught 15+ stale or incorrect claims that had propagated from early design drafts:

- Model naming: Haiku 4.5 → Haiku 5.5 (released Oct 2026, 90% cheaper)
- Pricing: $0.80/M input → $0.10/M input (cascaded into all cost estimates)
- Framework: Next.js 15 (EOL Oct 2026) → Next.js 16 (current LTS)
- Population: ~35K → ~91K (broader urban area, 2026 estimate)
- SerpAPI free tier: 100 → 250 searches/month (made v1 production free)
- Quicket: referenced non-existent public API → Apify scraper workaround
- Cheerio: referenced but not used → fetch + Claude is the actual approach
- SerpAPI cost: $0.20/week → $0/week (free tier covers Hermanus)

**Lesson:** Every factual claim must be verified against current sources before finalising. One wrong number cascades. See `tasks/lessons.md` → [Verify All Claims].

_Further corrections appended during the build:_

- **[Haiku 5.5 thinking blocks]:** `response.content[0]` returns a `thinking` block, not `text`. All 3 extraction/review paths used `content[0]` and silently got empty strings. Fix: `response.content.find(b => b.type === "text")`. Caught during live testing, not unit tests.
- **[Eventbrite titles lie about location]:** "in Cape Town, South Africa" in the title, but venue is Arabella Hotel in the Hermanus/Kleinmond area. Trust GPS coordinates over titles for location filtering.
- **[Facebook rate-limited]:** `apify/facebook-events-scraper` hit Facebook's anonymous rate limits on 11/11 retries (Nov 2026). Kept adapter in place but expect frequent failures.
- **20 total lessons** accumulated in `tasks/lessons.md` — real production patterns, not theoretical.

---

## Phase 6: Frontend Build (Beyond Scope)

_The homework spec asked for a design write-up + working code. Building a frontend was not required but makes the demo tangible and proves the system end-to-end._

### 6.1 — Frontend planning (plan mode)

```text
Build a frontend for the Hermanus Event Feed. Three pages:
1. / — Events feed with filter bar, event cards, pagination
2. /events/[id] — Event detail with version history, edit/delete
3. /admin — Admin panel with health overview, ingest/review triggers, E2E test runner

Style to match Magic Safari brand (deep-forest, vibrant-leaf, fresh-mint,
whisper-green, soft-sage, warm-bg). Crimson Text headings, Montserrat body.
Tailwind CSS v4.

No extra deps beyond Tailwind. URL-based filter state via useSearchParams.
Server components for read-only views, client components for interactive.
```

**What it produced:** Plan with 20 implementation steps, brand token table, component inventory (15+ components), page designs. User approved before any code was written.

> Status: done
> Executed: 2026-11-22
> Notes: Plan mode → user approval → build. This is the directed workflow: human reviews architecture before Claude writes code.

### 6.2 — Foundation + UI primitives

> Status: done
> Executed: 2026-11-22
> Notes: Tailwind v4 CSS-first config (no tailwind.config.ts), Crimson Text + Montserrat via next/font/google, 7 UI primitives (temporal-badge, confidence-meter, status-indicator, pagination-controls, loading-spinner, modal, button). Navbar with active state.

### 6.3 — Events feed (/) + event detail (/events/[id])

> Status: done
> Executed: 2026-11-22
> Notes: Filter bar (date range, categories, suitable_for, sort), event card grid with temporal badges, pagination. Event detail with full fields, version timeline, inline edit form with optimistic concurrency, delete with confirmation modal.

### 6.4 — Admin panel (/admin)

> Status: done
> Executed: 2026-11-22
> Notes: 4 tabs: Health Overview (source cards, event stats), Ingest Panel (source picker + trigger + run history with auto-refresh), Review Panel (scope picker + trigger + results), E2E Test Runner (19 sequential checks exercising all 13 API endpoints live). The E2E runner is the crown jewel — it proves the system works, not just that it compiles.

### 6.5 — Natural language date picker + season resolution

> Status: done
> Executed: 2026-11-22
> Notes: Added chrono-node (NL date parsing), react-day-picker v10 (calendar), @radix-ui/react-popover (dropdown). Built `NaturalDatePicker` component: text input with live chrono-node parsing, calendar popover, season name detection. Built `season-dates.ts`: 6 Southern Hemisphere season definitions (summer Dec–Feb cross-year, autumn Mar–May, winter Jun–Aug, spring Sep–Nov, whale season Jun–Nov, festival season Sep–Oct). Features: forward-looking resolution, `notBefore` constraint (To picker respects From date), prefix overrides ("start of", "end of", "early", "late", "beginning of"), noon boundary normalization. Quick presets in filter bar for hand-worked test cases. 50 season-dates tests. Build: 0 errors. Tests: 175/175.

---

## Phase 7: Verification & Hardening

_Running /verify after the frontend build caught 20 issues across 4 severity levels. This is the iterative quality cycle that separates directed AI usage from "run Claude and ship."_

### 7.1 — /verify audit

```text
Run /project:verify on the full codebase.
```

**What it produced:** 20 findings:
- 3 must-fix: security vulnerability (unbounded LLM output in DB writes), stale date in serverless (module-level Date()), non-JSON crash in api-client
- 8 should-fix: dead code (unused imports), cost calculation errors, full table scan in dedup, accessibility gaps (modal has no Escape/ARIA)
- 3 doc fixes: stale historical notes, wrong field names in testing guide
- 6 info-level: minor style issues

> Status: done
> Executed: 2026-11-22
> Notes: The security finding (review agent spreading raw Claude output into DB .set()) would have been a real vulnerability in production. Caught by systematic audit, not by accident.

### 7.2 — Apply all fixes + regression test

```text
Fix all must-fix, should-fix, and doc-fix issues from the /verify audit.
Run build + full test suite after to confirm no regressions.
```

**What it produced:** 14 fixes applied across security (LLM output whitelist), correctness (cost calc, stale date, non-JSON crash), DRY (shared `extractJson`), accessibility (modal ARIA + Escape), dead code removal, and doc corrections. Build: 0 errors. Tests: 125/125 pass (later 175/175 after Phase 6.5 season-dates tests).

> Status: done
> Executed: 2026-11-22
> Notes: Regression verified — all fixes confirmed correct, no test failures, no build errors.

### 7.3 — Re-verify

```text
Run /project:verify again after fixes to confirm clean state.
```

> Status: done
> Executed: 2026-11-22
> Notes: All clear — no TODOs, no stale model IDs, no content[0] patterns, no duplicate functions, all API routes use helpers, .env.example correct.

---

## Phase 8: Documentation Updates

_Updating tracking docs, prompts collection, and talking points to reflect the full build scope including frontend and verification phases._

### 8.1 — Time, cost, and process docs

> Status: done
> Executed: 2026-11-22
> Notes: Updated tracking/time.md (full commit timeline + active time analysis), tracking/cost.md (frontend session), docs/prompts-collection.md (Phases 6-8), docs/talking-points.md (frontend + verification evidence).

---

## Appendix: Session Log Format

Each build prompt execution should be logged with:

- **Prompt number** (e.g. 4.1)
- **Status**: pending / in-progress / done / blocked
- **Executed**: timestamp
- **Notes**: what happened, any deviations from the plan, lessons learned
- **Tracer bullet result**: did the checkpoint pass?

This document is updated incrementally. When a prompt is executed in the build session, its status block is filled in.
