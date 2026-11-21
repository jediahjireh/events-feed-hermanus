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
 * Check if two temporal objects overlap.
 * Uses simplified logic — not full travel-range overlap,
 * but whether the events cover the same time period.
 */
export function temporalOverlap(a: TemporalJson, b: TemporalJson): boolean {
  // Same type is a strong signal
  if (a.type === "seasonal" && b.type === "seasonal") {
    return monthRangesOverlap(
      a.start_month,
      a.end_month,
      b.start_month,
      b.end_month
    );
  }

  // Extract date ranges for comparison
  const rangeA = extractDateRange(a);
  const rangeB = extractDateRange(b);

  if (!rangeA || !rangeB) {
    // If we can't extract dates, check by type compatibility
    if (a.type === "seasonal" || b.type === "seasonal") return false;
    if (a.type === "recurring" && b.type === "recurring") {
      return recurrencesMatch(a.recurrence!, b.recurrence!);
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

function recurrencesMatch(
  a: NonNullable<TemporalJson["recurrence"]>,
  b: NonNullable<TemporalJson["recurrence"]>
): boolean {
  return (
    a.frequency === b.frequency &&
    a.day_of_week === b.day_of_week &&
    a.interval === b.interval
  );
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
