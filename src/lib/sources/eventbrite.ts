/**
 * Eventbrite adapter via SerpAPI.
 *
 * Uses SerpAPI's Eventbrite Search engine to fetch events near Hermanus.
 * SerpAPI resolves the location to an Eventbrite place and returns
 * structured event data with GPS coordinates, pricing, and categories.
 *
 * SerpAPI confirmed to return Hermanus events reliably (Nov 2026).
 * Previously used Apify actor (parseforge/eventbrite-scraper) but it returned
 * sparse results and required manual location filtering.
 *
 * API docs: https://serpapi.com/eventbrite-search-api
 */

import { fetchSerpApi } from "./serpapi";

/**
 * A single event from the SerpAPI Eventbrite response.
 * Matches the events_results[] schema from the API.
 */
export type RawEventbriteEvent = {
  position?: number;
  title?: string;
  link?: string;
  event_id?: string;
  description?: string;
  start_date?: string; // "2026-11-27"
  start_time?: string; // "15:00"
  end_date?: string;
  end_time?: string;
  timezone?: string; // "Africa/Johannesburg"
  address?: string[];
  venue?: {
    name?: string;
    gps_coordinates?: {
      latitude?: number;
      longitude?: number;
    };
  };
  price?: string; // "Free" or "799.00 EUR"
  extracted_price?: number;
  max_price?: string;
  extracted_max_price?: number;
  currency?: string;
  thumbnail?: string;
  image?: string;
  category?: string;
  subcategory?: string;
  type?: string; // "Festival or Fair", "Conference", etc.
  sold_out?: boolean;
  cancelled?: boolean;
};

/** Hermanus area bounding box (approximate). */
const HERMANUS_LAT_MIN = -34.50;
const HERMANUS_LAT_MAX = -34.25;
const HERMANUS_LNG_MIN = 19.00;
const HERMANUS_LNG_MAX = 19.40;

/** Check if an event's venue is in the Hermanus / Overstrand area. */
function isHermanusArea(event: RawEventbriteEvent): boolean {
  // Check GPS coordinates first (most reliable)
  const coords = event.venue?.gps_coordinates;
  if (coords?.latitude && coords?.longitude) {
    if (
      coords.latitude >= HERMANUS_LAT_MIN &&
      coords.latitude <= HERMANUS_LAT_MAX &&
      coords.longitude >= HERMANUS_LNG_MIN &&
      coords.longitude <= HERMANUS_LNG_MAX
    ) {
      return true;
    }
  }

  // Fall back to text matching
  const fields = [
    event.venue?.name,
    ...(event.address ?? []),
    event.title,
    event.description,
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
      f.includes("bettys bay") ||
      f.includes("sandbaai") ||
      f.includes("onrus") ||
      f.includes("arabella"),
  );
}

/**
 * Fetch Eventbrite events near Hermanus via SerpAPI.
 * SerpAPI resolves "Hermanus, Western Cape, South Africa" to the correct
 * Eventbrite location and returns structured events.
 * We additionally filter by GPS + text to keep only truly local events.
 */
export async function fetchEventbriteEvents(): Promise<RawEventbriteEvent[]> {
  // Fetch events up to 18 months out (travel planners book 6–18 months ahead)
  const today = new Date();
  const horizon = new Date(today);
  horizon.setMonth(horizon.getMonth() + 18);
  const startDate = today.toISOString().slice(0, 10);
  const endDate = horizon.toISOString().slice(0, 10);

  return fetchSerpApi<RawEventbriteEvent>(
    "eventbrite",
    {
      location: "Hermanus, Western Cape, South Africa",
      start_date: startDate,
      end_date: endDate,
    },
    (body) => (body.events_results as RawEventbriteEvent[]) ?? [],
    undefined,
    (event) => !event.sold_out && !event.cancelled && isHermanusArea(event),
  );
}
