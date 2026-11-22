---
name: pr
description: Create a pull request with a structured description, security checklist, and verification steps. Handles branch creation, pushing, and PR creation via gh CLI.
user-invocable: true
disable-model-invocation: false
argument-hint: "[branch-name] [base-branch] [--draft]"
allowed-tools: [Read, Bash, Grep, Glob]
---

Create a pull request for the current changes with a structured description.

**IMPORTANT: The user must have committed their changes before running this skill.** If there are uncommitted changes, warn the user and stop.

## Steps

1. Check prerequisites:
   - `gh` CLI is installed and authenticated
   - Working directory is clean (no uncommitted changes that should be in the PR)
   - Current branch is not `main` (PRs should come from feature/fix branches)

2. Determine PR metadata:
   - **Title**: Short (<70 chars), conventional-commits style prefix (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`)
   - **Base branch**: Default `main`, or use argument if provided
   - **Draft**: If `--draft` flag is passed, create as draft PR

3. Analyse the changes:
   - `git log main..HEAD --oneline` to see all commits on this branch
   - `git diff main...HEAD --stat` to see file-level changes
   - Read key changed files to understand the scope

4. Write the PR description using the template below.

5. Push the branch and create the PR:

   ```bash
   git push -u origin <branch-name>
   gh pr create --title "<title>" --body "<body>"
   ```

6. Report the PR URL to the user.

## PR Description Template

```markdown
## What this changes

<!-- One paragraph summarising the change. Reference the phase/task from tasks/todo.md if applicable. -->

## Security checklist

Tick each line honestly, or write why it does not apply.

- [ ] **Input validation** — all new or changed API routes validate input at the boundary using Zod schemas; no raw user input reaches the database or agents.
- [ ] **SQL injection** — all database access uses Drizzle ORM query builder; no string concatenation or template literals in queries.
- [ ] **Secrets** — no API keys, tokens, or credentials in source code; all secrets in `.env.local` only; `.env.example` has placeholders only.
- [ ] **Bounded responses** — no unbounded arrays or strings in API responses or database writes; pagination enforced; LLM output length-capped before storage.
- [ ] **Error handling** — error responses use `{ code, message, suggestion, retryable }` shape; no stack traces, SQL errors, or file paths leaked to clients.
- [ ] **Rate limiting** — new endpoints that trigger expensive operations (LLM calls, external API calls, database writes) have appropriate guards.
- [ ] **CORS** — no wildcard CORS on production; origins restricted to known domains.
- [ ] **Auth on triggers** — cron and ingest trigger endpoints require the `CRON_SECRET` header; not callable anonymously.
- [ ] **Dependencies** — new packages are from trusted publishers; no known critical vulnerabilities (`pnpm audit`).
- [ ] **Tests** — the refused/error case is tested, not only the happy path; existing tests still pass.

## How I verified it

<!-- Commands run, tests added, what was checked. Example:
- `pnpm test` — 175/175 pass
- `pnpm build` — 0 errors, 14 routes
- Tested on production: https://events-feed-hermanus.vercel.app
- Ran `/project:verify` — all clear
-->
```

## Notes

- Keep the "What this changes" paragraph concise — 2-4 sentences max.
- For the security checklist: tick items that apply, write "N/A — <reason>" for items that don't.
- The "How I verified it" section should include actual commands and results, not aspirational statements.
- If the PR is part of a sequence (e.g., "merge backend PR first"), note the dependency in the description.

$ARGUMENTS
