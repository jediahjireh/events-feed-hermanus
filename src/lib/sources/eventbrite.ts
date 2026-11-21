/**
 * Eventbrite adapter via Apify actor.
 *
 * Scrapes Eventbrite events by search URL for Hermanus area.
 * Eventbrite's city slug format may not include small SA towns,
 * so we use a startUrl with a search query instead.
 *
 * Actor schema verified Nov 2026 against live API output.
 * Input requires startUrl as array of { url } objects (not plain strings).
 */

import { fetchApifyActor } from "./apify";

/**
 * Output schema from parseforge/eventbrite-scraper actor.
 * Verified against actual API response (Nov 2026).
 */
export type RawEventbriteEvent = {
  id?: string;
  eventbriteId?: string;
  title?: string;
  url?: string;
  summary?: string;
  description?: string | null;
  startDate?: string; // "2026-11-27"
  startTime?: string; // "15:00"
  startDateTime?: string; // "2026-11-27T15:00"
  endDate?: string;
  endTime?: string;
  endDateTime?: string;
  timezone?: string;
  duration?: string;
  isOnline?: boolean;
  venue?: Record<string, unknown>;
  organizer?: Record<string, unknown>;
  pricing?: Record<string, unknown>;
  imageUrl?: string;
  images?: unknown[];
  category?: string;
  subcategory?: string;
  format?: string;
  tags?: string[];
  status?: string;
  capacity?: number;
  attendeeCount?: number;
  isSoldOut?: boolean;
  hasAvailableTickets?: boolean;
  language?: string;
  ticketsUrl?: string;
};

const ACTOR_ID = "parseforge/eventbrite-scraper";

/** Check if an event's venue is in the Hermanus / Overstrand area. */
function isHermanusEvent(event: RawEventbriteEvent): boolean {
  const venue = event.venue as Record<string, unknown> | undefined;
  if (!venue) return false;

  const fields = [
    venue.city,
    venue.address,
    venue.name,
    event.title,
    event.summary,
  ]
    .filter(Boolean)
    .map((v) => String(v).toLowerCase());

  return fields.some(
    (f) =>
      f.includes("hermanus") ||
      f.includes("overstrand") ||
      f.includes("kleinmond") ||
      f.includes("stanford") ||
      f.includes("betty's bay") ||
      f.includes("bettys bay")
  );
}

/**
 * Fetch Eventbrite events near Hermanus.
 * Uses a search URL targeting the Hermanus area, then filters for local events.
 */
export async function fetchEventbriteEvents(): Promise<RawEventbriteEvent[]> {
  return fetchApifyActor<RawEventbriteEvent>(
    ACTOR_ID,
    {
      startUrl: [
        {
          url: "https://www.eventbrite.com/d/south-africa--hermanus/all-events/",
        },
      ],
      maxItems: 50,
    },
    isHermanusEvent
  );
}
