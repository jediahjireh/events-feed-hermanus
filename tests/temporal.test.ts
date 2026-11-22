import { describe, it, expect } from "vitest";
import {
  overlaps,
  nextOccurrenceInRange,
  allOccurrencesInRange,
  parseDate,
} from "@/lib/temporal";
import type { TemporalJson } from "@/db/schema";

// --- Test data matching DESIGN.md ---

const whaleWatching: TemporalJson = {
  type: "seasonal",
  start_date: null,
  end_date: null,
  start_month: 6, // June
  end_month: 11, // November
  recurrence: null,
  dates: null,
};

const saturdayMarket: TemporalJson = {
  type: "recurring",
  start_date: null,
  end_date: null,
  start_month: null,
  end_month: null,
  recurrence: {
    frequency: "weekly",
    day_of_week: 5, // Saturday (0=Mon, 5=Sat)
    interval: 1,
    exceptions: [],
  },
  dates: null,
};

const whaleFestival: TemporalJson = {
  type: "range",
  start_date: "2027-09-27",
  end_date: "2027-09-28",
  start_month: null,
  end_month: null,
  recurrence: null,
  dates: null,
};

const fynArts: TemporalJson = {
  type: "range",
  start_date: "2027-06-11",
  end_date: "2027-06-15",
  start_month: null,
  end_month: null,
  recurrence: null,
  dates: null,
};

const wineDinner: TemporalJson = {
  type: "point",
  start_date: "2027-09-18",
  end_date: null,
  start_month: null,
  end_month: null,
  recurrence: null,
  dates: null,
};

// --- Hand-worked Case 1: Luxury couple, 14-21 Sep 2027 ---

describe("Case 1: Luxury couple, 14-21 Sep 2027", () => {
  const travelStart = parseDate("2027-09-14");
  const travelEnd = parseDate("2027-09-21");

  it("whale watching season overlaps (seasonal, Jun-Nov)", () => {
    expect(overlaps(whaleWatching, travelStart, travelEnd)).toBe(true);
  });

  it("Saturday market overlaps (recurring, Sat 20 Sep)", () => {
    expect(overlaps(saturdayMarket, travelStart, travelEnd)).toBe(true);
  });

  it("whale festival does NOT overlap (27-28 Sep outside range)", () => {
    expect(overlaps(whaleFestival, travelStart, travelEnd)).toBe(false);
  });

  it("FynArts does NOT overlap (June, not September)", () => {
    expect(overlaps(fynArts, travelStart, travelEnd)).toBe(false);
  });

  it("wine dinner overlaps (point, 18 Sep within range)", () => {
    expect(overlaps(wineDinner, travelStart, travelEnd)).toBe(true);
  });

  it("market next occurrence is Sat 18 Sep 2027", () => {
    // Sep 14 2027 = Tuesday. First Saturday after = Sep 18.
    const next = nextOccurrenceInRange(saturdayMarket, travelStart, travelEnd);
    expect(next).not.toBeNull();
    expect(next!.toISOString().slice(0, 10)).toBe("2027-09-18");
  });
});

// Market next occurrence — programmatic check for Saturday matching
describe("Case 1 (corrected): Market next occurrence", () => {
  const travelStart = parseDate("2027-09-14");
  const travelEnd = parseDate("2027-09-21");

  it("market has at least one Saturday in the range", () => {
    const all = allOccurrencesInRange(saturdayMarket, travelStart, travelEnd);
    expect(all.length).toBeGreaterThan(0);

    // Verify all returned dates are Saturdays (JS: 6=Saturday)
    for (const d of all) {
      expect(d.getUTCDay()).toBe(6); // Saturday in JS Date = 6
    }
  });
});

// --- Hand-worked Case 2: Family, June 2027 ---

describe("Case 2: Family, full month of June 2027", () => {
  const travelStart = parseDate("2027-06-01");
  const travelEnd = parseDate("2027-06-30");

  it("whale watching season overlaps (seasonal, Jun-Nov)", () => {
    expect(overlaps(whaleWatching, travelStart, travelEnd)).toBe(true);
  });

  it("FynArts overlaps (range, mid-June)", () => {
    expect(overlaps(fynArts, travelStart, travelEnd)).toBe(true);
  });

  it("Saturday market has 4 occurrences in June 2027", () => {
    const all = allOccurrencesInRange(saturdayMarket, travelStart, travelEnd);
    // June 2027: Jun 5, 12, 19, 26 are Saturdays
    expect(all.length).toBeGreaterThanOrEqual(4);
  });

  it("whale festival does NOT overlap (Sep, not June)", () => {
    expect(overlaps(whaleFestival, travelStart, travelEnd)).toBe(false);
  });
});

// --- Edge cases ---

describe("Edge case: seasonal year-boundary wrap (Nov-Feb)", () => {
  const summerSeason: TemporalJson = {
    type: "seasonal",
    start_date: null,
    end_date: null,
    start_month: 11, // November
    end_month: 2, // February
    recurrence: null,
    dates: null,
  };

  it("December falls within Nov-Feb season", () => {
    const start = parseDate("2027-12-01");
    const end = parseDate("2027-12-31");
    expect(overlaps(summerSeason, start, end)).toBe(true);
  });

  it("January falls within Nov-Feb season", () => {
    const start = parseDate("2028-01-01");
    const end = parseDate("2028-01-31");
    expect(overlaps(summerSeason, start, end)).toBe(true);
  });

  it("February falls within Nov-Feb season", () => {
    const start = parseDate("2028-02-01");
    const end = parseDate("2028-02-28");
    expect(overlaps(summerSeason, start, end)).toBe(true);
  });

  it("March does NOT fall within Nov-Feb season", () => {
    const start = parseDate("2028-03-01");
    const end = parseDate("2028-03-31");
    expect(overlaps(summerSeason, start, end)).toBe(false);
  });

  it("October does NOT fall within Nov-Feb season", () => {
    const start = parseDate("2027-10-01");
    const end = parseDate("2027-10-31");
    expect(overlaps(summerSeason, start, end)).toBe(false);
  });

  it("travel spanning Oct-Dec partially overlaps Nov-Feb season", () => {
    const start = parseDate("2027-10-15");
    const end = parseDate("2027-12-15");
    expect(overlaps(summerSeason, start, end)).toBe(true);
  });
});

describe("Edge case: recurring event with exception on matching date", () => {
  // Sep 14 2027 = Tuesday. Saturdays in Sep: 4, 11, 18, 25.

  it("exception date is excluded from occurrences", () => {
    const marketWithException: TemporalJson = {
      type: "recurring",
      start_date: null,
      end_date: null,
      start_month: null,
      end_month: null,
      recurrence: {
        frequency: "weekly",
        day_of_week: 5, // Saturday
        interval: 1,
        exceptions: ["2027-09-18"], // Skip this Saturday
      },
      dates: null,
    };

    // Sep 18 is the only Saturday in this range, and it's excepted
    const travelStart = parseDate("2027-09-16");
    const travelEnd = parseDate("2027-09-21");

    const all = allOccurrencesInRange(
      marketWithException,
      travelStart,
      travelEnd
    );
    expect(all.length).toBe(0);
    expect(overlaps(marketWithException, travelStart, travelEnd)).toBe(false);
  });

  it("non-exception dates still match", () => {
    const marketWithException: TemporalJson = {
      type: "recurring",
      start_date: null,
      end_date: null,
      start_month: null,
      end_month: null,
      recurrence: {
        frequency: "weekly",
        day_of_week: 5, // Saturday
        interval: 1,
        exceptions: ["2027-09-18"], // Skip one Saturday
      },
      dates: null,
    };

    // Wider range that includes other Saturdays
    const travelStart = parseDate("2027-09-14");
    const travelEnd = parseDate("2027-09-28");

    const all = allOccurrencesInRange(
      marketWithException,
      travelStart,
      travelEnd
    );
    // Saturdays: (18 excluded), 25
    expect(all.length).toBe(1);
    expect(all.map((d) => d.toISOString().slice(0, 10))).not.toContain(
      "2027-09-18"
    );
    expect(all.map((d) => d.toISOString().slice(0, 10))).toContain(
      "2027-09-25"
    );
  });
});

describe("Edge case: single-day travel range", () => {
  it("matches a point event on that exact day", () => {
    const start = parseDate("2027-09-18");
    const end = parseDate("2027-09-18");
    expect(overlaps(wineDinner, start, end)).toBe(true);
  });

  it("does not match a point event on a different day", () => {
    const start = parseDate("2027-09-19");
    const end = parseDate("2027-09-19");
    expect(overlaps(wineDinner, start, end)).toBe(false);
  });

  it("matches a range event that spans the day", () => {
    const start = parseDate("2027-09-27");
    const end = parseDate("2027-09-27");
    expect(overlaps(whaleFestival, start, end)).toBe(true);
  });

  it("matches seasonal if the day's month is in season", () => {
    const start = parseDate("2027-07-15");
    const end = parseDate("2027-07-15");
    expect(overlaps(whaleWatching, start, end)).toBe(true);
  });

  it("does not match seasonal if month is out of season", () => {
    const start = parseDate("2027-03-15");
    const end = parseDate("2027-03-15");
    expect(overlaps(whaleWatching, start, end)).toBe(false);
  });
});

describe("Edge case: travel range spanning month boundary", () => {
  it("seasonal matches when range crosses into a seasonal month", () => {
    // Travel May 25 - Jun 5. May is out of season, June is in season.
    const start = parseDate("2027-05-25");
    const end = parseDate("2027-06-05");
    expect(overlaps(whaleWatching, start, end)).toBe(true);
  });

  it("seasonal does not match when range is entirely outside season", () => {
    // Travel Dec 25 - Jan 5. Both months outside Jun-Nov.
    const start = parseDate("2027-12-25");
    const end = parseDate("2028-01-05");
    expect(overlaps(whaleWatching, start, end)).toBe(false);
  });

  it("range event overlaps when travel range crosses event boundary", () => {
    // Travel Jun 14-18. FynArts is Jun 11-15.
    const start = parseDate("2027-06-14");
    const end = parseDate("2027-06-18");
    expect(overlaps(fynArts, start, end)).toBe(true);
  });
});

describe("Multi-date events (dates array)", () => {
  const theatreShow: TemporalJson = {
    type: "range",
    start_date: "2027-06-01",
    end_date: "2027-08-31",
    start_month: null,
    end_month: null,
    recurrence: null,
    dates: [
      "2027-06-05",
      "2027-06-12",
      "2027-07-03",
      "2027-07-17",
      "2027-08-14",
    ],
  };

  it("matches when a specific date falls in the travel range", () => {
    const start = parseDate("2027-07-01");
    const end = parseDate("2027-07-10");
    expect(overlaps(theatreShow, start, end)).toBe(true);
  });

  it("does not match when no specific date falls in the travel range", () => {
    const start = parseDate("2027-07-04");
    const end = parseDate("2027-07-16");
    expect(overlaps(theatreShow, start, end)).toBe(false);
  });

  it("matches exact date boundary", () => {
    const start = parseDate("2027-06-05");
    const end = parseDate("2027-06-05");
    expect(overlaps(theatreShow, start, end)).toBe(true);
  });
});

describe("Recurring with bounded date range", () => {
  const boundedMarket: TemporalJson = {
    type: "recurring",
    start_date: "2027-06-01",
    end_date: "2027-08-31",
    start_month: null,
    end_month: null,
    recurrence: {
      frequency: "weekly",
      day_of_week: 5, // Saturday
      interval: 1,
      exceptions: [],
    },
    dates: null,
  };

  it("matches within the bounded range", () => {
    const start = parseDate("2027-07-01");
    const end = parseDate("2027-07-31");
    expect(overlaps(boundedMarket, start, end)).toBe(true);
  });

  it("does not match outside the bounded range", () => {
    const start = parseDate("2027-09-01");
    const end = parseDate("2027-09-30");
    expect(overlaps(boundedMarket, start, end)).toBe(false);
  });
});

describe("Daily recurring events", () => {
  const dailyEvent: TemporalJson = {
    type: "recurring",
    start_date: "2027-06-01",
    end_date: "2027-06-30",
    start_month: null,
    end_month: null,
    recurrence: {
      frequency: "daily",
      day_of_week: null,
      interval: 1,
      exceptions: [],
    },
    dates: null,
  };

  it("matches any day within the event range", () => {
    const start = parseDate("2027-06-15");
    const end = parseDate("2027-06-15");
    expect(overlaps(dailyEvent, start, end)).toBe(true);
  });

  it("every-other-day event skips days correctly", () => {
    const everyOtherDay: TemporalJson = {
      type: "recurring",
      start_date: "2027-06-01",
      end_date: "2027-06-10",
      start_month: null,
      end_month: null,
      recurrence: {
        frequency: "daily",
        day_of_week: null,
        interval: 2,
        exceptions: [],
      },
      dates: null,
    };

    const start = parseDate("2027-06-01");
    const end = parseDate("2027-06-10");
    const all = allOccurrencesInRange(everyOtherDay, start, end);
    // Jun 1, 3, 5, 7, 9
    expect(all.length).toBe(5);
  });
});
