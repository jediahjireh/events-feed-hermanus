/**
 * Fuzzy deduplication for events.
 *
 * Matches events across sources using normalised title similarity,
 * temporal overlap, and venue matching.
 *
 * Threshold: title similarity > 0.7 AND temporal overlap AND
 * (venue matches OR either venue is null).
 */

import type { TemporalJson, LocationJson } from "@/db/schema";

export type DedupCandidate = {
  id: string;
  title: string;
  temporal: TemporalJson;
  location: LocationJson;
};

export type DedupMatch = {
  match: DedupCandidate;
  confidence: number;
};

/**
 * Normalise a title for comparison:
 * lowercase, strip "the", remove punctuation, collapse whitespace.
 */
export function normaliseTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\bthe\b/gi, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Compute title similarity, normalised to 0-1.
 * Uses the max of Levenshtein similarity and token Dice coefficient,
 * since Levenshtein handles typos while Dice handles word reordering.
 * Dice is preferred over Jaccard for asymmetric set sizes (e.g.,
 * "FynArts Festival Hermanus 2027" vs "Hermanus FynArts 2027 Annual Arts Festival").
 */
export function titleSimilarity(a: string, b: string): number {
  const normA = normaliseTitle(a);
  const normB = normaliseTitle(b);

  if (normA === normB) return 1;
  if (normA.length === 0 || normB.length === 0) return 0;

  // Character-level: Levenshtein distance (handles typos)
  const distance = levenshtein(normA, normB);
  const maxLen = Math.max(normA.length, normB.length);
  const levenshteinSim = 1 - distance / maxLen;

  // Token-level: Dice coefficient (handles word reordering)
  const tokensA = new Set(normA.split(" ").filter(Boolean));
  const tokensB = new Set(normB.split(" ").filter(Boolean));
  const intersection = [...tokensA].filter((t) => tokensB.has(t)).length;
  const diceSim =
    tokensA.size + tokensB.size > 0
      ? (2 * intersection) / (tokensA.size + tokensB.size)
      : 0;

  return Math.max(levenshteinSim, diceSim);
}

/**
 * Check if two temporal objects overlap for dedup purposes.
 * Uses simplified logic — not full travel-range overlap,
 * but whether the events cover the same time period.
 *
 * Handles cross-type comparisons: a seasonal event (Jun-Nov) from one source
 * should match a recurring daily event from another source if they describe
 * the same real-world thing. Title similarity is the primary dedup gate —
 * temporal overlap just confirms they're in the same time window.
 */
export function temporalOverlap(a: TemporalJson, b: TemporalJson): boolean {
  // Both seasonal — compare month ranges
  if (a.type === "seasonal" && b.type === "seasonal") {
    if (a.start_month == null || a.end_month == null || b.start_month == null || b.end_month == null) return false;
    return monthRangesOverlap(
      a.start_month,
      a.end_month,
      b.start_month,
      b.end_month
    );
  }

  // One seasonal, one not — cross-type check
  if (a.type === "seasonal" || b.type === "seasonal") {
    const seasonal = a.type === "seasonal" ? a : b;
    const other = a.type === "seasonal" ? b : a;
    return seasonalCompatibleWith(seasonal, other);
  }

  // Extract date ranges for comparison
  const rangeA = extractDateRange(a);
  const rangeB = extractDateRange(b);

  if (!rangeA || !rangeB) {
    // Both recurring with no date bounds — check recurrence compatibility
    if (a.type === "recurring" && b.type === "recurring") {
      return recurrencesCompatible(a.recurrence!, b.recurrence!);
    }
    return false;
  }

  // Standard range overlap
  return rangeA.start <= rangeB.end && rangeA.end >= rangeB.start;
}

/**
 * Find potential duplicates for a new event among existing events.
 * Returns matches ranked by confidence.
 */
export function findDuplicates(
  newEvent: DedupCandidate,
  existingEvents: DedupCandidate[]
): DedupMatch[] {
  const matches: DedupMatch[] = [];

  for (const existing of existingEvents) {
    const similarity = titleSimilarity(newEvent.title, existing.title);
    if (similarity <= 0.7) continue;

    const hasTemporalOverlap = temporalOverlap(
      newEvent.temporal,
      existing.temporal
    );
    if (!hasTemporalOverlap) continue;

    const venueMatch = venuesMatch(newEvent.location, existing.location);
    if (!venueMatch) continue;

    // Composite confidence: weighted average of signals
    const confidence = similarity * 0.6 + (venueMatch ? 0.3 : 0) + 0.1;
    matches.push({ match: existing, confidence: Math.min(confidence, 1) });
  }

  // Sort by confidence descending
  matches.sort((a, b) => b.confidence - a.confidence);
  return matches;
}

// --- Internal helpers ---

/**
 * Check if venues match: both same, or either is null.
 */
function venuesMatch(a: LocationJson, b: LocationJson): boolean {
  if (!a.venue || !b.venue) return true; // null venue = unknown, don't penalise

  const normA = a.venue.toLowerCase().trim();
  const normB = b.venue.toLowerCase().trim();

  if (normA === normB) return true;

  // Fuzzy venue match — check if one contains the other
  return normA.includes(normB) || normB.includes(normA);
}

function extractDateRange(
  t: TemporalJson
): { start: string; end: string } | null {
  switch (t.type) {
    case "point":
      return { start: t.start_date, end: t.start_date };
    case "range":
      return { start: t.start_date, end: t.end_date };
    case "recurring":
      if (t.start_date && t.end_date)
        return { start: t.start_date, end: t.end_date };
      return null;
    case "seasonal":
      return null;
  }
}

function monthRangesOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number
): boolean {
  const monthsA = expandMonthRange(startA, endA);
  const monthsB = new Set(expandMonthRange(startB, endB));
  return monthsA.some((m) => monthsB.has(m));
}

function expandMonthRange(start: number, end: number): number[] {
  const months: number[] = [];
  if (start <= end) {
    for (let m = start; m <= end; m++) months.push(m);
  } else {
    // Wrapped: Nov(11) to Feb(2) → 11, 12, 1, 2
    for (let m = start; m <= 12; m++) months.push(m);
    for (let m = 1; m <= end; m++) months.push(m);
  }
  return months;
}

/**
 * Check if a non-seasonal event falls within a seasonal event's month range.
 * Handles cross-type dedup: "Hermanus Whale Cruises" as seasonal (Jun-Nov) from
 * one source and recurring (daily) from another should be detected as duplicates.
 */
function seasonalCompatibleWith(
  seasonal: TemporalJson,
  other: TemporalJson
): boolean {
  if (seasonal.start_month == null || seasonal.end_month == null) return false;
  const seasonalMonths = new Set(
    expandMonthRange(seasonal.start_month, seasonal.end_month)
  );

  // Recurring with no bounds = year-round → always compatible
  if (other.type === "recurring" && !other.start_date && !other.end_date) {
    return true;
  }

  // Point: check if the event date's month falls in the seasonal range
  if (other.type === "point" && other.start_date) {
    const month = parseInt(other.start_date.split("-")[1], 10);
    return seasonalMonths.has(month);
  }

  // Range: check if either endpoint's month falls in the seasonal range
  if (other.type === "range" && other.start_date) {
    const startMonth = parseInt(other.start_date.split("-")[1], 10);
    const endMonth = other.end_date
      ? parseInt(other.end_date.split("-")[1], 10)
      : startMonth;
    return seasonalMonths.has(startMonth) || seasonalMonths.has(endMonth);
  }

  // Recurring with bounds: check if the start month is in seasonal range
  if (other.type === "recurring" && other.start_date) {
    const startMonth = parseInt(other.start_date.split("-")[1], 10);
    return seasonalMonths.has(startMonth);
  }

  return false;
}

/**
 * Check if two recurrences are compatible for dedup purposes.
 * More permissive than exact match: daily subsumes weekly/monthly
 * (a daily event "contains" any weekly occurrence), and same
 * day_of_week with compatible frequencies match.
 */
function recurrencesCompatible(
  a: NonNullable<TemporalJson["recurrence"]>,
  b: NonNullable<TemporalJson["recurrence"]>
): boolean {
  // Exact match
  if (
    a.frequency === b.frequency &&
    a.day_of_week === b.day_of_week &&
    a.interval === b.interval
  ) {
    return true;
  }

  // Daily subsumes all frequencies (a daily event "contains" any weekly/monthly)
  if (a.frequency === "daily" || b.frequency === "daily") {
    return true;
  }

  // Weekly events on the same day
  if (
    a.frequency === "weekly" &&
    b.frequency === "weekly" &&
    a.day_of_week === b.day_of_week
  ) {
    return true;
  }

  return false;
}

/**
 * Levenshtein distance between two strings.
 * Uses the classic dynamic programming approach.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  // Use single-row DP for space efficiency
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n];
}
