---
name: deploy
description: Deployment workflow for the event feed. Pre-deploy checks, staging verification, production deploy to Vercel, and post-deploy validation.
user-invocable: true
disable-model-invocation: true
argument-hint: "[staging | production] [--skip-staging]"
allowed-tools: [Read, Bash, Grep, Glob]
---

Deployment workflow for the event feed. Guides through pre-deploy checks, staging verification, production deploy, and post-deploy validation.

**Start immediately.**

## Phase 1: Pre-Deploy Checks

1. **Run the security check**: Execute `/project:security-check --quick`.
2. **Run tests**: `pnpm test` — ALL tests must pass, especially `hand-worked-cases.test.ts`.
3. **Run lint/build**: `pnpm build` — must complete without errors.
4. **Check migrations**: Are there pending Drizzle migrations? If yes, document the migration plan.
5. **Check dependencies**: `pnpm audit` — no critical vulnerabilities.
6. **Check env vars**: All required vars from `.env.example` must be set in the deployment environment.

## Phase 2: Staging Deploy (unless `--skip-staging`)

1. **Deploy to Vercel preview**: Push to a branch or use `vercel --preview`.
2. **Run smoke tests**: Verify key flows:
   - `GET /api/health` returns healthy status
   - `GET /api/events?from=2027-06-01&to=2027-06-30` returns expected seed data
   - `GET /api/events/:id` returns a single event with full detail
   - `POST /api/ingest` with `source_id: "google-events"` succeeds (or dry-run)
3. **Check logs**: Review Vercel function logs for errors or warnings.

## Phase 3: Production Deploy

1. **Deploy**: Merge to main or run `vercel --prod`.
2. **Monitor**: Watch Vercel function logs for the first 10-15 minutes.
3. **Smoke test production**: Verify health endpoint and key API queries.

## Phase 4: Post-Deploy Validation

1. **Health check**: `GET /api/health` returns OK with DB connected.
2. **Data integrity**: Verify event counts match expectations.
3. **API responses**: Confirm `{ data, meta, errors }` structure on all endpoints.

## Rules

- NEVER deploy directly to production without staging verification (unless `--skip-staging` is explicitly passed).
- ALWAYS have a rollback plan — Vercel supports instant rollbacks to previous deployments.
- ALWAYS run hand-worked case tests before deploying.

$ARGUMENTS
