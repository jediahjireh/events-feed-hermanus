# Time Tracking

Target: 1–2 hours personal time (per spec). Actual: ~2h 40min across three sessions — went beyond scope to build frontend, admin panel, E2E test runner, and a full verification/fix cycle. The design + backend (the core deliverable) was ~1h 55min.

## Commit Timeline

```
21 Nov 20:45  design: init (research + pen-and-paper + DESIGN.md)
              — break: stepped away, came back later to start coding —
22 Nov 00:25  chore: scaffold project
       00:29  feat: type system + drizzle db schema
       00:29  feat: temporal overlap logic + utilities
       00:31  feat: apify source adapters
       00:31  feat: ingest, review + relevance agents
       00:32  feat: REST api endpoints + app shell
       00:32  feat: seed script with hand-worked test data
       00:32  test: temporal, dedup + hand-worked case tests
       00:33  docs: update project docs
              — 27 min: deployment, production verification —
       01:00  docs: add prod url + dual testing guidance
              — 22 min: wire agents to API, write agent unit tests —
       01:22  feat: wire review + relevance agents, add agent unit tests
              — 40 min: cron scheduling, extract pipeline module, OpenAPI —
       02:02  feat: vercel cron + ingest pipeline + openapi modules
       02:03  perf: harden api routes
              — session 3: frontend build, verification, fixes (not yet committed) —
```

The 00:25–00:33 batch (9 commits in 8 min) was code built in the prior session and batch-committed. Active build span: ~1h 38min (00:25–02:03).

## Log

| Phase                                  | Activity                                                                                                       | Personal time | Notes                                                               |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------- |
| **Session 1: Research + Design**       |                                                                                                                |               |                                                                     |
| Research                               | Read homework spec, handbook, AI & automation page                                                             | 10 min        | First-principles understanding before touching tools                |
| Research                               | Evaluate Hermanus event sources (Apify actors, Quicket, local sites)                                           | 5 min         | Agent ran parallel web research                                     |
| Research                               | Study schema.org Event/Schedule types, agent-friendly API patterns                                             | 5 min         | Web searches for temporal modelling patterns                        |
| Design                                 | Pen-and-paper notes (6 pages: problem, data model, overlap logic, architecture, sources + gaps, quality model) | 15 min        | Photos in docs/pen-and-paper/ — pure human work                     |
| Design                                 | Write DESIGN.md (data model, API, principles, open decisions, hand-worked cases)                               | 20 min        | Most important deliverable — directed Claude, verified every claim  |
| Setup                                  | Create CLAUDE.md, skills, project structure                                                                    | 15 min        | Reviewed template bundle, adapted 9 skills, build prompts, tasks    |
|                                        | **Session 1 subtotal**                                                                                         | **~1h 10min** |                                                                     |
| **Session 2: Backend Build**           |                                                                                                                |               |                                                                     |
| Build                                  | DB schema, temporal logic, source adapters, API routes, agents, seed data                                      | 15 min        | Claude builds from DESIGN.md; I verify critical paths               |
| Test                                   | Run hand-worked cases, verify overlap logic, deploy to Vercel                                                  | 15 min        | Tracer bullets on temporal.ts, production smoke test                |
| Iterate                                | Wire agents to API, add unit tests, cron scheduling, harden routes                                             | 15 min        | 894c5b0–6338ef4: post-deploy hardening pass                         |
|                                        | **Session 2 subtotal**                                                                                         | **~45min**    |                                                                     |
| **Session 3: Frontend + Verification** |                                                                                                                |               |                                                                     |
| Plan                                   | Frontend architecture: pages, components, brand tokens, state management                                       | 5 min         | Plan mode → user approval before any code                           |
| Build                                  | 15+ components, 3 pages (feed, detail, admin), Tailwind v4, responsive                                        | 10 min        | Directed component architecture, reviewed each page                 |
| Build                                  | Admin panel: health overview, ingest/review triggers, E2E test runner (19 checks)                              | 10 min        | E2E runner exercises all 13 API endpoints live                      |
| Verify                                 | Run /verify audit — found 20 issues across 4 severity levels                                                   | 5 min         | 3 must-fix (security, stale date, crash), 8 should-fix, 3 doc fixes |
| Fix                                    | Apply all 14 code/doc fixes, regression test (125/125 pass, 0 build errors)                                    | 10 min        | Reviewed each fix for correctness, ran deep verification            |
| Docs                                   | Update time/cost tracking, prompts-collection, talking points                                                  | 5 min         | This entry — demonstrating process, not just output                 |
|                                        | **Session 3 subtotal**                                                                                         | **~45min**    |                                                                     |
|                                        |                                                                                                                |               |                                                                     |
|                                        | **Grand total**                                                                                                | **~2h 40min** |                                                                     |

## Where the time went

**Session 1 — Research + design: ~1h 10min** — Intentional. The spec says the design write-up matters most. Understanding Hermanus's event landscape (small town, sparse digital data, Facebook-dominant, Quicket for ticketing) shaped every decision. The temporal model was worked out on paper before any code. The agent setup took ~15 min reviewing and adapting an existing template bundle (CLAUDE.md patterns, skill templates, workflow configurations) for this project. Stepped away after committing the design, came back fresh for the build.

**Session 2 — Backend build: ~45 min** — Claude built from the DESIGN.md plan. My time was verifying temporal overlap logic, spot-checking agent extraction, testing deployment, and directing the post-deploy hardening pass (agent wiring, cron, API validation).

**Session 3 — Frontend + verification: ~45min** — This was beyond the minimum deliverable. The homework spec asked for a design + working code, not a UI. I built the frontend because:

1. It makes the demo tangible — a reviewer can see the feed, not just curl the API
2. The admin panel (ingest/review triggers, E2E test runner) proves the system works end-to-end
3. The /verify audit caught a real security issue (unbounded LLM output in DB writes) — worth the extra time

**The verification cycle is the key differentiator.** Running /verify → reviewing 20 findings → fixing 14 issues → re-verifying → confirming 125/125 tests pass. This is the opposite of "run Claude and ship" — it's iterative quality engineering with human judgement at every decision point.

## What "active time" means

- **Reading and directing**: reviewing Claude's output, correcting course, choosing between approaches
- **Design decisions**: which temporal model, which sources to trust, how to handle sparse data
- **Verification**: running tests, reviewing audit findings, confirming fixes don't regress
- **NOT active**: waiting for Claude to generate code, waiting for builds to run, waiting for test suites

The 2h 40min is engagement time — reading, thinking, deciding, verifying: any manual input.
