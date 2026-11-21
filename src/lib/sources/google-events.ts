/**
 * Google Events adapter via Apify actor.
 *
 * Direct replacement for SerpAPI's Google Events engine.
 * Uses the johnvc/google-events-api---access-google-events-data actor
 * to fetch the same underlying Google Events data through Apify.
 *
 * Actor schema verified Nov 2026 against https://apify.com/johnvc/google-events-api---access-google-events-data
 */

import { fetchApifyActor } from "./apify";

/**
 * A single event from the Google Events actor output.
 * The actor returns dataset items with an `events` array inside each.
 */
export type RawGoogleEvent = {
  title: string;
  type?: string; // e.g. "Live concert"
  date?: {
    start_date?: string; // e.g. "Aug 14"
    when?: string; // e.g. "Aug 14, 2:30 PM"
  };
  time?: string;
  address?: string[]; // venue name and location lines
  venue_name?: string;
  area?: string;
  venue?: { name?: string; link?: string };
  ticket_info?: { seller?: string; link?: string }[];
  link?: string;
  source?: string;
  price?: string;
  extracted_price?: number;
  map_link?: string;
  description?: string;
};

/** Wrapper type matching the actor's dataset item structure. */
type GoogleEventsDatasetItem = {
  events?: RawGoogleEvent[];
  search_parameters?: Record<string, unknown>;
  search_metadata?: Record<string, unknown>;
  search_timestamp?: string;
};

const ACTOR_ID = "johnvc/google-events-api---access-google-events-data";

/**
 * Fetch events from Google Events via the Apify actor.
 * Flattens the nested events array from the dataset response.
 */
export async function fetchGoogleEvents(): Promise<RawGoogleEvent[]> {
  const items = await fetchApifyActor<GoogleEventsDatasetItem>(ACTOR_ID, {
    mode: "events",
    q: "events in Hermanus South Africa",
    location: "Hermanus, Western Cape, South Africa",
    hl: "en",
    advanced: "date:month",
    include_details: true,
  });

  // Flatten: each dataset item has an `events` array
  return items.flatMap((item) => item.events ?? []);
}
