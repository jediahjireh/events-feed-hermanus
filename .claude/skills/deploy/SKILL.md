---
name: deploy
description: Deployment workflow for the event feed. Pre-deploy checks, staging verification, production deploy to Vercel, and post-deploy validation.
user-invocable: true
disable-model-invocation: false
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
2. **Run smoke tests** against the preview URL — verify key flows:
   - `GET /api/health` returns healthy status
   - `GET /api/events?from=2027-06-01&to=2027-06-30` returns expected seed data
   - `GET /api/events/:id` returns a single event with full detail
   - `POST /api/ingest` with `source_id: "google-events"` succeeds (or dry-run)
3. **Check logs**: Review Vercel function logs for errors or warnings.

## Phase 3: Production Deploy

1. **Deploy**: Merge to main or run `vercel --prod`.
2. **Monitor**: Watch Vercel function logs for the first 10-15 minutes.
3. **Smoke test production**: Run the production smoke test from [docs/testing-guide.md](../docs/testing-guide.md#quick-smoke-test-scripts).

## Phase 4: Post-Deploy Validation

Production URL: `https://events-feed-hermanus.vercel.app`

```bash
BASE=https://events-feed-hermanus.vercel.app
curl -sf $BASE/api/health | jq -e '.data.status == "healthy"' && echo "Health: PASS" || echo "Health: FAIL"
curl -sf "$BASE/api/events" | jq -e '.meta.total_count >= 5' && echo "Events: PASS" || echo "Events: FAIL"
curl -sf "$BASE/api/events?from=2027-09-14&to=2027-09-21&suitable_for=couples,luxury" | jq -e '[.data[].title] | length == 3' && echo "Case 1: PASS" || echo "Case 1: FAIL"
curl -sf "$BASE/api/schema" | jq -e '.openapi == "3.1.0"' && echo "Schema: PASS" || echo "Schema: FAIL"
curl -sf "$BASE/api/sources" | jq -e '[.data[].id] | length == 7' && echo "Sources: PASS" || echo "Sources: FAIL"
```

1. **Health check**: All 5 checks above pass.
2. **Data integrity**: Verify event counts match expectations (`total_active` in health response).
3. **API responses**: Confirm `{ data, meta, errors }` structure on all endpoints.

## Rules

- NEVER deploy directly to production without staging verification (unless `--skip-staging` is explicitly passed).
- ALWAYS have a rollback plan — Vercel supports instant rollbacks to previous deployments.
- ALWAYS run hand-worked case tests before deploying.

$ARGUMENTS
