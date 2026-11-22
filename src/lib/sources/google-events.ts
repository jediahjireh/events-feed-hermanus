/**
 * Google Events adapter via SerpAPI.
 *
 * Uses SerpAPI's Google Events engine (udm=54 mobile events vertical)
 * to fetch events from Google's events search for Hermanus.
 *
 * SerpAPI confirmed to return Hermanus events reliably (Nov 2026).
 * Previously used Apify actor (johnvc/google-events-api) but it returned
 * sparse/empty results for Hermanus.
 *
 * API docs: https://serpapi.com/google-events-api
 */

import { fetchSerpApi } from "./serpapi";

/**
 * A single event from the SerpAPI Google Events response.
 * Matches the events_results[] schema from the API.
 */
export type RawGoogleEvent = {
  title: string;
  type?: string; // e.g. "Christmas variety show", "Live rock concert"
  date?: {
    start_date?: string; // e.g. "Dec 3"
    when?: string; // e.g. "Dec 3, 6:00 PM"
  };
  venue?: {
    name?: string;
    link?: string;
  };
  address?: string[]; // e.g. ["Hermanus Golf Club", "Hermanus, South Africa"]
  ticket_info?: { source?: string; link?: string; link_type?: string }[];
  thumbnail?: string;
  event_token?: string;
  price?: string;
  extracted_price?: number;
};

/**
 * Fetch events from Google Events via SerpAPI.
 * Runs two queries — default "upcoming" plus next year — to widen coverage.
 * Google Events has no date filter param, so year-specific search terms
 * are the best way to reach events further out (travel planners book 6–18 months ahead).
 * Dedup by event_token to avoid duplicates across queries.
 */
export async function fetchGoogleEvents(): Promise<RawGoogleEvent[]> {
  const nextYear = new Date().getFullYear() + 1;
  const extract = (body: Record<string, unknown>) =>
    (body.events_results as RawGoogleEvent[]) ?? [];

  const [defaultResults, futureResults] = await Promise.all([
    fetchSerpApi<RawGoogleEvent>("google_events", { q: "Events in Hermanus" }, extract),
    fetchSerpApi<RawGoogleEvent>("google_events", { q: `Events in Hermanus ${nextYear}` }, extract),
  ]);

  // Dedup by event_token (SerpAPI's unique event ID)
  const seen = new Set<string>();
  const combined: RawGoogleEvent[] = [];
  for (const event of [...defaultResults, ...futureResults]) {
    const key = event.event_token ?? event.title;
    if (!seen.has(key)) {
      seen.add(key);
      combined.push(event);
    }
  }

  return combined;
}
