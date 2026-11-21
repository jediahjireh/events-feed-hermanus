---
name: source-eval
description: Evaluate a potential new event source for data quality, coverage, and integration effort. TRIGGER when considering adding a new data source.
user-invocable: true
disable-model-invocation: true
argument-hint: "[url or source name]"
---

# Source Evaluation Skill

Evaluate whether a new event source is worth integrating. Produces a recommendation with estimated yield, effort, and ongoing cost.

## Process

### 1. Fetch and inspect

- Load the URL.
- Identify the platform (WordPress, custom HTML, API, RSS, iCal).
- Check for structured data: `<script type="application/ld+json">` with schema.org/Event markup.
- Check for feeds: `/feed/`, `/events/?ical=1`, `/wp-json/wp/v2/posts`.
- Check `robots.txt` for scraping restrictions.

### 2. Assess data quality

For 5 events visible on the page, extract manually and check:

| Check | Pass/Fail |
|---|---|
| Event title clearly identifiable | |
| Date/time parseable | |
| Venue/location present | |
| Description available | |
| Temporal type classifiable (point/range/recurring/seasonal) | |
| Data is current (not stale/outdated) | |

Score: X/6 per event, average across 5.

### 3. Estimate yield

- How many events are listed? (Rough count)
- How often is the site updated? (Check dates on recent posts/events)
- Does it cover events we don't already have? (Cross-reference with existing DB)
- Geographic scope: Hermanus only, Overberg region, Western Cape, national?

### 4. Estimate integration effort

| Method | Effort | Reliability |
|---|---|---|
| API (documented) | Low | High |
| RSS/iCal feed | Low | Medium |
| WordPress REST API | Low | Medium |
| Schema.org structured data | Medium | High |
| Claude HTML extraction | Medium | Medium-High |
| CSS selector scraping | Medium | Low (brittle) |
| Manual curation | Low | High (but doesn't scale) |

### 5. Output recommendation

```markdown
## Source Evaluation: {name}

**URL:** {url}
**Platform:** {WordPress/custom/API}
**Structured data:** {yes/no, type}
**Data quality score:** {X}/6
**Estimated events:** {N} (of which {M} are unique vs existing DB)
**Update frequency:** {daily/weekly/monthly/annual}
**Integration method:** {API/RSS/scrape/manual}
**Effort:** {low/medium/high}
**Ongoing cost:** {$/run}
**Trust level (recommended):** {0.0–1.0}

**Recommendation:** {Add / Skip / Monitor}
**Reasoning:** {1–2 sentences}
```

## Priority Sources to Evaluate First

1. SerpAPI (Google Events) — API, highest expected yield
2. Quicket (via Apify scraper — no public API) — SA ticketing platform
3. hermanus.co.za — local tourism site
4. ShowMe Hermanus (showme.co.za/hermanus/) — community directory
5. fynarts.co.za — annual festival (seasonal scrape)
6. SA-Venues (sa-venues.com) — national tourism directory

## Decision Rule

Add a source if:
- Data quality score >= 4/6, AND
- It provides >= 3 events we don't already have, AND
- Integration effort is low or medium

Skip if:
- Data quality score < 3/6, OR
- All events duplicate what we already have, OR
- Effort is high and yield is < 5 unique events
