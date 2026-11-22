# CLAUDE.md

## Project: Hermanus Event Feed

A local event feed for Hermanus, South Africa. Collects events from multiple sources (APIs, scrapers, manual submission), normalises them into a unified temporal model, and serves them via an agent-friendly REST API so travel agents and AI trip-planning agents can answer: "What is on while my traveller is there?"

Next.js 16 (App Router) + TypeScript + Drizzle ORM + Neon PostgreSQL + Zod + Claude Haiku 5.5.

Built as a Magic Safari founding engineer homework project.

## Version Verification

Before writing code that uses a framework or library API, verify the current API against the latest official documentation. Web-search if unsure. Key areas to check:

- **Next.js App Router**: route handler signatures, middleware patterns, server components, `next.config` format
- **Drizzle ORM**: schema definition API, query builder, migration commands, JSON column handling
- **@neondatabase/serverless**: connection setup, transaction patterns, pooling
- **Zod**: schema definition, discriminated unions, `.transform()` / `.refine()` patterns

If a pattern from training data conflicts with current docs, prefer the docs. If a version in the Tech Stack table below is outdated, update it before proceeding.

## Code Style

Keep changes minimal and DRY. Follow best practices and adhere to the existing code style as closely as possible.
Refactor where appropriate to improve modularity and separation of concerns. Prefer extracting logic into well-named functions, types, configs, or subfiles rather than expanding existing files. Reuse existing types from shared type files wherever available instead of introducing duplicates.
Before asking questions, scan the codebase and understand the current flow. Only ask clarifying questions if the answer cannot be derived directly from the code.
Update existing files in place to support the required changes. "Make minimal changes to achieve desired outcome" is the rallying cry.
If changes can be refactored to a different component file, utility file, etc. do so and just call it inline the main file it needs to be utilised in for sake of separation.

## Workflow

- Enter plan mode for non-trivial tasks (3+ steps or architectural decisions). If something goes sideways, STOP and re-plan.
- After ANY correction from the user: update `tasks/lessons.md` with the pattern. Review lessons at session start.
- Never mark a task complete without proving it works. Run tests, check logs, demonstrate correctness.
- When given a bug report: just fix it autonomously. Zero context switching required from the user.
- Read `DESIGN.md` before writing any code. It contains the data model, API spec, principles, and open decisions.
- If code contradicts DESIGN.md, fix the code or update DESIGN.md first (and explain why).
- After any agent run (ingest, review), check the run report for anomalies before moving on.
- Run the hand-worked test cases (`tests/hand-worked-cases.test.ts`) after any change to temporal logic or API query logic.

## Task Management

- Plan to `tasks/todo.md` with checkable items. Track progress and mark items complete as you go.
- After corrections, capture lessons in `tasks/lessons.md`.
- On resume: read `tasks/todo.md` to see where you left off. Pick up from the first unchecked item.

## Build Tracking

- **Build prompts** are in `docs/build-prompts.md`. Execute them in order (Phase 1 → 6).
- After executing each build prompt, update the matching status block in `docs/prompts-collection.md` Phase 4 (set Status to done, add timestamp, record notes and tracer bullet results).
- After each phase, update `tracking/time.md` with actual build times and `tracking/cost.md` with actual API usage.
- At tracer bullet checkpoints (after Phase 2, 3, 4, 5): verify the checkpoint passes before moving on. If it fails, stop and fix.
- Before final submission: run `/project:verify` and `/project:security-check --quick`.

## Commits

- **Do NOT run `git commit`** — the user commits themselves.
- When asked to help with commits (or use `/project:commit-plan`): analyse staged/unstaged changes, group files into logical commit lots, and suggest commit messages. Present each lot with its files, message, and rationale.
- After completing a large task, always offer to run `/project:verify` before the user starts committing.

## Skills

Use the following skills from `.claude/skills/`:

**Core engineering:**
- `/project:implement` — Build features, fixes, and enhancements from briefs
- `/project:verify` — Audit implementation for correctness and rule compliance
- `/project:commit-plan` — Group changes into logical commits with messages
- `/project:pr` — Create a PR with structured description and security checklist
- `/project:log-fix` — Record fixes to the knowledge base, or search past fixes
- `/project:security-check` — OWASP Top 10 security audit

**Domain-specific:**
- `/project:ingest` — Run or build an event ingestion pipeline for a source
- `/project:review` — Re-verify existing events against their sources
- `/project:source-eval` — Evaluate a potential new data source

**Deployment:**
- `/project:deploy` — Staging → production deployment workflow

Workflow: fill `tasks/feature-brief.md` → implement → verify → commit-plan → pr. After debugging: log-fix → check lessons.md.

## Code Comments

- When changing code, update all related comments (doc comments, inline comments, annotations) to match the new implementation.
- Never leave stale comments that describe removed or changed behaviour.
- **TODO comments addressed to the team** (e.g., `// TODO: add ...`) are action items that should be implemented, not left as placeholders.

## Four Event Shapes — The Temporal Model

Every event has a `temporal` field with a `type` discriminator: `"point"`, `"range"`, `"recurring"`, `"seasonal"`.

- **Never** store temporal data as freeform strings.
- **Never** treat seasonal events (whale watching, June–November) as range events with fake dates.
- **Always** test overlap queries against all four types. If you add a query or filter, it must handle all four.
- When in doubt about temporal type, prefer `"point"` or `"range"` with lower confidence over `"recurring"` or `"seasonal"` with higher confidence.

## Confidence & Versioning

- Default `min_confidence` on API queries is 0.6. Low-confidence events exist in the DB but don't appear in default results.
- When an ingest agent isn't sure about extracted data, it must set `confidence` lower — never round up.
- When deduplication is uncertain, keep both events and flag for review. False merges are worse than duplicates.
- Every event mutation creates an `EventVersion` record with the diff and a full snapshot.
- Ingestion and review runs are logged with stats.

## Agent-Friendly API

- Every response follows `{ data, meta, errors }` structure.
- Pagination is mandatory. No unbounded responses. Default 20 items, max 100.
- Error responses include `{ code, message, suggestion, retryable }`.
- Pre-compute derived fields like `next_occurrence_in_range` for recurring events — don't make the consuming agent do recurrence math.

## API Design

- Follow RESTful conventions: resources as nouns, HTTP methods for actions, consistent error shapes.
- Use proper HTTP status codes: 200, 201, 400, 401, 404, 422, 500.
- Validate all input at the API boundary — don't trust client data.
- Use Zod schemas for request validation. Same schemas used for agent extraction output.

## Database

- **Indexes**: Add indexes for any field used in `WHERE`, `ORDER BY`, or `JOIN` clauses.
- **Migrations**: Always reversible. Test `down` before deploying `up`.
- **Transactions**: Use transactions for multi-table writes (e.g., event + version creation).
- **Connection pooling**: Neon serverless driver handles this — use `@neondatabase/serverless`.

## Security & Secrets

- API keys (SerpAPI, Apify, Anthropic) go in `.env.local`, never committed. SerpAPI covers Google Events + Eventbrite; Apify covers Facebook, TripAdvisor, Quicket.
- `.env.example` documents required keys with placeholder values.
- If you spot a key in source code, remove it immediately.
- Input validation at API boundary. Parameterised queries via Drizzle ORM. Never concatenate user input into SQL.
- Rate limiting on public endpoints. CORS restricted to known origins.

## Cost Consciousness

- Use Claude Haiku 5.5 for all extraction and review tasks ($0.10/M input, $0.50/M output). Sonnet/Opus only for design iteration, never in production code paths.
- Apify actor runs are the dominant cost (pay-per-result pricing varies by actor). Cache results. Don't re-run the same actor query within 24 hours. Monitor usage on the Apify dashboard to stay within budget.
- Track token usage per agent run. Log it in the ingestion/review run reports.

## Data Handling

- **Batch reads** — use bulk fetch patterns instead of individual reads when fetching multiple items.
- **Avoid N+1 queries** — if you need data for N items, fetch all at once, not in a loop.
- **Use `Set` for lookups** — O(1) contains checks instead of O(n) list scans.
- **Rate-limit expensive operations** — use de-dupe sets, cooldown timestamps, or flags to prevent duplicate operations and redundant writes.

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL (Neon) |
| ORM | Drizzle |
| AI (extraction) | Claude Haiku 5.5 |
| Validation | Zod |
| Event sources | SerpAPI (Google Events, Eventbrite) + Apify actors (Facebook, TripAdvisor, Quicket) + fetch + Claude |
| Deployment | Vercel ([live](https://events-feed-hermanus.vercel.app)) |

## Project Structure

```
events-feed-hermanus/
├── README.md                    # Repo front door — table of contents for reviewers
├── CLAUDE.md                    # This file
├── DESIGN.md                    # Design write-up (the main deliverable)
├── .claude/
│   ├── WORKFLOW.md              # Skill quick reference
│   ├── settings.json            # Shared permissions
│   ├── rules/
│   │   └── backend.md           # Backend/API rules
│   └── skills/
│       ├── implement/SKILL.md   # Build features from briefs
│       ├── verify/SKILL.md      # Audit implementation
│       ├── commit-plan/SKILL.md # Group changes into commits
│       ├── log-fix/SKILL.md     # Record fixes to knowledge base
│       ├── security-check/SKILL.md # OWASP audit
│       ├── deploy/SKILL.md      # Deployment workflow
│       ├── ingest/SKILL.md      # Event ingestion skill
│       ├── review/SKILL.md      # Event review/verification skill
│       └── source-eval/SKILL.md # Source evaluation skill
├── tasks/
│   ├── todo.md                  # Session checkpoint / progress tracker
│   ├── lessons.md               # Accumulated patterns and lessons
│   ├── feature-brief.md         # Active feature brief (input for /implement)
│   ├── fixes/                   # Fixes knowledge base (managed by /log-fix)
│   │   └── INDEX.md
│   └── workflows/               # Workflow documentation
├── tracking/
│   ├── time.md                  # Time tracking
│   └── cost.md                  # Cost tracking (models, API calls)
├── docs/
│   ├── pen-and-paper/           # Photos of handwritten notes
│   ├── build-prompts.md         # Build prompts (12 sequential, execute in order)
│   ├── prompts-collection.md    # Full prompt chain + build progress log
│   └── references.md            # Web research references
├── src/
│   ├── app/api/
│   │   ├── events/              # Event CRUD endpoints
│   │   ├── sources/             # Source management
│   │   ├── ingest/              # Trigger ingestion runs
│   │   ├── health/              # Health check
│   │   └── schema/              # OpenAPI spec
│   ├── db/
│   │   ├── schema.ts            # Drizzle schema (matches DESIGN.md data model)
│   │   ├── migrations/          # SQL migrations
│   │   └── seed.ts              # Seed data for testing
│   ├── lib/
│   │   ├── temporal.ts          # Overlap query logic (critical — most tests here)
│   │   ├── dedup.ts             # Fuzzy deduplication
│   │   ├── relevance.ts         # Relevance scoring
│   │   └── sources/
│   │       ├── serpapi.ts          # Shared SerpAPI client and utilities
│   │       ├── apify.ts           # Shared Apify client and utilities
│   │       ├── google-events.ts   # Google Events adapter (SerpAPI google_events engine)
│   │       ├── facebook.ts        # Facebook Events adapter (Apify apify/facebook-events-scraper)
│   │       ├── eventbrite.ts      # Eventbrite adapter (SerpAPI eventbrite engine)
│   │       ├── tripadvisor.ts     # TripAdvisor adapter (Apify maxcopell/tripadvisor)
│   │       ├── quicket.ts         # Quicket adapter (Apify scraper)
│   │       ├── scraper.ts         # Generic Claude-powered scraper
│   │       └── manual.ts          # Manual submission handler
│   ├── agents/
│   │   ├── ingest.ts            # Ingest agent (fetch → extract → normalise → store)
│   │   ├── review.ts            # Review agent (re-verify existing events)
│   │   └── relevance.ts         # Relevance scoring agent
│   └── types/
│       ├── event.ts             # Event, Temporal, Location, Source types
│       └── api.ts               # API request/response types
└── tests/
    ├── temporal.test.ts         # Overlap logic — the most critical tests
    ├── dedup.test.ts            # Deduplication tests
    ├── api.test.ts              # API endpoint tests
    └── hand-worked-cases.test.ts # Cases from DESIGN.md "How it's checked"
```

## Key Files to Read First

1. `DESIGN.md` — the full design. Read this before anything else.
2. `src/lib/temporal.ts` — overlap query logic. The hardest code in the project.
3. `src/db/schema.ts` — the database schema. Must match DESIGN.md data model exactly.
4. `src/agents/ingest.ts` — the ingestion pipeline. Where raw data becomes normalised events.

## Running Locally

```bash
# Install
pnpm install

# Set up env
cp .env.example .env.local
# Fill in: DATABASE_URL, ANTHROPIC_API_KEY, SERPAPI_API_KEY, APIFY_API_KEY

# DB setup
pnpm drizzle-kit push

# Seed test data
pnpm tsx src/db/seed.ts

# Dev server
pnpm dev

# Tests
pnpm test
```

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.
- **No Dead Code**: Do not leave unused code behind after a change. Remove obsolete branches, flags, helpers, configs, and imports created by the change.
