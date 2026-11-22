import { describe, it, expect } from "vitest";
import { trySeasonParse, findSeason, getSeasonLabel, getEffectiveRole } from "@/lib/season-dates";

/** Helper: create a date at noon to match the resolver output */
function d(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 12); // month is 1-indexed here for readability
}

describe("findSeason", () => {
  it("matches exact aliases case-insensitively", () => {
    expect(findSeason("winter")).not.toBeNull();
    expect(findSeason("Winter")).not.toBeNull();
    expect(findSeason("WINTER")).not.toBeNull();
    expect(findSeason("  winter  ")).not.toBeNull();
    expect(findSeason("whale season")).not.toBeNull();
    expect(findSeason("whale watching")).not.toBeNull();
    expect(findSeason("whales")).not.toBeNull();
    expect(findSeason("fall")).not.toBeNull();
    expect(findSeason("autumn")).not.toBeNull();
    expect(findSeason("festivals")).not.toBeNull();
  });

  it("returns null for non-season text", () => {
    expect(findSeason("tomorrow")).toBeNull();
    expect(findSeason("next friday")).toBeNull();
    expect(findSeason("dec 25")).toBeNull();
    expect(findSeason("win")).toBeNull();
    expect(findSeason("wint")).toBeNull();
    expect(findSeason("summertime")).toBeNull();
    expect(findSeason("")).toBeNull();
  });
});

describe("getSeasonLabel", () => {
  it("returns label for matching text", () => {
    expect(getSeasonLabel("winter")).toBe("Winter (Jun–Aug)");
    expect(getSeasonLabel("whale season")).toBe("Whale season (Jun–Nov)");
  });

  it("returns label for prefixed text", () => {
    expect(getSeasonLabel("start of winter")).toBe("Winter (Jun–Aug)");
    expect(getSeasonLabel("end of spring")).toBe("Spring (Sep–Nov)");
    expect(getSeasonLabel("early whale season")).toBe("Whale season (Jun–Nov)");
    expect(getSeasonLabel("late autumn")).toBe("Autumn (Mar–May)");
  });

  it("returns null for non-matching text", () => {
    expect(getSeasonLabel("asdf")).toBeNull();
  });
});

// ─── Same-year seasons (start and end in the same calendar year) ───

describe("winter (Jun–Aug) — same-year season", () => {
  it("resolves to current year when season hasn't ended yet", () => {
    const now = d(2027, 7, 15); // Jul 15, 2027 — mid-winter
    expect(trySeasonParse("winter", "start", now)).toEqual(d(2027, 6, 1));
    expect(trySeasonParse("winter", "end", now)).toEqual(d(2027, 8, 31));
  });

  it("resolves to next year when season has passed", () => {
    const now = d(2026, 11, 22); // Nov 22, 2026 — winter ended Aug 31
    expect(trySeasonParse("winter", "start", now)).toEqual(d(2027, 6, 1));
    expect(trySeasonParse("winter", "end", now)).toEqual(d(2027, 8, 31));
  });

  it("resolves to current year on the last day of the season", () => {
    const now = d(2027, 8, 31); // Aug 31, 2027 — last day of winter
    expect(trySeasonParse("winter", "start", now)).toEqual(d(2027, 6, 1));
    expect(trySeasonParse("winter", "end", now)).toEqual(d(2027, 8, 31));
  });

  it("resolves to next year the day after season ends", () => {
    const now = d(2027, 9, 1); // Sep 1, 2027 — day after winter
    expect(trySeasonParse("winter", "start", now)).toEqual(d(2028, 6, 1));
    expect(trySeasonParse("winter", "end", now)).toEqual(d(2028, 8, 31));
  });
});

describe("spring (Sep–Nov) — same-year season", () => {
  it("resolves to current year when in season", () => {
    const now = d(2026, 11, 22); // Nov 22, 2026 — late spring
    expect(trySeasonParse("spring", "start", now)).toEqual(d(2026, 9, 1));
    expect(trySeasonParse("spring", "end", now)).toEqual(d(2026, 11, 30));
  });

  it("resolves to next year when season has passed", () => {
    const now = d(2026, 12, 5); // Dec 5, 2026 — spring ended Nov 30
    expect(trySeasonParse("spring", "start", now)).toEqual(d(2027, 9, 1));
    expect(trySeasonParse("spring", "end", now)).toEqual(d(2027, 11, 30));
  });
});

describe("autumn/fall (Mar–May) — same-year season", () => {
  it("resolves via 'fall' alias", () => {
    const now = d(2027, 1, 15); // Jan 15, 2027 — before autumn
    expect(trySeasonParse("fall", "start", now)).toEqual(d(2027, 3, 1));
    expect(trySeasonParse("fall", "end", now)).toEqual(d(2027, 5, 31));
  });

  it("resolves to next year after autumn ends", () => {
    const now = d(2027, 6, 1); // Jun 1, 2027 — autumn ended May 31
    expect(trySeasonParse("autumn", "start", now)).toEqual(d(2028, 3, 1));
    expect(trySeasonParse("autumn", "end", now)).toEqual(d(2028, 5, 31));
  });
});

// ─── Cross-year season (summer: Dec–Feb) ───

describe("summer (Dec–Feb) — cross-year season", () => {
  it("Nov 22: next summer starts this Dec, ends next Feb", () => {
    const now = d(2026, 11, 22); // Nov 22, 2026 — before Dec
    expect(trySeasonParse("summer", "start", now)).toEqual(d(2026, 12, 1));
    expect(trySeasonParse("summer", "end", now)).toEqual(d(2027, 2, 28));
  });

  it("Dec 5: currently in summer that started this month", () => {
    const now = d(2026, 12, 5); // Dec 5, 2026
    expect(trySeasonParse("summer", "start", now)).toEqual(d(2026, 12, 1));
    expect(trySeasonParse("summer", "end", now)).toEqual(d(2027, 2, 28));
  });

  it("Jan 15: currently in summer that started last Dec", () => {
    const now = d(2027, 1, 15); // Jan 15, 2027 — inside summer
    expect(trySeasonParse("summer", "start", now)).toEqual(d(2026, 12, 1));
    expect(trySeasonParse("summer", "end", now)).toEqual(d(2027, 2, 28));
  });

  it("Feb 28: last day of summer, still in current occurrence", () => {
    const now = d(2027, 2, 28); // Feb 28, 2027 — last day
    expect(trySeasonParse("summer", "start", now)).toEqual(d(2026, 12, 1));
    expect(trySeasonParse("summer", "end", now)).toEqual(d(2027, 2, 28));
  });

  it("Mar 1: summer just ended, next starts this Dec", () => {
    const now = d(2027, 3, 1); // Mar 1, 2027 — day after summer
    expect(trySeasonParse("summer", "start", now)).toEqual(d(2027, 12, 1));
    expect(trySeasonParse("summer", "end", now)).toEqual(d(2028, 2, 28));
  });

  it("Jul 15: mid-year, next summer starts this Dec", () => {
    const now = d(2027, 7, 15); // Jul 15, 2027
    expect(trySeasonParse("summer", "start", now)).toEqual(d(2027, 12, 1));
    expect(trySeasonParse("summer", "end", now)).toEqual(d(2028, 2, 28));
  });
});

// ─── Hermanus-specific seasons ───

describe("whale season (Jun–Nov)", () => {
  it("resolves from all aliases", () => {
    const now = d(2027, 3, 1);
    expect(trySeasonParse("whale season", "start", now)).toEqual(d(2027, 6, 1));
    expect(trySeasonParse("whale watching", "start", now)).toEqual(d(2027, 6, 1));
    expect(trySeasonParse("whales", "start", now)).toEqual(d(2027, 6, 1));
  });

  it("resolves end to Nov 30", () => {
    const now = d(2027, 3, 1);
    expect(trySeasonParse("whale season", "end", now)).toEqual(d(2027, 11, 30));
  });
});

describe("festival season (Sep–Oct)", () => {
  it("resolves start to Sep 1 and end to Oct 31", () => {
    const now = d(2027, 3, 1);
    expect(trySeasonParse("festivals", "start", now)).toEqual(d(2027, 9, 1));
    expect(trySeasonParse("festivals", "end", now)).toEqual(d(2027, 10, 31));
  });
});

// ─── notBefore constraint (the bug the user hit: spring in To after winter in From) ───

describe("notBefore constraint", () => {
  it("spring in To picker bumps to 2027 when From is Jun 2027", () => {
    const now = d(2026, 11, 22); // Nov 22, 2026
    const fromDate = d(2027, 6, 1); // From = winter 2027 start

    // Without notBefore: spring resolves to 2026 (current spring)
    expect(trySeasonParse("spring", "end", now)).toEqual(d(2026, 11, 30));

    // With notBefore: should bump to 2027 since Nov 30 2026 < Jun 1 2027
    expect(trySeasonParse("spring", "end", now, fromDate)).toEqual(d(2027, 11, 30));
  });

  it("winter in From + whale season in To: end resolves to same year", () => {
    const now = d(2026, 11, 22);
    const fromDate = d(2027, 6, 1); // winter start

    // Whale season end is Nov 30 — same year as the from date
    expect(trySeasonParse("whale season", "end", now, fromDate)).toEqual(d(2027, 11, 30));
  });

  it("notBefore doesn't affect dates already past the floor", () => {
    const now = d(2027, 3, 1);
    const fromDate = d(2027, 1, 1); // Floor is Jan 1

    // Winter 2027 starts Jun 1, which is after Jan 1 — no bump needed
    expect(trySeasonParse("winter", "start", now, fromDate)).toEqual(d(2027, 6, 1));
  });

  it("summer cross-year with notBefore bumps correctly", () => {
    const now = d(2027, 5, 1); // May 2027 — between seasons
    const fromDate = d(2028, 1, 1); // Floor is Jan 2028

    // Summer without floor: Dec 2027 – Feb 2028
    expect(trySeasonParse("summer", "start", now)).toEqual(d(2027, 12, 1));
    expect(trySeasonParse("summer", "end", now)).toEqual(d(2028, 2, 28));

    // Summer end (Feb 2028) is after floor (Jan 2028) — no bump needed
    expect(trySeasonParse("summer", "end", now, fromDate)).toEqual(d(2028, 2, 28));

    // Summer start (Dec 2027) is before floor (Jan 2028) — bump to next occurrence
    expect(trySeasonParse("summer", "start", now, fromDate)).toEqual(d(2028, 12, 1));
  });
});

// ─── Time-of-day normalization (now at non-noon hours) ───

describe("time-of-day normalization", () => {
  it("resolves correctly on the last day of winter at 11 PM", () => {
    // new Date(2027, 7, 31, 23) = Aug 31, 2027 at 11 PM — still winter
    const now = new Date(2027, 7, 31, 23, 59, 59);
    expect(trySeasonParse("winter", "start", now)).toEqual(d(2027, 6, 1));
    expect(trySeasonParse("winter", "end", now)).toEqual(d(2027, 8, 31));
  });

  it("resolves correctly on the last day of summer at 11 PM (cross-year)", () => {
    // Feb 28, 2027 at 11 PM — still inside summer
    const now = new Date(2027, 1, 28, 23, 59, 59);
    expect(trySeasonParse("summer", "start", now)).toEqual(d(2026, 12, 1));
    expect(trySeasonParse("summer", "end", now)).toEqual(d(2027, 2, 28));
  });

  it("resolves correctly on the last day of spring at midnight", () => {
    // Nov 30, 2026 at midnight — still spring
    const now = new Date(2026, 10, 30, 0, 0, 0);
    expect(trySeasonParse("spring", "start", now)).toEqual(d(2026, 9, 1));
    expect(trySeasonParse("spring", "end", now)).toEqual(d(2026, 11, 30));
  });
});

// ─── Prefix overrides ("start of", "end of", "early", "late", "beginning of") ───

describe("findSeason with prefix overrides", () => {
  it("detects 'start of' prefix and sets roleOverride to start", () => {
    const match = findSeason("start of winter");
    expect(match).not.toBeNull();
    expect(match!.roleOverride).toBe("start");
    expect(match!.season.aliases).toContain("winter");
  });

  it("detects 'end of' prefix and sets roleOverride to end", () => {
    const match = findSeason("end of spring");
    expect(match).not.toBeNull();
    expect(match!.roleOverride).toBe("end");
    expect(match!.season.aliases).toContain("spring");
  });

  it("detects 'beginning of' prefix", () => {
    const match = findSeason("beginning of whale season");
    expect(match).not.toBeNull();
    expect(match!.roleOverride).toBe("start");
    expect(match!.season.aliases).toContain("whale season");
  });

  it("detects 'early' prefix as start", () => {
    const match = findSeason("early summer");
    expect(match).not.toBeNull();
    expect(match!.roleOverride).toBe("start");
    expect(match!.season.aliases).toContain("summer");
  });

  it("detects 'late' prefix as end", () => {
    const match = findSeason("late autumn");
    expect(match).not.toBeNull();
    expect(match!.roleOverride).toBe("end");
    expect(match!.season.aliases).toContain("autumn");
  });

  it("returns null roleOverride for bare season names", () => {
    const match = findSeason("winter");
    expect(match).not.toBeNull();
    expect(match!.roleOverride).toBeNull();
  });

  it("is case-insensitive with prefixes", () => {
    expect(findSeason("Start Of Winter")?.roleOverride).toBe("start");
    expect(findSeason("END OF SPRING")?.roleOverride).toBe("end");
    expect(findSeason("Early Summer")?.roleOverride).toBe("start");
    expect(findSeason("LATE AUTUMN")?.roleOverride).toBe("end");
  });

  it("returns null for prefix with non-season text", () => {
    expect(findSeason("start of tomorrow")).toBeNull();
    expect(findSeason("end of next week")).toBeNull();
    expect(findSeason("early lunch")).toBeNull();
  });
});

describe("trySeasonParse with prefix overrides", () => {
  it("'start of spring' in To picker resolves to start date, overriding end role", () => {
    const now = d(2027, 3, 1);
    // Without prefix, role="end" → Nov 30
    expect(trySeasonParse("spring", "end", now)).toEqual(d(2027, 11, 30));
    // With "start of" prefix, overrides to start → Sep 1
    expect(trySeasonParse("start of spring", "end", now)).toEqual(d(2027, 9, 1));
  });

  it("'end of winter' in From picker resolves to end date, overriding start role", () => {
    const now = d(2027, 3, 1);
    // Without prefix, role="start" → Jun 1
    expect(trySeasonParse("winter", "start", now)).toEqual(d(2027, 6, 1));
    // With "end of" prefix, overrides to end → Aug 31
    expect(trySeasonParse("end of winter", "start", now)).toEqual(d(2027, 8, 31));
  });

  it("'early whale season' resolves to start of whale season", () => {
    const now = d(2027, 3, 1);
    expect(trySeasonParse("early whale season", "end", now)).toEqual(d(2027, 6, 1));
  });

  it("'late whale season' resolves to end of whale season", () => {
    const now = d(2027, 3, 1);
    expect(trySeasonParse("late whale season", "start", now)).toEqual(d(2027, 11, 30));
  });

  it("'beginning of summer' resolves to Dec 1 (cross-year, start)", () => {
    const now = d(2027, 7, 15);
    expect(trySeasonParse("beginning of summer", "end", now)).toEqual(d(2027, 12, 1));
  });

  it("'end of summer' resolves to Feb 28 (cross-year, end)", () => {
    const now = d(2027, 7, 15);
    expect(trySeasonParse("end of summer", "start", now)).toEqual(d(2028, 2, 28));
  });

  it("prefix override works with notBefore constraint", () => {
    const now = d(2026, 11, 22);
    const fromDate = d(2027, 6, 1);

    // "start of spring" in To picker with notBefore = Jun 2027
    // Spring start is Sep 1 2026 without bump, but that's before Jun 2027 → bumps to Sep 1 2027
    expect(trySeasonParse("start of spring", "end", now, fromDate)).toEqual(d(2027, 9, 1));
  });
});

describe("getEffectiveRole", () => {
  it("returns picker role for bare season names", () => {
    expect(getEffectiveRole("winter", "start")).toBe("start");
    expect(getEffectiveRole("winter", "end")).toBe("end");
  });

  it("returns prefix override regardless of picker role", () => {
    expect(getEffectiveRole("start of winter", "end")).toBe("start");
    expect(getEffectiveRole("end of spring", "start")).toBe("end");
    expect(getEffectiveRole("early summer", "end")).toBe("start");
    expect(getEffectiveRole("late autumn", "start")).toBe("end");
  });

  it("returns null for non-season text", () => {
    expect(getEffectiveRole("tomorrow", "start")).toBeNull();
    expect(getEffectiveRole("next week", "end")).toBeNull();
  });
});

// ─── Non-matching input ───

describe("non-matching input returns null", () => {
  it("returns null for chrono-compatible phrases", () => {
    expect(trySeasonParse("tomorrow", "start")).toBeNull();
    expect(trySeasonParse("next friday", "end")).toBeNull();
    expect(trySeasonParse("dec 25", "start")).toBeNull();
  });

  it("returns null for partial matches", () => {
    expect(trySeasonParse("win", "start")).toBeNull();
    expect(trySeasonParse("sum", "start")).toBeNull();
    expect(trySeasonParse("whale", "start")).toBeNull(); // "whale" alone isn't an alias, "whales" is
  });

  it("returns null for empty input", () => {
    expect(trySeasonParse("", "start")).toBeNull();
    expect(trySeasonParse("  ", "start")).toBeNull();
  });
});
