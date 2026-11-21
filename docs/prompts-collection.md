# Prompts Collection — How I Built the Event Feed

This document captures the full prompt chain from initial research through to working code. It shows the process, not just the output — which prompts led to which design decisions, and how the solution evolved.

References to "recent projects" and "engineering templates" refer to other codebases I've built, whose patterns (skills, CLAUDE.md conventions, task management) were adapted for this project.

---

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

> Status: pending
> Executed: —
> Notes: —

### 4.2 — Database schema (Prompt 1.2)

> Status: pending
> Executed: —
> Notes: —

### 4.3 — Temporal overlap logic (Prompt 2.1)

> Status: pending
> Executed: —
> Notes: —

### 4.4 — Deduplication (Prompt 2.2)

> Status: pending
> Executed: —
> Notes: —

### 4.5 — Event API endpoints (Prompt 3.1)

> Status: pending
> Executed: —
> Notes: —

### 4.6 — Support endpoints (Prompt 3.2)

> Status: pending
> Executed: —
> Notes: —

### 4.7 — SerpAPI ingest agent (Prompt 4.1)

> Status: pending
> Executed: —
> Notes: —

### 4.8 — Quicket integration (Prompt 4.2)

> Status: pending
> Executed: —
> Notes: —

### 4.9 — Claude-powered scraper (Prompt 4.3)

> Status: pending
> Executed: —
> Notes: —

### 4.10 — Review agent (Prompt 4.4)

> Status: pending
> Executed: —
> Notes: —

### 4.11 — Seed data + hand-worked case tests (Prompts 5.1 + 5.2)

> Status: pending
> Executed: —
> Notes: —

### 4.12 — OpenAPI spec + health check (Prompts 6.1 + 6.2)

> Status: pending
> Executed: —
> Notes: —

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

---

## Appendix: Session Log Format

Each build prompt execution should be logged with:

- **Prompt number** (e.g. 4.1)
- **Status**: pending / in-progress / done / blocked
- **Executed**: timestamp
- **Notes**: what happened, any deviations from the plan, lessons learned
- **Tracer bullet result**: did the checkpoint pass?

This document is updated incrementally. When a prompt is executed in the build session, its status block is filled in.
