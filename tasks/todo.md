# Todo

Session checkpoint and progress tracker. Updated during implementation.

<!-- On resume: read this file to see where you left off. Pick up from the first unchecked item.
     Build prompts are in docs/build-prompts.md. Execute in order.
     After each prompt, update docs/prompts-collection.md Phase 4 status block. -->

## Phase 1: Project Setup

- [ ] Prompt 1.1 — Scaffold (Next.js 16, deps, config, directory structure)
- [ ] Prompt 1.2 — Database schema (Drizzle + Zod types)
- [ ] **Checkpoint:** DB connection works, schema pushes cleanly

## Phase 2: Core Logic

- [ ] Prompt 2.1 — Temporal overlap logic + tests
- [ ] Prompt 2.2 — Deduplication logic + tests
- [ ] **Checkpoint:** All temporal tests pass, dedup tests pass

## Phase 3: API

- [ ] Prompt 3.1 — Event endpoints (GET/POST/PUT/DELETE)
- [ ] Prompt 3.2 — Support endpoints (sources, ingest trigger, health, schema)
- [ ] **Checkpoint:** API returns correct results for hand-worked case queries using seed data

## Phase 4: Agents

- [ ] Prompt 4.1 — SerpAPI ingest agent
- [ ] Prompt 4.2 — Quicket integration (Apify scraper)
- [ ] Prompt 4.3 — Claude-powered scraper
- [ ] Prompt 4.4 — Review agent
- [ ] **Checkpoint:** First real SerpAPI ingest produces valid events with correct temporal types

## Phase 5: Seed and Test

- [ ] Prompt 5.1 — Seed data
- [ ] Prompt 5.2 — Hand-worked case tests
- [ ] **Checkpoint:** All hand-worked case tests pass end-to-end

## Phase 6: Polish

- [ ] Prompt 6.1 — OpenAPI spec
- [ ] Prompt 6.2 — Health check
- [ ] **Checkpoint:** /api/health returns valid data, /api/schema serves OpenAPI spec

## Final

- [ ] Run `/project:verify`
- [ ] Run `/project:security-check --quick`
- [ ] Update `tracking/time.md` with actual build times
- [ ] Update `tracking/cost.md` with actual API usage
- [ ] Update `docs/prompts-collection.md` Phase 4 — all status blocks filled
- [ ] Offer `/project:commit-plan`
