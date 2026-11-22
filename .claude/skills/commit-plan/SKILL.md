---
name: commit-plan
description: Analyse staged and unstaged changes, group them into logical commits, and suggest commit messages. Does NOT commit — the user commits themselves.
user-invocable: true
disable-model-invocation: false
argument-hint: "[scope or focus area]"
allowed-tools: [Read, Bash, Grep, Glob]
---

Analyse the current staged and unstaged changes and suggest how to group them into logical commits.

**IMPORTANT: Do NOT run `git commit`. The user commits themselves.** Your job is to suggest the groupings and messages only.

## Steps

1. Run `git status` to see all changed files (staged and unstaged).
2. Run `git diff --stat` to understand the scope of changes.
3. Run `git diff` on key files to understand what changed and why.
4. Group the changes into logical commit lots based on:
   - What feature or fix they relate to
   - Which files naturally belong together
   - Keeping each commit focused on one concern
5. For each lot, suggest:
   - Which files to stage (`git add <files>`)
   - A commit message (conventional commits style — e.g., `feat:`, `fix:`, `refactor:`, `chore:`)
   - Brief rationale for why these files are grouped together

## Output Format

Present as a numbered list of commit lots:

```
### Commit 1: feat: add temporal overlap logic for all four event types
Files:
- src/lib/temporal.ts
- tests/temporal.test.ts
Reason: Core temporal logic and its test suite belong together

### Commit 2: feat: add event CRUD API endpoints
Files:
- src/app/api/events/route.ts
- src/app/api/events/[id]/route.ts
- src/types/api.ts
Reason: Event endpoints and their shared types

### Commit 3: fix: correct seasonal event year-boundary wrap
Files:
- src/lib/temporal.ts
- tests/temporal.test.ts
Reason: Bug fix — seasonal events wrapping Nov-Feb now handled correctly
```

Keep commit messages concise (1 line, <72 chars). Add a body line only if the change needs explanation.

$ARGUMENTS
