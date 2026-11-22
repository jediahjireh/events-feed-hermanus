# Todo

Session checkpoint and progress tracker. Updated during implementation.

<!-- On resume: read this file to see where you left off. Pick up from the first unchecked item.
     Build prompts are in docs/build-prompts.md. Execute in order.
     After each prompt, update docs/prompts-collection.md Phase 4 status block. -->

## Phase 1: Project Setup

- [x] Prompt 1.1 — Scaffold (Next.js 16, deps, config, directory structure)
- [x] Prompt 1.2 — Database schema (Drizzle + Zod types)
- [x] **Checkpoint:** DB connection works, schema pushes cleanly

## Phase 2: Core Logic

- [x] Prompt 2.1 — Temporal overlap logic + tests (34 tests)
- [x] Prompt 2.2 — Deduplication logic + tests (16 tests)
- [x] **Checkpoint:** All temporal tests pass, dedup tests pass (50/50)

## Phase 3: API

- [x] Prompt 3.1 — Event endpoints (GET/POST/PUT/DELETE)
- [x] Prompt 3.2 — Support endpoints (sources, ingest trigger, health, schema)
- [x] **Checkpoint:** API returns correct results, 9 routes build clean

## Phase 4: Agents

- [x] Prompt 4.1 — SerpAPI (Google Events, Eventbrite) + Apify (Facebook, TripAdvisor)
- [x] Prompt 4.2 — Quicket integration (Apify scraper)
- [x] Prompt 4.3 — Claude-powered scraper
- [x] Prompt 4.4 — Review agent
- [x] **Checkpoint:** Agent pipeline complete with extraction, dedup, versioning
- [x] Migrate to hybrid sources: SerpAPI (Google Events, Eventbrite) + Apify (Facebook, TripAdvisor, Quicket)
- [x] Clean stale references from code, config, and docs

## Phase 5: Seed and Test

- [x] Prompt 5.1 — Seed data (7 sources, 8 events, all 4 temporal types)
- [x] Prompt 5.2 — Hand-worked case tests (36 tests, Cases 1-4 from DESIGN.md)
- [x] **Checkpoint:** All hand-worked case tests pass (86/86 total)

## Phase 6: Polish

- [x] Prompt 6.1 — OpenAPI spec (full 3.1 spec at /api/schema)
- [x] Prompt 6.2 — Health check (verified against requirements)
- [x] **Checkpoint:** /api/health returns valid data, /api/schema serves OpenAPI spec

## Phase 7: Frontend (Beyond Scope)

- [x] Plan frontend architecture (plan mode → user approval)
- [x] Foundation: Tailwind v4, brand tokens, fonts, navbar
- [x] UI primitives: temporal-badge, confidence-meter, status-indicator, pagination, modal, button
- [x] Events feed page (`/`) — filter bar, card grid, pagination
- [x] Event detail page (`/events/[id]`) — full display, version timeline, edit form, delete
- [x] Admin panel (`/admin`) — health overview, ingest panel, review panel, E2E test runner
- [x] **Checkpoint:** `pnpm build` 0 errors, 14 routes, 3 pages render correctly

## Phase 8: Verification & Hardening

- [x] Run `/project:verify` — 20 findings (3 must-fix, 8 should-fix, 3 doc fixes)
- [x] Fix all 14 code/doc issues (security whitelist, stale date, non-JSON crash, dead code, accessibility, cost calc, docs)
- [x] Regression test — 184/184 tests pass, `pnpm build` 0 errors
- [x] Re-verify — all clear
- [x] **Checkpoint:** Clean codebase, no regressions

## Phase 9: Natural Language Date Picker + Season Resolution

- [x] Add chrono-node + react-day-picker + @radix-ui/react-popover
- [x] Build `NaturalDatePicker` component (text input + calendar + chrono-node parsing)
- [x] Wire into `FilterBar` with `role="start"`/`role="end"` and `minDate`/`maxDate` constraints
- [x] Build `season-dates.ts` — Southern Hemisphere seasons (6 definitions, cross-year summer handling)
- [x] Add `notBefore` constraint for From→To picker interaction
- [x] Add prefix overrides ("start of", "end of", "early", "late", "beginning of")
- [x] Fix noon boundary bug (time-of-day sensitivity in season date comparisons)
- [x] Fix season hint persistence (useEffect overwriting season label)
- [x] Add quick presets for hand-worked test cases
- [x] 50 season-dates tests (findSeason, trySeasonParse, cross-year, notBefore, prefixes, noon normalization)
- [x] **Checkpoint:** `pnpm build` 0 errors, 184/184 tests pass

## Phase 10: Production Data Quality Fixes

- [x] Health endpoint stale data — add `Cache-Control: no-store, no-cache, must-revalidate` headers
- [x] Past event detection — add `markPastEvents()` to daily cron (point, range, recurring; skip seasonal)
- [x] Extraction prompt — enforce categories + suitable_for (never empty), extract event website URLs
- [x] Dedup merge — `updateExistingEvent` now merges categories, suitable_for, links (union, not replace)
- [x] Version records — `markPastEvents` creates EventVersion per DESIGN.md contract
- [x] Revert setTimeout stagger — broken on Vercel serverless, back to immediate fire-and-forget
- [x] Add 2 new lessons (#19, #20): serverless setTimeout, version record contract
- [x] **Checkpoint:** `pnpm build` 0 errors, 184/184 tests pass

## Final

- [x] Run `/project:verify` — PASS (backend, pre-frontend)
- [x] Run `/project:security-check --quick` — PASS (1 moderate dep vuln: esbuild via drizzle-kit, dev-only)
- [x] Update `tracking/time.md` with full timeline + active time analysis
- [x] Update `tracking/cost.md` with frontend session
- [x] Update `docs/prompts-collection.md` — all 8 phases with status blocks
- [x] Update `docs/talking-points.md` — frontend, verification, human-AI collaboration evidence
- [x] Offer `/project:commit-plan`
