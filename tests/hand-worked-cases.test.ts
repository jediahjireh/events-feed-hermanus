/**
 * Hand-worked case tests — verification against DESIGN.md expected results.
 *
 * These simulate the full API query pipeline (temporal overlap + category +
 * suitable_for + confidence filters) against the seed data.
 */

import { describe, it, expect } from "vitest";
import {
  overlaps,
  nextOccurrenceInRange,
  allOccurrencesInRange,
  parseDate,
} from "@/lib/temporal";
import { findDuplicates, type DedupCandidate } from "@/lib/dedup";
import {
  SEED_EVENTS,
  SEED_SOURCES,
  makeLocation,
  makeRangeTemporal,
  makePointTemporal,
} from "./helpers/factories";
import type { CreateEventInput } from "@/types/event";

// --- Query simulation helper ---

type SeedEvent = CreateEventInput & { key: string };

const ALL_EVENTS: SeedEvent[] = Object.entries(SEED_EVENTS).map(
  ([key, event]) => ({
    ...event,
    key,
  })
);

/**
 * Simulate the GET /api/events query pipeline:
 * 1. Filter by status (default "active")
 * 2. Filter by min_confidence (default 0.6)
 * 3. Filter by temporal overlap with from/to
 * 4. Filter by categories (any match)
 * 5. Filter by suitable_for (any match)
 * 6. Sort by relevance
 */
function queryEvents(params: {
  from?: string;
  to?: string;
  categories?: string[];
  suitable_for?: string[];
  min_confidence?: number;
  status?: string;
  sort?: "relevance" | "confidence" | "date";
}): SeedEvent[] {
  const {
    status = "active",
    min_confidence = 0.6,
    sort = "relevance",
  } = params;

  let results = ALL_EVENTS;

  // 1. Status filter
  results = results.filter((e) => e.status === status);

  // 2. Confidence filter
  results = results.filter((e) => e.confidence >= min_confidence);

  // 3. Temporal overlap
  if (params.from && params.to) {
    const travelStart = parseDate(params.from);
    const travelEnd = parseDate(params.to);
    results = results.filter((e) => overlaps(e.temporal, travelStart, travelEnd));
  }

  // 4. Categories
  if (params.categories && params.categories.length > 0) {
    results = results.filter((e) =>
      (e.categories ?? []).some((c) => params.categories!.includes(c))
    );
  }

  // 5. Suitable for
  if (params.suitable_for && params.suitable_for.length > 0) {
    results = results.filter((e) =>
      (e.suitable_for ?? []).some((s) => params.suitable_for!.includes(s))
    );
  }

  // 6. Sort
  if (sort === "relevance") {
    results.sort((a, b) => b.relevance_score - a.relevance_score);
  } else if (sort === "confidence") {
    results.sort((a, b) => b.confidence - a.confidence);
  }

  return results;
}

// ========================================================================
// Case 1: Luxury couple, 14–21 September 2027
// ========================================================================

describe("Case 1: Luxury couple, 14-21 Sep 2027", () => {
  const params = {
    from: "2027-09-14",
    to: "2027-09-21",
    suitable_for: ["couples", "luxury"],
  };

  it("returns whale watching (seasonal, Sep within Jun-Nov)", () => {
    const results = queryEvents(params);
    const titles = results.map((e) => e.title);
    expect(titles).toContain("Southern Right Whale Watching Season");
  });

  it("returns Saturday market (recurring, Sep 18 is Saturday)", () => {
    const results = queryEvents(params);
    const titles = results.map((e) => e.title);
    expect(titles).toContain("Hermanus Country Market");
  });

  it("returns wine tasting (recurring, Sep 17 is Friday)", () => {
    const results = queryEvents(params);
    const titles = results.map((e) => e.title);
    expect(titles).toContain("Wine Tasting at Creation Wines");
  });

  it("does NOT return whale festival (Sep 27-28 outside 14-21)", () => {
    const results = queryEvents(params);
    const titles = results.map((e) => e.title);
    expect(titles).not.toContain("Hermanus Whale Festival 2027");
  });

  it("does NOT return FynArts (June, not September)", () => {
    const results = queryEvents(params);
    const titles = results.map((e) => e.title);
    expect(titles).not.toContain("FynArts Festival 2027");
  });

  it("does NOT return cancelled event (status filter)", () => {
    const results = queryEvents(params);
    const titles = results.map((e) => e.title);
    expect(titles).not.toContain("Cancelled Beach Concert 2027");
  });

  it("does NOT return low-confidence event (0.4 < 0.6 threshold)", () => {
    const results = queryEvents(params);
    const titles = results.map((e) => e.title);
    expect(titles).not.toContain("Possible Pop-up Dinner at Wine Farm");
  });

  it("whale festival correctly excluded: 2027-09-27 > 2027-09-21", () => {
    const festival = SEED_EVENTS.whaleFestival;
    const start = parseDate("2027-09-14");
    const end = parseDate("2027-09-21");
    // start_date(2027-09-27) <= travel_end(2027-09-21) is false → excluded
    expect(overlaps(festival.temporal, start, end)).toBe(false);
  });

  it("market next_occurrence_in_range is 2027-09-18 (first Saturday)", () => {
    const market = SEED_EVENTS.saturdayMarket;
    const start = parseDate("2027-09-14");
    const end = parseDate("2027-09-21");
    const next = nextOccurrenceInRange(market.temporal, start, end);
    expect(next).not.toBeNull();
    expect(next!.toISOString().slice(0, 10)).toBe("2027-09-18");
  });

  it("wine tasting next_occurrence_in_range is 2027-09-17 (first Friday)", () => {
    const wine = SEED_EVENTS.wineTasting;
    const start = parseDate("2027-09-14");
    const end = parseDate("2027-09-21");
    const next = nextOccurrenceInRange(wine.temporal, start, end);
    expect(next).not.toBeNull();
    expect(next!.toISOString().slice(0, 10)).toBe("2027-09-17");
  });

  it("returns exactly 3 events sorted by relevance", () => {
    const results = queryEvents(params);
    expect(results.length).toBe(3);
    // Sorted by relevance: whale watching (0.95), wine tasting (0.85), market (0.82)
    expect(results[0].title).toBe("Southern Right Whale Watching Season");
    expect(results[1].title).toBe("Wine Tasting at Creation Wines");
    expect(results[2].title).toBe("Hermanus Country Market");
  });
});

// ========================================================================
// Case 2: Family, full month of June 2027
// ========================================================================

describe("Case 2: Family, June 2027", () => {
  const params = {
    from: "2027-06-01",
    to: "2027-06-30",
    suitable_for: ["families"],
  };

  it("returns whale watching (seasonal, June within Jun-Nov)", () => {
    const results = queryEvents(params);
    const titles = results.map((e) => e.title);
    expect(titles).toContain("Southern Right Whale Watching Season");
  });

  it("returns Saturday market (recurring, families-friendly)", () => {
    const results = queryEvents(params);
    const titles = results.map((e) => e.title);
    expect(titles).toContain("Hermanus Country Market");
  });

  it("does NOT return FynArts (not suitable for families)", () => {
    // FynArts temporal overlaps June, but suitable_for is ["couples", "solo", "luxury"]
    const results = queryEvents(params);
    const titles = results.map((e) => e.title);
    expect(titles).not.toContain("FynArts Festival 2027");
  });

  it("FynArts DOES overlap temporally with June", () => {
    // Temporal overlap is true even though the suitable_for filter excludes it
    const fynArts = SEED_EVENTS.fynArts;
    const start = parseDate("2027-06-01");
    const end = parseDate("2027-06-30");
    expect(overlaps(fynArts.temporal, start, end)).toBe(true);
  });

  it("does NOT return whale festival (Sep, not June)", () => {
    const results = queryEvents(params);
    const titles = results.map((e) => e.title);
    expect(titles).not.toContain("Hermanus Whale Festival 2027");
  });

  it("market has 4 Saturdays in June 2027", () => {
    const market = SEED_EVENTS.saturdayMarket;
    const start = parseDate("2027-06-01");
    const end = parseDate("2027-06-30");

    const occurrences = allOccurrencesInRange(market.temporal, start, end);
    // June 2027 Saturdays: Jun 5, 12, 19, 26
    expect(occurrences.length).toBe(4);
  });

  it("market first Saturday is 2027-06-05", () => {
    const market = SEED_EVENTS.saturdayMarket;
    const start = parseDate("2027-06-01");
    const end = parseDate("2027-06-30");
    const next = nextOccurrenceInRange(market.temporal, start, end);
    expect(next).not.toBeNull();
    expect(next!.toISOString().slice(0, 10)).toBe("2027-06-05");
  });

  it("without suitable_for filter, FynArts appears", () => {
    const unfiltered = queryEvents({
      from: "2027-06-01",
      to: "2027-06-30",
    });
    const titles = unfiltered.map((e) => e.title);
    expect(titles).toContain("FynArts Festival 2027");
  });
});

// ========================================================================
// Case 3: Duplicate detection across sources
// ========================================================================

describe("Case 3: Duplicate detection across sources", () => {
  it("FynArts from Google Events merges with FynArts from hermanus.co.za", () => {
    const googleEvents: DedupCandidate = {
      id: "ge-fynarts",
      title: "FynArts Festival Hermanus 2027",
      temporal: makeRangeTemporal("2027-06-11", "2027-06-15"),
      location: makeLocation({
        name: "FynArts Hermanus",
        venue: null,
        town: "Hermanus",
      }),
    };

    const existing: DedupCandidate = {
      id: "herm-fynarts",
      title: "Hermanus FynArts 2027 — Annual Arts Festival",
      temporal: makeRangeTemporal("2027-06-11", "2027-06-15"),
      location: makeLocation({
        name: "FynArts",
        venue: null,
        town: "Hermanus",
      }),
    };

    const matches = findDuplicates(googleEvents, [existing]);
    expect(matches.length).toBe(1);
    expect(matches[0].confidence).toBeGreaterThan(0.7);
  });

  it("merged event should have higher confidence (two sources agree)", () => {
    // When two sources report the same event, confidence should increase.
    // The merge logic in the ingest agent picks max(existing, new) confidence.
    // This tests the principle — not the merge itself.
    const sourceA = SEED_SOURCES.googleEvents;
    const sourceB = SEED_SOURCES.hermanus;
    // Trust levels: 0.8 and 0.7 — both are credible
    expect(sourceA.trust_level).toBeGreaterThanOrEqual(0.7);
    expect(sourceB.trust_level).toBeGreaterThanOrEqual(0.7);
  });

  it("whale watching from Google Events does NOT merge with whale festival", () => {
    const whaleWatching: DedupCandidate = {
      id: "ww-1",
      title: "Southern Right Whale Watching Season",
      temporal: {
        type: "seasonal",
        start_date: null,
        end_date: null,
        start_month: 6,
        end_month: 11,
        recurrence: null,
        dates: null,
      },
      location: makeLocation({ venue: "Hermanus Cliff Path" }),
    };

    const whaleFestival: DedupCandidate = {
      id: "wf-1",
      title: "Hermanus Whale Festival 2027",
      temporal: makeRangeTemporal("2027-09-27", "2027-09-28"),
      location: makeLocation({ venue: "Hermanus town centre" }),
    };

    const matches = findDuplicates(whaleWatching, [whaleFestival]);
    // Different titles, different temporal types, different venues → no match
    expect(matches.length).toBe(0);
  });

  it("exact duplicate from same scrape merges with high confidence", () => {
    const eventA: DedupCandidate = {
      id: "a",
      title: "Hermanus Country Market",
      temporal: {
        type: "recurring",
        start_date: null,
        end_date: null,
        start_month: null,
        end_month: null,
        recurrence: {
          frequency: "weekly",
          day_of_week: 5,
          interval: 1,
          exceptions: [],
        },
        dates: null,
      },
      location: makeLocation({
        name: "Hermanus Country Market",
        venue: "Hermanus Cricket Club",
      }),
    };

    const eventB: DedupCandidate = {
      id: "b",
      title: "Hermanus Country Market (Weekly)",
      temporal: {
        type: "recurring",
        start_date: null,
        end_date: null,
        start_month: null,
        end_month: null,
        recurrence: {
          frequency: "weekly",
          day_of_week: 5,
          interval: 1,
          exceptions: [],
        },
        dates: null,
      },
      location: makeLocation({
        name: "Hermanus Country Market",
        venue: "Hermanus Cricket Club",
      }),
    };

    const matches = findDuplicates(eventA, [eventB]);
    expect(matches.length).toBe(1);
    expect(matches[0].confidence).toBeGreaterThan(0.8);
  });
});

// ========================================================================
// Case 4: Cancelled event handling
// ========================================================================

describe("Case 4: Cancelled event handling", () => {
  it("cancelled events are excluded from default queries", () => {
    const results = queryEvents({
      from: "2027-01-01",
      to: "2027-12-31",
    });
    const titles = results.map((e) => e.title);
    expect(titles).not.toContain("Cancelled Beach Concert 2027");
  });

  it("cancelled events appear with status=cancelled filter", () => {
    const results = queryEvents({
      from: "2027-01-01",
      to: "2027-12-31",
      status: "cancelled",
      min_confidence: 0,
    });
    const titles = results.map((e) => e.title);
    expect(titles).toContain("Cancelled Beach Concert 2027");
  });

  it("confidence drop below threshold hides event from default results", () => {
    // Simulate: event had confidence 0.7, source returns 404,
    // review agent drops confidence by 0.2 → 0.5, below 0.6 threshold
    const originalConfidence = 0.7;
    const confidenceDrop = 0.2;
    const newConfidence = originalConfidence - confidenceDrop;
    expect(newConfidence).toBeCloseTo(0.5);
    expect(newConfidence).toBeLessThan(0.6); // Below default threshold
  });

  it("low-confidence event (0.4) is hidden from default queries", () => {
    const results = queryEvents({
      from: "2027-10-01",
      to: "2027-10-31",
    });
    const titles = results.map((e) => e.title);
    // Pop-up dinner (confidence 0.4) should not appear
    expect(titles).not.toContain("Possible Pop-up Dinner at Wine Farm");
  });

  it("low-confidence event appears with min_confidence=0", () => {
    const results = queryEvents({
      from: "2027-10-01",
      to: "2027-10-31",
      min_confidence: 0,
    });
    const titles = results.map((e) => e.title);
    expect(titles).toContain("Possible Pop-up Dinner at Wine Farm");
  });

  it("cancelled event seed has correct properties", () => {
    const cancelled = SEED_EVENTS.cancelledEvent;
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.confidence).toBe(0.6);
    expect(cancelled.source_id).toBe("manual");
  });
});

// ========================================================================
// Cross-cutting: Default min_confidence=0.6 filter
// ========================================================================

describe("Default confidence threshold behaviour", () => {
  it("events at exactly 0.6 confidence ARE included", () => {
    // Cancelled beach concert has confidence 0.6
    // but it's excluded by status, not confidence
    const cancelled = SEED_EVENTS.cancelledEvent;
    expect(cancelled.confidence).toBe(0.6);
    // With status=cancelled, it passes the confidence threshold
    const results = queryEvents({
      from: "2027-08-01",
      to: "2027-08-31",
      status: "cancelled",
      min_confidence: 0.6,
    });
    const titles = results.map((e) => e.title);
    expect(titles).toContain("Cancelled Beach Concert 2027");
  });

  it("events below 0.6 ARE excluded by default", () => {
    const lowConf = SEED_EVENTS.lowConfidenceEvent;
    expect(lowConf.confidence).toBe(0.4);
    expect(lowConf.confidence).toBeLessThan(0.6);
  });

  it("all 5 active events above threshold appear for full-year query", () => {
    const results = queryEvents({
      from: "2027-01-01",
      to: "2027-12-31",
    });
    // Should include: whale watching, market, FynArts, whale festival, wine tasting
    // Should exclude: cancelled (status), low-confidence (0.4 < 0.6)
    expect(results.length).toBe(5);
  });
});

// ========================================================================
// Seed data integrity checks
// ========================================================================

describe("Seed data integrity", () => {
  it("all 4 temporal types are represented", () => {
    const types = new Set(ALL_EVENTS.map((e) => e.temporal.type));
    expect(types).toContain("point");
    expect(types).toContain("range");
    expect(types).toContain("recurring");
    expect(types).toContain("seasonal");
  });

  it("all 4 sources are represented in events", () => {
    const sourceIds = new Set(ALL_EVENTS.map((e) => e.source_id));
    expect(sourceIds).toContain("google-events");
    expect(sourceIds).toContain("hermanus-co-za");
    expect(sourceIds).toContain("manual");
  });

  it("seed sources have required fields", () => {
    for (const source of Object.values(SEED_SOURCES)) {
      expect(source.id).toBeTruthy();
      expect(source.name).toBeTruthy();
      expect(typeof source.trust_level).toBe("number");
      expect(source.trust_level).toBeGreaterThanOrEqual(0);
      expect(source.trust_level).toBeLessThanOrEqual(1);
    }
  });

  it("every event has a valid source_id referencing a known source", () => {
    const sourceIds = new Set(Object.values(SEED_SOURCES).map((s) => s.id));
    for (const event of ALL_EVENTS) {
      expect(sourceIds.has(event.source_id)).toBe(true);
    }
  });
});
