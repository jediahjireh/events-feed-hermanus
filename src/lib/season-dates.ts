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

/** Prefixes that override the picker's default role */
const START_PREFIXES = ["start of ", "beginning of ", "early "];
const END_PREFIXES = ["end of ", "late "];

export interface SeasonMatch {
  season: SeasonDef;
  /** Explicit role override from prefix, or null to use the picker's default */
  roleOverride: "start" | "end" | null;
}

/**
 * Find a season definition matching the given text (case-insensitive, trimmed).
 * Supports optional prefixes like "start of winter", "end of spring", "early whale season".
 */
export function findSeason(text: string): SeasonMatch | null {
  const normalized = text.trim().toLowerCase();

  // Try with start/end prefix first
  for (const prefix of START_PREFIXES) {
    if (normalized.startsWith(prefix)) {
      const rest = normalized.slice(prefix.length);
      const season = SEASONS.find((s) => s.aliases.some((a) => a === rest));
      if (season) return { season, roleOverride: "start" };
    }
  }
  for (const prefix of END_PREFIXES) {
    if (normalized.startsWith(prefix)) {
      const rest = normalized.slice(prefix.length);
      const season = SEASONS.find((s) => s.aliases.some((a) => a === rest));
      if (season) return { season, roleOverride: "end" };
    }
  }

  // Try bare season name
  const season = SEASONS.find((s) => s.aliases.some((a) => a === normalized));
  if (season) return { season, roleOverride: null };

  return null;
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
  // Normalize now to noon so comparisons aren't affected by time-of-day.
  // Without this, a user on the last day of a season after noon would see
  // the resolution jump to the next year's occurrence.
  const noon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const isCrossYear = season.end[0] < season.start[0]; // e.g., summer: end month (1=Feb) < start month (11=Dec)

  let result: Date;

  if (isCrossYear) {
    result = resolveCrossYear(season, role, noon);
  } else {
    result = resolveSameYear(season, role, noon);
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
 *
 * If the input contains a prefix like "start of" or "end of", that overrides
 * the default role from the picker. Otherwise, the picker's role is used.
 *
 * Examples:
 *   trySeasonParse("winter", "start")        → Jun 1 (picker default)
 *   trySeasonParse("winter", "end")          → Aug 31 (picker default)
 *   trySeasonParse("end of winter", "start") → Aug 31 (prefix overrides)
 *   trySeasonParse("start of spring", "end") → Sep 1 (prefix overrides)
 */
export function trySeasonParse(
  text: string,
  role: "start" | "end",
  now?: Date,
  notBefore?: Date,
): Date | null {
  const match = findSeason(text);
  if (!match) return null;
  const effectiveRole = match.roleOverride ?? role;
  return resolveSeasonDate(match.season, effectiveRole, now, notBefore);
}

/**
 * Get the display label for a matching season, or null.
 * Includes the role override if a prefix was used.
 */
export function getSeasonLabel(text: string): string | null {
  const match = findSeason(text);
  if (!match) return null;
  return match.season.label;
}

/**
 * Get the effective role for display purposes.
 * Returns the prefix override if present, otherwise the picker's default role.
 */
export function getEffectiveRole(text: string, pickerRole: "start" | "end"): "start" | "end" | null {
  const match = findSeason(text);
  if (!match) return null;
  return match.roleOverride ?? pickerRole;
}
