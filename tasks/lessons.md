# Lessons

Patterns and lessons learned during development. Review at the start of each session.

- **[Temporal]**: When in doubt about temporal type, prefer `"point"` or `"range"` with lower confidence over `"recurring"` or `"seasonal"` with higher confidence. It's easier to upgrade a point event to recurring later than to fix a wrongly recurring event.
- **[Sparse Data]**: Hermanus event data is sparser than expected. SerpAPI returns 3-5 results vs 20+ for Cape Town. The manual submission form is essential for coverage, not a nice-to-have.
- **[Facebook Gap]**: Most Hermanus event organisers post on Facebook, but the Graph API severely restricts event search since 2019. SerpAPI partially captures via Google's index but not reliably. Accepted as a known gap — document honestly, don't pretend full coverage.
- **[Verify All Claims]**: Design-phase documents accumulated stale numbers that propagated across files: wrong model names (Haiku 4.5 → 5.5), wrong pricing ($0.80/M → $0.10/M), wrong population (35K → 91K), wrong free tier limits (100 → 250 searches/month), non-existent APIs (Quicket has no public API), EOL frameworks (Next.js 15 → 16), and stale library references (Cheerio not used). Every factual claim — population, pricing, API existence, version numbers, free tier limits — must be verified against current sources before finalising. One wrong number cascades into every file that references it.
- **[Quicket No API]**: Quicket (SA's primary ticketing platform) has no public developer API as of Nov 2026. The Apify SA Events Scraper (`apify.com/gtnetworks/sa-events-listings`) is the workaround. Never reference `developer.quicket.co.za` or `docs.quicket.com` — they don't exist.
