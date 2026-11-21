---
name: implement
description: Plan and build a feature, fix, or enhancement from a spec, requirement, or inline description. Handles planning, codebase research, implementation, and verification.
user-invocable: true
disable-model-invocation: true
argument-hint: "<description or feature-brief reference>"
---

Implement a feature, fix, or enhancement from a spec, requirement, or inline description.

**Start immediately** by reading these files in parallel. If `tasks/feature-brief.md` still has placeholder `___` values, stop and ask the user to fill it in first. If $ARGUMENTS contains the request inline, use that instead of the file.

1. Read `tasks/feature-brief.md` for the feature request inputs.
2. Read `tasks/lessons.md` for patterns to watch for.
3. Read `DESIGN.md` for the relevant section of the design.

## Planning Phase

**Enter plan mode before writing any code.**

1. **Understand the request**: Parse the feature brief or inline description. Identify what's being asked and why.
2. **Research the codebase**: Search for all existing code related to the feature — services, models, routes, tests, and types. Understand the current architecture before proposing changes.
3. **Reference project docs**: Read DESIGN.md for the relevant domain section. Check if the feature touches temporal logic, deduplication, API endpoints, or agent pipelines.
4. **Web search if needed**: Look up API docs (Apify actors, Drizzle, Neon) or package documentation when implementing unfamiliar APIs.
5. **Draft the implementation plan**: Write a clear plan covering:
   - Files to create/modify (with rationale for each)
   - Approach and architecture decisions
   - Edge cases and how they'll be handled
   - What will NOT change (scope boundaries)
   - Any open questions that need answering before proceeding
6. **Save the plan**: Write the plan to `tasks/todo.md` with checkable items for each step.
7. **Get approval**: Present the plan and wait for the user to approve before implementing.

## Implementation Phase

Work through the plan in `tasks/todo.md`, marking items complete as you go.

- Follow existing codebase patterns — search before building anything new.
- Wire up complete flows — trace from API route through to services, models, and data layer. No dangling references or half-connected features.
- Apply all CLAUDE.md rules (temporal model, confidence scoring, versioning, agent-friendly API).
- If you hit something unexpected, stop and flag it rather than making assumptions.
- After changes to temporal logic, run `tests/temporal.test.ts`.
- After changes to API endpoints, run `tests/hand-worked-cases.test.ts`.

## Completion Phase

After implementation:

1. Run `pnpm lint` and fix any issues.
2. Run `pnpm test` and ensure all tests pass.
3. Grep for unguarded debug statements, orphaned references, and unresolved TODOs.
4. Verify everything works — no placeholders, no debug-only code leaking to production.
5. Present a summary of all changes made, grouped by file, in plain English.
6. Offer to run `/project:verify` for thorough audit.
7. Offer to run `/project:commit-plan` to group changes into commit lots.

## Rules

- No dead code or duplication. Remove anything made obsolete by the changes.
- Search the codebase for implementation patterns before building new functionality.
- Ensure data is correctly being passed through all flows.
- `// TODO:` comments addressed to the team are action items — implement them, don't leave them as placeholders.
- If the feature touches the Event schema, update `src/types/event.ts` Zod schemas AND `src/db/schema.ts` Drizzle schema together.
- If the feature adds or changes an API endpoint, update the OpenAPI spec at `GET /api/schema`.

## Progress Tracking & Resumability

- Write the full plan to `tasks/todo.md` BEFORE starting implementation, with checkable items for each file/step.
- Mark items complete as you finish them — this is the checkpoint for resuming if the session runs out of tokens.
- If context is getting long, summarise completed work in `tasks/todo.md` and note what remains.
- On resume: read `tasks/todo.md` to see where you left off. Pick up from the first unchecked item.

$ARGUMENTS
