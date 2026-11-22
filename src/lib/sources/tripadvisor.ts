/**
 * TripAdvisor adapter via SerpAPI.
 *
 * Uses SerpAPI's TripAdvisor Search engine to fetch attractions, activities,
 * and things-to-do for Hermanus.
 *
 * Previously used Apify actor (maxcopell/tripadvisor) but it took ~2 minutes
 * per run, exceeding Vercel's 60s function timeout. SerpAPI returns results
 * in a single HTTP request (~2s).
 *
 * Unlike other sources, TripAdvisor data is primarily *places/attractions*
 * rather than time-bound events. The Claude extraction agent classifies
 * these as "recurring" or "seasonal" temporal types as appropriate.
 *
 * API docs: https://serpapi.com/tripadvisor-search-api
 */

import { fetchSerpApi } from "./serpapi";

/**
 * A single result from the SerpAPI TripAdvisor Search response.
 * Matches the places[] schema from the API.
 *
 * Known place_type values (from SerpAPI docs):
 *   GEO, ATTRACTION, ATTRACTION_PRODUCT, ACCOMMODATION, EATERY, AIRLINE, VACATION_RENTAL
 */
export type RawTripAdvisorItem = {
  position?: number;
  title: string;
  place_type?: string;
  place_id?: string;
  link?: string; // TripAdvisor listing URL
  serpapi_link?: string;
  description?: string | null;
  location?: string;
  thumbnail?: string;
};

/** Hermanus and immediate surroundings for location filtering. */
const HERMANUS_AREA_TERMS = [
  "hermanus",
  "overstrand",
  "sandbaai",
  "onrus",
  "walker bay",
  "hemel-en-aarde",
];

/**
 * Title keywords that indicate a plain geographic location rather than
 * an event, tour, or activity. Matched as whole words (case-insensitive).
 */
const LOCATION_ONLY_PATTERNS = [
  /\bbeach\b/,
  /\bnature reserve\b/,
  /\bcliff path\b/,
  /\bhiking trail\b/,
  /\bkoppie\b/,
  /\bmountain pass\b/,
  /\blagoon\b/,
  /\bharbour\b/,
  /\bbotanical garden\b/,
];

/**
 * Title keywords that indicate an activity/event — overrides location
 * exclusion when present (e.g. "Beach Ride" should stay).
 */
const ACTIVITY_INDICATORS = [
  /\btour\b/,
  /\bride\b/,
  /\bcruise\b/,
  /\btrip\b/,
  /\bmarket\b/,
  /\bfestival\b/,
  /\bconcert\b/,
  /\bevent\b/,
  /\bshow\b/,
  /\btasting\b/,
  /\bdive\b/,
  /\bdiving\b/,
  /\bkayak/,
  /\bsafari\b/,
  /\bexperience\b/,
  /\bexcursion\b/,
  /\badventure\b/,
  /\blesson\b/,
  /\bclass\b/,
  /\bwalk\b/,
  /\bwatch(?:ing)?\b/,
  /\brun\b/,
  /\bguided\b/,
];

/**
 * Check if a TripAdvisor item is relevant to Hermanus.
 * Keeps items where the title, description, or location references Hermanus area.
 */
function isHermanusRelevant(item: RawTripAdvisorItem): boolean {
  const fields = [item.title, item.description, item.location]
    .filter(Boolean)
    .map((v) => v!.toLowerCase());

  return fields.some((f) =>
    HERMANUS_AREA_TERMS.some((term) => f.includes(term)),
  );
}

/**
 * Place types we want from SerpAPI TripAdvisor results.
 * ATTRACTION = things-to-do listings (tours, beaches, reserves — needs keyword filter)
 * ATTRACTION_PRODUCT = bookable experiences (always keep)
 * Everything else (GEO, ACCOMMODATION, EATERY, AIRLINE, VACATION_RENTAL) = not events.
 */
const ALLOWED_PLACE_TYPES = new Set(["ATTRACTION", "ATTRACTION_PRODUCT"]);

/**
 * Filter out plain geographic locations that aren't events or activities.
 * TripAdvisor returns "places" — beaches, reserves, cliff paths — that are
 * just locations, not things you *do*. We keep tours, activities, experiences.
 *
 * Filtering layers:
 * 1. place_type must be ATTRACTION or ATTRACTION_PRODUCT (excludes hotels,
 *    restaurants, airlines, vacation rentals, geographic regions).
 * 2. ATTRACTION_PRODUCT items are always kept (bookable experiences).
 * 3. ATTRACTION items are checked against title keywords — if the title
 *    matches a location-only pattern without an activity indicator, exclude it.
 */
function isActivityNotLocation(item: RawTripAdvisorItem): boolean {
  // If place_type is known and not in allowed set → exclude
  if (item.place_type && !ALLOWED_PLACE_TYPES.has(item.place_type)) {
    return false;
  }

  // ATTRACTION_PRODUCT = bookable tour/experience — always keep
  if (item.place_type === "ATTRACTION_PRODUCT") return true;

  const title = item.title.toLowerCase();

  // Check if the title looks like a plain location
  const matchesLocation = LOCATION_ONLY_PATTERNS.some((p) => p.test(title));
  if (!matchesLocation) return true;

  // It matched a location pattern — check if there's also an activity indicator
  // e.g. "Beach Ride" has "beach" (location) but also "ride" (activity) → keep
  return ACTIVITY_INDICATORS.some((p) => p.test(title));
}

/**
 * Fetch TripAdvisor attractions and things-to-do for Hermanus via SerpAPI.
 *
 * Uses 2 queries (down from 3 — "hermanus events" overlapped heavily with
 * "things to do" and contributed mostly duplicate/location results):
 * 1. "hermanus things to do" — activities, tours, experiences
 * 2. "hermanus whale watching tours" — targeted whale tourism
 *
 * Post-processing: dedup by place_id, filter to Hermanus area, then exclude
 * plain geographic locations (beaches, reserves, paths) that aren't activities.
 */
export async function fetchTripAdvisorItems(): Promise<RawTripAdvisorItem[]> {
  const extract = (body: Record<string, unknown>) =>
    (body.places as RawTripAdvisorItem[]) ?? [];

  const [activities, tours] = await Promise.all([
    fetchSerpApi<RawTripAdvisorItem>(
      "tripadvisor",
      { q: "hermanus things to do" },
      extract,
    ),
    fetchSerpApi<RawTripAdvisorItem>(
      "tripadvisor",
      { q: "hermanus whale watching tours" },
      extract,
    ),
  ]);

  // Dedup by place_id (SerpAPI's unique identifier)
  const seen = new Set<string>();
  const combined: RawTripAdvisorItem[] = [];
  for (const item of [...activities, ...tours]) {
    const key = item.place_id ?? item.title;
    if (!seen.has(key)) {
      seen.add(key);
      combined.push(item);
    }
  }

  return combined.filter(isHermanusRelevant).filter(isActivityNotLocation);
}
