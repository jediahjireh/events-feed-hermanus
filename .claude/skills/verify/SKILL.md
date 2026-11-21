---
name: verify
description: Verify that all changes from the current implementation are correct, complete, and production-ready. Run after /project:implement or any substantial coding session.
user-invocable: true
disable-model-invocation: true
argument-hint: "[feature name or scope]"
allowed-tools: [Read, Bash, Grep, Glob]
---

Verify that all changes from the current implementation are correct, complete, and production-ready. Run this after `/project:implement` or any substantial coding session.

**Start immediately.**

## Setup

1. Read `tasks/todo.md` for what was planned and implemented.
2. Read `tasks/feature-brief.md` (or the inline request from the session) for the original requirements.
3. Read `CLAUDE.md` for the rules the implementation should have followed.
4. Read `DESIGN.md` for the relevant design section.

## Verification Process

### 1. Plan Cross-Check

Compare `tasks/todo.md` against the original requirements:

- Was every requirement addressed? Walk through the brief/request point by point.
- Were there any scope deviations — things implemented that weren't asked for, or things missed?
- If a plan was drawn up before implementation, does the final code match the plan?

### 2. Implementation Review

For each file modified (check `git diff --stat`):

- **Logic correct**: Data flows correctly through the full chain — API route → service → model → data layer. Trace endpoints through to their handlers.
- **No regressions**: Existing functionality is intact. Nothing adjacent was broken.
- **No dead code**: All obsolete branches, helpers, configs, and imports were removed.
- **No duplication**: No logic that exists in multiple places.
- **Production-ready**: No TODO placeholders left unimplemented, no debug-only code leaking to release.

### 3. CLAUDE.md Compliance

Verify the project-specific rules were followed:

- Temporal model: all four types handled in any new query/filter
- Confidence scoring: no event has confidence > source.trust_level
- Versioning: event mutations create EventVersion records
- API: responses follow `{ data, meta, errors }` structure
- Comments: updated to match new implementation, no stale comments
- `// TODO:` comments: all implemented

### 4. Domain-Specific Checks

- **Temporal logic**: If temporal code changed, run `pnpm test -- temporal` and verify all four types work.
- **Dedup logic**: If dedup changed, run the dedup test suite.
- **API endpoints**: If endpoints changed, verify against DESIGN.md API spec.
- **Agent extraction**: If extraction prompts changed, verify Zod validation still passes.

## Automated Checks

- Run `pnpm lint` — must pass clean
- Run `pnpm test` — all tests must pass
- Grep for orphaned references to removed methods/classes
- Grep for unguarded debug statements in modified files
- Grep for `// TODO` that should have been implemented

## Output

Report findings to the user. For each issue found:

- File and line
- What's wrong
- Suggested fix

If everything checks out, confirm: "All changes verified — implementation is clean and production-ready."

Then offer to run `/project:commit-plan` to group changes into commit lots.

$ARGUMENTS
