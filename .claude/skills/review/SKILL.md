---
name: review
description: Verify existing events are still correct by re-checking sources. TRIGGER on schedule (weekly), on-demand, or when debugging data quality issues.
user-invocable: true
disable-model-invocation: false
argument-hint: "[event-id | 'upcoming' | 'low-confidence' | 'all']"
---

# Review Skill — Event Verification

Re-verify stored events against their sources to catch cancellations, date changes, and stale data.

## When to Run

- **Weekly (scheduled):** Check all events with `start_date` or `next_occurrence` within the next 30 days.
- **On-demand:** When a data quality issue is suspected.
- **Low-confidence sweep:** Check all events with `confidence < 0.7` and attempt to find corroborating sources.

## Process

### 1. Select events to review

- `upcoming`: events where the temporal range overlaps the next 30 days.
- `low-confidence`: events with `confidence < 0.7`.
- `all`: everything with `status: "active"`.
- `{event-id}`: single event.

### 2. Re-check each event

For each event:

1. If `source.url` exists, fetch the source page.
2. Check if the event is still listed:
   - **Still listed, same details:** Confirm. Bump `last_verified_at`. No version change.
   - **Still listed, details changed:** Update event. Create new EventVersion with diff.
   - **Not listed (404 or removed):** Don't immediately cancel. Drop `confidence` by 0.2. If confidence falls below 0.3, mark `status: "tentative"`. Flag for manual review.
   - **Page says "CANCELLED":** Set `status: "cancelled"`. Create EventVersion.

3. For low-confidence events, attempt secondary source verification:
   - Search SerpAPI (Google Events, Eventbrite) or Apify actors (Facebook Events) for the event title + location.
   - If found on a second source, merge data and bump confidence.
   - If not found on any secondary source, keep existing confidence (absence of evidence ≠ evidence of absence for small-town events).

### 3. Report

Output a review report:

```
Review scope: upcoming (next 30 days)
Events checked: 24
Events confirmed (no change): 18
Events updated (details changed): 3
Events confidence-dropped (source gone): 2
Events cancelled: 1
Events needing manual review: 2
Source health:
  - google-events: 10/10 confirmed (100%)
  - facebook: 4/4 confirmed (100%)
  - hermanus.co.za: 6/8 confirmed (75%) ← investigate
  - quicket: 5/6 confirmed (83%)
Tokens used: 3,100 (Haiku)
Cost: $0.002
```

### 4. Source health tracking

If a source has >30% of its events unconfirmed in a single review run:

- Lower the source's `trust_level` by 0.1.
- Flag in the report: "Source {name} health degraded. {X}% of events unconfirmed. Consider manual check of source URL."

## Tracer Bullets

1. After review, no event should have `last_verified_at` older than 7 days if it's within the next 30 days.
2. Cancelled events must have an EventVersion explaining why (source said cancelled, or source gone + confidence < 0.3).
3. Source trust_level must never go below 0.1 (even bad sources may still have some valid data).
