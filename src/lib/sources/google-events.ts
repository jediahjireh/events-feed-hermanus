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
 * Returns structured event data for Hermanus.
 */
export async function fetchGoogleEvents(): Promise<RawGoogleEvent[]> {
  return fetchSerpApi<RawGoogleEvent>(
    "google_events",
    {
      q: "Events in Hermanus",
    },
    (body) => (body.events_results as RawGoogleEvent[]) ?? [],
  );
}
