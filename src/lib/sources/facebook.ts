/**
 * Facebook Events adapter via Apify actor.
 *
 * Most Hermanus event organisers post on Facebook, but the Graph API
 * severely restricts event search since 2019. This actor attempts to
 * bypass that restriction via anonymous GraphQL scraping.
 *
 * WARNING: As of Nov 2026, this actor frequently hits Facebook's
 * "Rate limit exceeded" error on anonymous searches (11/11 retries
 * failed in testing). Keep the adapter in place — Facebook is where
 * most Hermanus organisers post — but expect intermittent failures.
 * The ingest pipeline handles fetch errors gracefully (marks run as failed).
 *
 * Uses multiple search queries to maximise coverage when it does work:
 * - "Hermanus events" for direct matches
 * - "Overberg events" for broader regional coverage
 * - "Hermanus market" for the popular markets (Old Harbour, Sandbaai, etc.)
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
      searchQueries: [
        "Hermanus events",
        "Overberg events",
        "Hermanus market",
      ],
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
