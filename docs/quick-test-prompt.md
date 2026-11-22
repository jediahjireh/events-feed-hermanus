# Quick Test Prompt

Copy-paste this into any Claude session (web, desktop, or API) to run a full E2E test of the production API. No codebase access needed — just web fetch capability.

---

Run a full end-to-end test of the Hermanus Event Feed API at https://events-feed-hermanus.vercel.app. Test ALL of the following and report PASS/FAIL for each:

1. Health: GET /api/health → status "healthy", 5+ active events, 7 sources
2. Schema: GET /api/schema → openapi "3.1.0", 10 paths
3. Sources: GET /api/sources → 7 sources, pagination works (per_page=2)
4. Events: GET /api/events → 5+ events, response has data/meta/errors shape
5. Category filter: ?categories=wildlife → only wildlife events
6. Confidence: default excludes <0.6, ?min_confidence=0 includes low-confidence
7. Cancelled: default excludes cancelled, ?status=cancelled shows them
8. Case 1 (DESIGN.md): ?from=2027-09-14&to=2027-09-21&suitable_for=couples,luxury → exactly Whale Watching, Country Market, Wine Tasting. NOT Whale Festival or FynArts
9. Case 2: ?from=2027-06-01&to=2027-06-30&suitable_for=families → exactly Whale Watching, Country Market. NOT FynArts
10. Case 4: Cancelled Beach Concert in cancelled list, absent from active
11. Pagination: per_page=2 pages through all events, meta has total_count/has_more
12. Sorting: sort=date, sort=confidence, sort=relevance all return results
13. Relevance: ?suitable_for=luxury&sort=relevance → Wine Tasting in top 3
14. Error handling: nonexistent event → 404, bad body → 422, reversed dates → 400
15. Cron auth: GET /api/cron without header → 401
16. Ingest runs: GET /api/ingest/runs → has data with run stats
17. Review agent: POST /api/review with empty body → 200 with events_checked
18. CRUD: create a test event (source_id=manual, start_date=2099-12-31), read it, update title (version=1), verify version conflict (reuse version=1 → 409), check versions trail, delete it, verify it's cancelled

19. Manual submission: POST /api/events with source_id=manual, title="Claude Manual Test Event", temporal type=point start_date=2099-01-15, categories=["art"], suitable_for=["solo"], confidence=0.7. Verify 201 response with source_id=manual. Then delete it (DELETE /api/events/:id) and verify cancelled.

For each test, show the actual response values. Summarise with a count: X/19 PASS.
