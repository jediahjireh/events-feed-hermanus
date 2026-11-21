/**
 * Temporal overlap logic — the core algorithm.
 *
 * Given a traveller's date range, determines which events overlap
 * and computes the next occurrence for recurring events.
 *
 * Handles all four temporal types: point, range, recurring, seasonal.
 */

import type { TemporalJson, RecurrenceJson } from "@/db/schema";

/**
 * Check if an event's temporal data overlaps with a travel date range.
 */
export function overlaps(
  temporal: TemporalJson,
  travelStart: Date,
  travelEnd: Date
): boolean {
  switch (temporal.type) {
    case "point":
      return overlapsPoint(temporal.start_date, travelStart, travelEnd);

    case "range":
      return overlapsRange(
        temporal.start_date,
        temporal.end_date,
        temporal.dates,
        travelStart,
        travelEnd
      );

    case "recurring":
      return overlapsRecurring(
        temporal.recurrence,
        temporal.start_date,
        temporal.end_date,
        travelStart,
        travelEnd
      );

    case "seasonal":
      return overlapsSeasonal(
        temporal.start_month,
        temporal.end_month,
        travelStart,
        travelEnd
      );
  }
}

/**
 * For recurring events, find the next occurrence within the travel range.
 * Returns null if no occurrence falls within the range.
 */
export function nextOccurrenceInRange(
  temporal: TemporalJson,
  travelStart: Date,
  travelEnd: Date
): Date | null {
  if (temporal.type !== "recurring" || !temporal.recurrence) return null;

  const occurrences = expandRecurrences(
    temporal.recurrence,
    temporal.start_date,
    temporal.end_date,
    travelStart,
    travelEnd
  );

  return occurrences.length > 0 ? occurrences[0] : null;
}

/**
 * For recurring events, return all occurrences within the travel range.
 */
export function allOccurrencesInRange(
  temporal: TemporalJson,
  travelStart: Date,
  travelEnd: Date
): Date[] {
  if (temporal.type !== "recurring" || !temporal.recurrence) return [];

  return expandRecurrences(
    temporal.recurrence,
    temporal.start_date,
    temporal.end_date,
    travelStart,
    travelEnd
  );
}

// --- Internal helpers ---

function overlapsPoint(
  startDate: string,
  travelStart: Date,
  travelEnd: Date
): boolean {
  const eventDate = parseDate(startDate);
  return eventDate >= travelStart && eventDate <= travelEnd;
}

function overlapsRange(
  startDate: string,
  endDate: string,
  dates: string[] | null,
  travelStart: Date,
  travelEnd: Date
): boolean {
  // If explicit dates array exists (multi-date event), check each date
  if (dates && dates.length > 0) {
    return dates.some((d) => {
      const date = parseDate(d);
      return date >= travelStart && date <= travelEnd;
    });
  }

  // Standard range overlap: start_date <= travel_end AND end_date >= travel_start
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  return start <= travelEnd && end >= travelStart;
}

function overlapsRecurring(
  recurrence: RecurrenceJson,
  startDate: string | null,
  endDate: string | null,
  travelStart: Date,
  travelEnd: Date
): boolean {
  const occurrences = expandRecurrences(
    recurrence,
    startDate,
    endDate,
    travelStart,
    travelEnd
  );
  return occurrences.length > 0;
}

function overlapsSeasonal(
  startMonth: number,
  endMonth: number,
  travelStart: Date,
  travelEnd: Date
): boolean {
  // Build a set of all months the traveller is present
  const travelMonths = getTravelMonths(travelStart, travelEnd);

  // Check if any travel month falls within the seasonal range
  for (const month of travelMonths) {
    if (monthInSeason(month, startMonth, endMonth)) {
      return true;
    }
  }
  return false;
}

/**
 * Expand a recurrence rule into actual dates within the given window.
 * Respects the event's start/end bounds and exception dates.
 */
function expandRecurrences(
  recurrence: RecurrenceJson,
  eventStart: string | null,
  eventEnd: string | null,
  windowStart: Date,
  windowEnd: Date
): Date[] {
  const exceptions = new Set(recurrence.exceptions ?? []);

  // The iteration window is the intersection of [eventStart, eventEnd] and [windowStart, windowEnd]
  const iterStart = eventStart
    ? maxDate(parseDate(eventStart), windowStart)
    : windowStart;
  const iterEnd = eventEnd
    ? minDate(parseDate(eventEnd), windowEnd)
    : windowEnd;

  if (iterStart > iterEnd) return [];

  const results: Date[] = [];
  const { frequency, day_of_week, interval } = recurrence;

  if (frequency === "weekly" && day_of_week !== null) {
    // Find the first occurrence of the target day on or after iterStart
    let current = new Date(iterStart);
    const targetDow = day_of_week; // 0=Mon, 6=Sun
    const jsDow = (targetDow + 1) % 7; // Convert to JS: 0=Sun, 1=Mon, ...6=Sat

    // Advance to the first target day
    const currentJsDow = current.getDay();
    const daysUntil = (jsDow - currentJsDow + 7) % 7;
    current.setDate(current.getDate() + daysUntil);

    while (current <= iterEnd) {
      const isoDate = toISODate(current);
      if (!exceptions.has(isoDate)) {
        results.push(new Date(current));
      }
      current.setDate(current.getDate() + 7 * interval);
    }
  } else if (frequency === "daily") {
    let current = new Date(iterStart);
    while (current <= iterEnd) {
      const isoDate = toISODate(current);
      if (!exceptions.has(isoDate)) {
        results.push(new Date(current));
      }
      current.setDate(current.getDate() + interval);
    }
  } else if (frequency === "monthly") {
    // For monthly, use the start date's day-of-month if available
    const dayOfMonth = eventStart
      ? parseDate(eventStart).getDate()
      : iterStart.getDate();

    let current = new Date(
      iterStart.getFullYear(),
      iterStart.getMonth(),
      dayOfMonth
    );

    // If this date is before iterStart, advance one interval
    if (current < iterStart) {
      current.setMonth(current.getMonth() + interval);
    }

    while (current <= iterEnd) {
      const isoDate = toISODate(current);
      if (!exceptions.has(isoDate)) {
        results.push(new Date(current));
      }
      current.setMonth(current.getMonth() + interval);
    }
  }

  return results;
}

/**
 * Get all months (1-12) that a travel range spans.
 */
function getTravelMonths(start: Date, end: Date): number[] {
  const months: number[] = [];
  const current = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

  while (current <= endMonth) {
    months.push(current.getMonth() + 1); // 1-indexed
    current.setMonth(current.getMonth() + 1);
  }

  return months;
}

/**
 * Check if a month (1-12) falls within a seasonal range.
 * Handles year-boundary wrap (e.g., Nov(11) to Feb(2)).
 */
function monthInSeason(
  month: number,
  startMonth: number,
  endMonth: number
): boolean {
  if (startMonth <= endMonth) {
    // Normal range: Jun(6) to Nov(11)
    return month >= startMonth && month <= endMonth;
  } else {
    // Wrapped range: Nov(11) to Feb(2) → Nov, Dec, Jan, Feb
    return month >= startMonth || month <= endMonth;
  }
}

// --- Date utilities ---

/**
 * Parse an ISO date string (YYYY-MM-DD) into a Date at midnight UTC.
 */
export function parseDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function maxDate(a: Date, b: Date): Date {
  return a > b ? a : b;
}

function minDate(a: Date, b: Date): Date {
  return a < b ? a : b;
}
