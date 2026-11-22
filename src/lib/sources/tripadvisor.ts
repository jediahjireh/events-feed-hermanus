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
 */
export type RawTripAdvisorItem = {
  position?: number;
  title: string;
  place_type?: string; // "GEO", "ATTRACTION", etc.
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
 * Fetch TripAdvisor attractions and things-to-do for Hermanus via SerpAPI.
 * Runs multiple queries to cover different activity types, deduplicates by place_id.
 * SerpAPI TripAdvisor search returns in ~2s — well within Vercel's 60s timeout.
 */
export async function fetchTripAdvisorItems(): Promise<RawTripAdvisorItem[]> {
  const extract = (body: Record<string, unknown>) =>
    (body.places as RawTripAdvisorItem[]) ?? [];

  const [activities, events, tours] = await Promise.all([
    fetchSerpApi<RawTripAdvisorItem>(
      "tripadvisor",
      { q: "hermanus things to do" },
      extract,
    ),
    fetchSerpApi<RawTripAdvisorItem>(
      "tripadvisor",
      { q: "hermanus events" },
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
  for (const item of [...activities, ...events, ...tours]) {
    const key = item.place_id ?? item.title;
    if (!seen.has(key)) {
      seen.add(key);
      combined.push(item);
    }
  }

  return combined.filter(isHermanusRelevant);
}
