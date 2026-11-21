/**
 * Quicket adapter via Apify SA Events Scraper.
 *
 * Quicket has no public developer API (verified Nov 2026).
 * Uses the Apify SA Events Listings actor to fetch event data,
 * then filters for events near Hermanus or in Western Cape.
 */

import { fetchApifyActor } from "./apify";

/**
 * Output schema from gtnetworks~sa-events-listings actor.
 * Field names match the actor's actual dataset output (verified Nov 2026).
 */
export type RawApifyEvent = {
  title: string;
  startAt?: string; // UTC datetime
  endAt?: string;
  startAtLocal?: string; // Local datetime string
  venueName?: string;
  city?: string;
  province?: string;
  provinceCode?: string;
  category?: string;
  minPriceZar?: number;
  maxPriceZarCents?: number;
  isFree?: boolean;
  organiserName?: string;
  imageUrl?: string;
  url?: string; // Quicket event page URL
  sourceUrl?: string;
  soldOut?: boolean;
  matchKey?: string;
  scheduleCount?: number;
  scrapedAt?: string;
  id?: string;
  eventId?: number;
  source?: string;
};

const ACTOR_ID = "gtnetworks~sa-events-listings";

/**
 * Fetch events from the Apify SA Events Scraper.
 * Filters results for Hermanus / Western Cape.
 */
export async function fetchQuicketEvents(): Promise<RawApifyEvent[]> {
  return fetchApifyActor<RawApifyEvent>(
    ACTOR_ID,
    {
      // Actor input schema (verified Nov 2026 against actor docs)
      cities: ["Hermanus"],
      maxItems: 50,
      upcomingDays: 90,
    },
    (e) =>
      e.city?.toLowerCase().includes("hermanus") ||
      e.province?.toLowerCase().includes("western cape") ||
      e.venueName?.toLowerCase().includes("hermanus") ||
      false
  );
}
