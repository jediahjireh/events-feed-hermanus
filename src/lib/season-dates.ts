/**
 * Season date resolution for Hermanus / South Africa (Southern Hemisphere).
 *
 * Maps season names to date ranges. Used by the natural language date picker
 * to resolve inputs like "winter", "whale season", "autumn" to concrete dates.
 *
 * Key design decisions:
 * - Months are 0-indexed (0=Jan, 11=Dec) to match JS Date constructor.
 * - Cross-year seasons (summer: Dec–Feb) are handled explicitly.
 * - Forward-looking: if a season has fully passed, returns the next occurrence.
 * - Respects an optional `notBefore` floor so "spring" in a To picker won't
 *   resolve to a date before the From date.
 */

export interface SeasonDef {
  aliases: string[];
  /** [month, day] — 0-indexed month */
  start: [number, number];
  /** [month, day] — 0-indexed month */
  end: [number, number];
  label: string;
}

export const SEASONS: SeasonDef[] = [
  { aliases: ["summer"],                                    start: [11, 1],  end: [1, 28],   label: "Summer (Dec–Feb)" },
  { aliases: ["autumn", "fall"],                            start: [2, 1],   end: [4, 31],   label: "Autumn (Mar–May)" },
  { aliases: ["winter"],                                    start: [5, 1],   end: [7, 31],   label: "Winter (Jun–Aug)" },
  { aliases: ["spring"],                                    start: [8, 1],   end: [10, 30],  label: "Spring (Sep–Nov)" },
  { aliases: ["whale season", "whale watching", "whales"],  start: [5, 1],   end: [10, 30],  label: "Whale season (Jun–Nov)" },
  { aliases: ["festival season", "festivals"],              start: [8, 1],   end: [9, 31],   label: "Festival season (Sep–Oct)" },
];

/**
 * Find a season definition matching the given text (case-insensitive, trimmed).
 */
export function findSeason(text: string): SeasonDef | null {
  const normalized = text.trim().toLowerCase();
  return SEASONS.find((s) => s.aliases.some((a) => a === normalized)) ?? null;
}

/**
 * Resolve a season to a concrete date.
 *
 * @param season - The season definition
 * @param role - "start" returns the season's opening date, "end" returns the closing date
 * @param now - Reference date for forward-looking logic (defaults to current date)
 * @param notBefore - Optional floor: if the resolved date is before this, bump to the next occurrence
 */
export function resolveSeasonDate(
  season: SeasonDef,
  role: "start" | "end",
  now: Date = new Date(),
  notBefore?: Date,
): Date {
  const isCrossYear = season.end[0] < season.start[0]; // e.g., summer: end month (1=Feb) < start month (11=Dec)

  let result: Date;

  if (isCrossYear) {
    result = resolveCrossYear(season, role, now);
  } else {
    result = resolveSameYear(season, role, now);
  }

  // If the result is before the floor, bump to the next year's occurrence
  if (notBefore && result < notBefore) {
    const bumped = isCrossYear
      ? resolveCrossYear(season, role, addOneYear(result))
      : resolveSameYear(season, role, addOneYear(result));
    result = bumped;
  }

  return result;
}

/**
 * Same-year season (start and end in the same calendar year).
 * e.g., winter (Jun–Aug), spring (Sep–Nov)
 */
function resolveSameYear(season: SeasonDef, role: "start" | "end", now: Date): Date {
  let year = now.getFullYear();

  // If the season's end has passed this year, use next year
  const endOfSeason = new Date(year, season.end[0], season.end[1], 12);
  if (now > endOfSeason) year++;

  if (role === "start") {
    return new Date(year, season.start[0], season.start[1], 12);
  }
  return new Date(year, season.end[0], season.end[1], 12);
}

/**
 * Cross-year season (starts in one calendar year, ends in the next).
 * e.g., summer (Dec Y – Feb Y+1)
 *
 * Three scenarios based on where `now` falls:
 * 1. now is in the "end" months (Jan–Feb): we're in an occurrence that started last year
 * 2. now is in the "start" month (Dec): we're in an occurrence starting this year
 * 3. now is between (Mar–Nov): next occurrence starts this year's Dec
 */
function resolveCrossYear(season: SeasonDef, role: "start" | "end", now: Date): Date {
  const year = now.getFullYear();
  const month = now.getMonth();

  // Case 1: We're in the end portion (e.g., Jan–Feb) — currently inside the season
  if (month <= season.end[0]) {
    const endOfCurrent = new Date(year, season.end[0], season.end[1], 12);
    if (now <= endOfCurrent) {
      // Inside the season that started last year
      const startYear = year - 1;
      return role === "start"
        ? new Date(startYear, season.start[0], season.start[1], 12)
        : new Date(year, season.end[0], season.end[1], 12);
    }
  }

  // Case 2: We're in the start month (e.g., Dec) — currently inside or at the start
  if (month >= season.start[0]) {
    return role === "start"
      ? new Date(year, season.start[0], season.start[1], 12)
      : new Date(year + 1, season.end[0], season.end[1], 12);
  }

  // Case 3: Between seasons (e.g., Mar–Nov) — next occurrence starts this year
  return role === "start"
    ? new Date(year, season.start[0], season.start[1], 12)
    : new Date(year + 1, season.end[0], season.end[1], 12);
}

/** Advance a date by one year (for bumping past a notBefore floor) */
function addOneYear(date: Date): Date {
  return new Date(date.getFullYear() + 1, date.getMonth(), date.getDate(), 12);
}

/**
 * Convenience: parse text, resolve, return Date or null.
 */
export function trySeasonParse(
  text: string,
  role: "start" | "end",
  now?: Date,
  notBefore?: Date,
): Date | null {
  const season = findSeason(text);
  if (!season) return null;
  return resolveSeasonDate(season, role, now, notBefore);
}

/**
 * Get the display label for a matching season, or null.
 */
export function getSeasonLabel(text: string): string | null {
  return findSeason(text)?.label ?? null;
}
