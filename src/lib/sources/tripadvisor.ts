/**
 * TripAdvisor adapter via Apify actor.
 *
 * Scrapes TripAdvisor attractions and things-to-do for Hermanus.
 * Unlike other sources, TripAdvisor data is primarily *places/attractions*
 * rather than time-bound events. The Claude extraction agent classifies
 * these as "recurring" or "seasonal" temporal types as appropriate.
 *
 * Uses both Attractions and Tours/Activities pages for broader coverage.
 * Locals in Hermanus use TripAdvisor heavily for tourism activities.
 *
 * Actor schema verified Nov 2026 against live API output.
 * Note: the includeRestaurants/includeHotels flags are unreliable when
 * using query mode — the actor may still return other types. We filter
 * client-side to exclude restaurants and hotels.
 */

import { fetchApifyActor } from "./apify";

/**
 * Output schema from maxcopell/tripadvisor actor.
 * Verified against actual API response (Nov 2026).
 */
export type RawTripAdvisorItem = {
  id?: string;
  type?: string; // HOTEL, RESTAURANT, ATTRACTION, etc.
  category?: string; // hotel, restaurant, attraction
  subcategories?: string[];
  name: string;
  locationString?: string;
  description?: string | null;
  image?: string;
  photoCount?: number;
  address?: string;
  addressObj?: {
    street1?: string;
    street2?: string;
    city?: string;
    state?: string;
    country?: string;
    postalcode?: string;
  };
  phone?: string;
  email?: string;
  website?: string;
  webUrl?: string; // TripAdvisor listing URL
  latitude?: number;
  longitude?: number;
  rating?: number;
  numberOfReviews?: number;
  rankingString?: string;
  rankingPosition?: number;
  rankingDenominator?: string;
  priceLevel?: string;
  isClosed?: boolean;
  isLongClosed?: boolean;
};

const ACTOR_ID = "maxcopell/tripadvisor";

/**
 * Fetch TripAdvisor attractions and things-to-do for Hermanus.
 * Uses startUrls with direct TripAdvisor attractions page for better results.
 * Filters out restaurants, hotels, and closed locations.
 */
export async function fetchTripAdvisorItems(): Promise<RawTripAdvisorItem[]> {
  return fetchApifyActor<RawTripAdvisorItem>(
    ACTOR_ID,
    {
      startUrls: [
        {
          url: "https://www.tripadvisor.com/Attractions-g312755-Activities-Hermanus_Overstrand_Overberg_District_Western_Cape.html",
        },
        {
          url: "https://www.tripadvisor.com/Attractions-g312755-Activities-c42-Hermanus_Overstrand_Overberg_District_Western_Cape.html",
        },
      ],
      maxItemsPerQuery: 50,
      includeAttractions: true,
      includeRestaurants: false,
      includeHotels: false,
    },
    (item) =>
      // Exclude restaurants and hotels (flags are unreliable in query mode)
      item.category !== "restaurant" &&
      item.category !== "hotel" &&
      item.type !== "RESTAURANT" &&
      item.type !== "HOTEL" &&
      // Exclude permanently closed
      !item.isClosed &&
      !item.isLongClosed
  );
}
