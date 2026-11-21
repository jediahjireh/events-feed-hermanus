# Web References & Prior Art

Research gathered during the design phase. Sources verified against live web where possible.

---

## Event Feed / Aggregation Projects

| Project | URL | Relevance |
|---|---|---|
| EventScraper (Next.js + Firebase + Claude) | [github.com/Kensj0/eventscraper](https://github.com/Kensj0/eventscraper) | Closest match — AI-powered local event aggregator with Next.js 15, RSS ingestion, Claude extraction. Good architecture reference. |
| NSNodes Events (multi-source aggregation) | [github.com/topics/event-aggregation](https://github.com/topics/event-aggregation) | FastAPI + Next.js, 10 sources, fuzzy deduplication, LLM augmentation. PostGIS for location. |
| OctoAgenda (Next.js 16 + Claude + Firecrawl) | [github.com/funsaized/OctoAgenda](https://github.com/funsaized/OctoAgenda) | AI-powered web scraping → ICS export. Uses Zod for validation. |
| City-Bureau city-scrapers | [github.com/City-Bureau/city-scrapers](https://github.com/City-Bureau/city-scrapers) | Community event scraping architecture. Good reference for per-source scraper pattern. |
| Facebook Event Aggregator | [github.com/Denperidge/facebook-event-aggregator](https://github.com/Denperidge/facebook-event-aggregator) | Scrapes FB pages → static site + .ics. Shows the FB data gap problem. |
| Family Events Platform (11 data sources) | [stevecv.com/blog/how-i-built-family-events-platform-nextjs-11-data-sources](https://stevecv.com/blog/how-i-built-family-events-platform-nextjs-11-data-sources.html) | Next.js + PostgreSQL, automated content pipelines. Similar scope to this project. |
| Event Radar (SF tech events) | [github.com/KShivendu/event-radar](https://github.com/KShivendu/event-radar) | Multi-source dedup, SQLite, local web UI. Shows the dedup challenge. |

---

## Schema & Data Model References

| Resource | URL | Relevance |
|---|---|---|
| schema.org/Event | [schema.org/Event](https://schema.org/Event) | Base event type. `startDate`, `endDate`, `location`, `organizer`. |
| schema.org/Schedule | [schema.org/Schedule](https://schema.org/Schedule) | Recurring event support: `byDay`, `byMonth`, `repeatFrequency`, `repeatCount`. |
| schema.org/EventSeries | [schema.org/EventSeries](https://schema.org/EventSeries) | Collections like "Olympic Games" containing sub-events. |
| Martin Fowler — Recurring Events in Calendars | [martinfowler.com/apsupp/recurring.pdf](https://martinfowler.com/apsupp/recurring.pdf) | Classic temporal expression patterns. `Occurrences(Event, DateRange)` query pattern. |
| Modeling Recurring vs One-Off Events | [dev.to article](https://dev.to/member_5432fd74/modeling-recurring-vs-one-off-events-in-a-bilingual-city-guide-m5g) | Practical approach to the same problem in a city guide. |
| schemaorg/schemaorg #1457 | [github.com/schemaorg/schemaorg/issues/1457](https://github.com/schemaorg/schemaorg/issues/1457) | Discussion on adding Schedule type for recurring events. |

---

## Agent-Friendly API Design

| Resource | URL | Key takeaway |
|---|---|---|
| AI Agents Are the New API Users (2026) | [blog.apilayer.com](https://blog.apilayer.com/ai-agents-are-the-new-users-of-your-api-how-to-make-your-api-agent-ready/) | Agent Experience (AX) as a new design discipline. Structured output, deterministic behaviour. |
| 5 API Design Principles for AI Agents | [dev.to/1xapi](https://dev.to/1xapi/5-api-design-principles-for-ai-agents-in-2026-431c) | Token-aware responses, `meta.tokenEstimate`, machine-readable errors. |
| Prepare APIs for AI Agents (Fern) | [buildwithfern.com](https://buildwithfern.com/post/prepare-apis-documentation-ai-agent-consumption) | 90% token reduction with structured schemas. |
| Designing APIs for AI Agents (elmah.io) | [blog.elmah.io](https://blog.elmah.io/designing-apis-for-ai-agents-your-api-has-a-new-user/) | Function calling / tool definitions. `X-Agent-ID` headers. |
| How to Design APIs for AI Agents (freeCodeCamp) | [freecodecamp.org](https://www.freecodecamp.org/news/how-to-design-apis-for-ai-agents/) | Composability, session tracking, idempotency. |
| Designing APIs That Survive AI Agents at Scale | [wearedevelopers.com talk](https://www.wearedevelopers.com/events/world-congress-2026-north-america/sessions/1714-designing-apis-that) | 8 patterns: idempotency, tool-spec naming, capability-scoped tokens, backpressure, semantic dedup. |

---

## Hermanus Event Sources

| Source | URL | Method | Expected yield |
|---|---|---|---|
| SerpAPI (Google Events) | [serpapi.com/events-results](https://serpapi.com/events-results) | REST API | Medium-high |
| Quicket (SA ticketing) | [quicket.co.za](https://www.quicket.co.za/) | No public API (Nov 2026) | Medium |
| Apify Quicket Scraper | [apify.com/gtnetworks/sa-events-listings](https://apify.com/gtnetworks/sa-events-listings/api) | Apify actor (primary Quicket data method) | Medium |
| hermanus.co.za | hermanus.co.za | Scrape + Claude | Medium |
| ShowMe Hermanus | showme.co.za/hermanus/ | Scrape + Claude | Medium |
| FynArts Festival | fynarts.co.za | Scrape (seasonal) | Low but high-value |
| SA-Venues | sa-venues.com | Scrape | Low-medium |
| Overberg Info | overberginfo.com | Scrape | Low-medium |

### SerpAPI Usage

| Tutorial | URL |
|---|---|
| Python filter & scrape | [serpapi.com/blog/filter-and-scrape-google-events-with-python](https://serpapi.com/blog/filter-and-scrape-google-events-with-python/) |
| Node.js scrape | [serpapi.com/blog/web-scraping-google-events-results-with-nodejs](https://serpapi.com/blog/web-scraping-google-events-results-with-nodejs/) |
| Quick start | [serpapi.com/blog/how-to-scrape-google-events-results](https://serpapi.com/blog/how-to-scrape-google-events-results/) |

---

## Magic Safari Handbook References

| Page | URL | Key principle applied |
|---|---|---|
| AI & Automation | [magicsafari.com/handbook/ai-and-automation](https://magicsafari.com/handbook/ai-and-automation/) | "No meat proxies", "Manage your agents", "Understand before you accelerate" |
| How We Prioritise | [magicsafari.com/handbook/how-we-prioritise](https://magicsafari.com/handbook/how-we-prioritise/) | "Test it, don't theorize", "Build the factory, not the car" |
| How We Communicate | [magicsafari.com/handbook/how-we-communicate](https://magicsafari.com/handbook/how-we-communicate/) | Writing culture, "emails absent of AI-isms" |
| Our Tech Stack | [magicsafari.com/handbook/our-tech-stack](https://magicsafari.com/handbook/our-tech-stack/) | "Simple over clever", boring technology |
