/**
 * Facebook Events adapter via Apify actor.
 *
 * Most Hermanus event organisers post on Facebook, but the Graph API
 * severely restricts event search since 2019. This actor bypasses
 * that restriction entirely — a proxy layer for restricted APIs.
 *
 * Discovered while browsing the Apify store; directly addresses the gap
 * documented in the pen-and-paper design notes under "What we can't get."
 *
 * Actor schema verified Nov 2026 against live API output.
 * Note: when no events are found, the actor returns { error: "no_items" }
 * in the dataset — the filter excludes these non-event items.
 */

import { fetchApifyActor } from "./apify";

/**
 * Output schema from apify/facebook-events-scraper actor.
 */
export type RawFacebookEvent = {
  url?: string;
  id?: string;
  name: string;
  description?: string;
  address?: string;
  startTime?: string; // display format
  utcStartDate?: string; // ISO 8601
  duration?: string;
  imageUrl?: string;
  usersGoing?: number;
  usersInterested?: number;
  location?: Record<string, unknown>;
  organizedBy?: string;
  ticketsInfo?: Record<string, unknown>;
  eventType?: string;
  isPast?: boolean;
  isCanceled?: boolean;
  isOnline?: boolean;
};

const ACTOR_ID = "apify/facebook-events-scraper";

/**
 * Fetch Facebook events near Hermanus.
 * Filters out past and cancelled events, and online-only events.
 */
export async function fetchFacebookEvents(): Promise<RawFacebookEvent[]> {
  return fetchApifyActor<RawFacebookEvent>(
    ACTOR_ID,
    {
      searchQueries: ["events in Hermanus South Africa"],
      maxEvents: 50,
    },
    (e) =>
      // Exclude error responses (actor returns { error: "no_items" } when empty)
      !!e.name &&
      !("error" in e) &&
      !e.isPast &&
      !e.isCanceled &&
      !e.isOnline
  );
}
