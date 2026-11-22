/**
 * Test factories — produce valid objects that pass Zod validation.
 *
 * Every test file should use these instead of inline test data.
 */

import type { TemporalJson, LocationJson } from "@/db/schema";
import type { CreateEventInput } from "@/types/event";

let counter = 0;
function nextId(): string {
  return `test-${++counter}`;
}

// --- Location factory ---

const defaultLocation: LocationJson = {
  name: "Hermanus",
  venue: null,
  town: "Hermanus",
  region: "Overberg",
  province: "Western Cape",
  country: "ZA",
  lat: -34.4187,
  lng: 19.2345,
  radius_km: null,
};

export function makeLocation(
  overrides: Partial<LocationJson> = {}
): LocationJson {
  return { ...defaultLocation, ...overrides };
}

// --- Temporal factories ---

export function makePointTemporal(
  startDate = "2027-09-18"
): TemporalJson {
  return {
    type: "point",
    start_date: startDate,
    end_date: null,
    start_month: null,
    end_month: null,
    recurrence: null,
    dates: null,
  };
}

export function makeRangeTemporal(
  startDate = "2027-06-11",
  endDate = "2027-06-15"
): TemporalJson {
  return {
    type: "range",
    start_date: startDate,
    end_date: endDate,
    start_month: null,
    end_month: null,
    recurrence: null,
    dates: null,
  };
}

export function makeRecurringTemporal(
  dayOfWeek = 5,
  frequency: "daily" | "weekly" | "monthly" = "weekly"
): TemporalJson {
  return {
    type: "recurring",
    start_date: null,
    end_date: null,
    start_month: null,
    end_month: null,
    recurrence: {
      frequency,
      day_of_week: dayOfWeek,
      interval: 1,
      exceptions: [],
    },
    dates: null,
  };
}

export function makeSeasonalTemporal(
  startMonth = 6,
  endMonth = 11
): TemporalJson {
  return {
    type: "seasonal",
    start_date: null,
    end_date: null,
    start_month: startMonth,
    end_month: endMonth,
    recurrence: null,
    dates: null,
  };
}

// --- Event factories ---

export function makeEvent(
  overrides: Partial<CreateEventInput> = {}
): CreateEventInput {
  return {
    title: `Test Event ${nextId()}`,
    description: null,
    location: defaultLocation,
    temporal: makePointTemporal(),
    categories: [],
    source_id: "test-source",
    source_url: null,
    relevance_score: 0.5,
    confidence: 0.7,
    status: "active",
    links: null,
    images: [],
    price_indication: null,
    suitable_for: [],
    ...overrides,
  };
}

export function makePointEvent(
  overrides: Partial<CreateEventInput> = {}
): CreateEventInput {
  return makeEvent({
    temporal: makePointTemporal(),
    ...overrides,
  });
}

export function makeRangeEvent(
  overrides: Partial<CreateEventInput> = {}
): CreateEventInput {
  return makeEvent({
    temporal: makeRangeTemporal(),
    ...overrides,
  });
}

export function makeRecurringEvent(
  overrides: Partial<CreateEventInput> = {}
): CreateEventInput {
  return makeEvent({
    temporal: makeRecurringTemporal(),
    ...overrides,
  });
}

export function makeSeasonalEvent(
  overrides: Partial<CreateEventInput> = {}
): CreateEventInput {
  return makeEvent({
    temporal: makeSeasonalTemporal(),
    ...overrides,
  });
}

// --- Source factory ---

export function makeSource(
  overrides: Partial<{
    id: string;
    name: string;
    url: string | null;
    trust_level: number;
  }> = {}
) {
  return {
    id: overrides.id ?? nextId(),
    name: overrides.name ?? "Test Source",
    url: overrides.url ?? null,
    trust_level: overrides.trust_level ?? 0.7,
  };
}

// --- Seed data matching DESIGN.md hand-worked cases ---

export const SEED_SOURCES = {
  googleEvents: {
    id: "google-events",
    name: "Google Events (SerpAPI)",
    url: "https://serpapi.com/google-events-api",
    trust_level: 0.8,
  },
  facebook: {
    id: "facebook",
    name: "Facebook Events (Apify)",
    url: "https://apify.com/apify/facebook-events-scraper",
    trust_level: 0.7,
  },
  eventbrite: {
    id: "eventbrite",
    name: "Eventbrite (SerpAPI)",
    url: "https://serpapi.com/eventbrite-search-api",
    trust_level: 0.8,
  },
  tripadvisor: {
    id: "tripadvisor",
    name: "TripAdvisor (Apify)",
    url: "https://apify.com/maxcopell/tripadvisor",
    trust_level: 0.75,
  },
  quicket: {
    id: "quicket",
    name: "Quicket (Apify)",
    url: "https://apify.com/gtnetworks/sa-events-listings",
    trust_level: 0.75,
  },
  hermanus: {
    id: "hermanus-co-za",
    name: "hermanus.co.za",
    url: "https://www.hermanus.co.za/what-to-do/annual-events/index.html",
    trust_level: 0.7,
  },
  manual: {
    id: "manual",
    name: "Manual Submission",
    url: null,
    trust_level: 0.5,
  },
};

export const SEED_EVENTS = {
  whaleWatching: makeSeasonalEvent({
    title: "Southern Right Whale Watching Season",
    description:
      "Watch southern right whales from the Hermanus cliff paths or by boat. Peak season June through November.",
    location: makeLocation({
      name: "Hermanus Cliff Path",
      venue: "Hermanus Cliff Path",
    }),
    categories: ["wildlife"],
    source_id: "google-events",
    confidence: 0.99,
    relevance_score: 0.95,
    price_indication: "free (land-based) / from R1200 (boat)",
    suitable_for: ["couples", "families", "luxury", "solo"],
  }),

  saturdayMarket: makeRecurringEvent({
    title: "Hermanus Country Market",
    description:
      "Weekly market at the Hermanus Cricket Club with local produce, crafts, and food stalls.",
    location: makeLocation({
      name: "Hermanus Country Market",
      venue: "Hermanus Cricket Club",
    }),
    categories: ["market", "food-wine"],
    source_id: "facebook",
    confidence: 0.95,
    relevance_score: 0.82,
    price_indication: "free entry",
    suitable_for: ["couples", "families", "solo"],
  }),

  fynArts: makeRangeEvent({
    title: "FynArts Festival 2027",
    description:
      "Annual arts festival in Hermanus featuring visual arts, music, theatre, and film.",
    location: makeLocation({
      name: "FynArts Festival Hermanus",
      venue: "Various venues",
    }),
    temporal: makeRangeTemporal("2027-06-11", "2027-06-15"),
    categories: ["art", "music"],
    source_id: "hermanus-co-za",
    confidence: 0.85,
    relevance_score: 0.88,
    price_indication: "varies per event",
    suitable_for: ["couples", "solo", "luxury"],
  }),

  whaleFestival: makeRangeEvent({
    title: "Hermanus Whale Festival 2027",
    description:
      "Annual festival celebrating the arrival of southern right whales with music, food, and eco-marine activities.",
    location: makeLocation({
      name: "Hermanus Whale Festival",
      venue: "Hermanus town centre",
    }),
    temporal: makeRangeTemporal("2027-09-27", "2027-09-28"),
    categories: ["wildlife", "music", "food-wine"],
    source_id: "eventbrite",
    confidence: 0.8,
    relevance_score: 0.9,
    price_indication: "free entry / ticketed events vary",
    suitable_for: ["couples", "families", "solo"],
  }),

  wineTasting: makeRecurringEvent({
    title: "Wine Tasting at Creation Wines",
    description:
      "Open for tastings Friday through Sunday. Award-winning wines in the Hemel-en-Aarde Valley.",
    location: makeLocation({
      name: "Creation Wines",
      venue: "Creation Wines",
    }),
    temporal: {
      type: "recurring",
      start_date: null,
      end_date: null,
      start_month: null,
      end_month: null,
      recurrence: {
        frequency: "weekly",
        day_of_week: 4, // Friday (0=Mon, 4=Fri)
        interval: 1,
        exceptions: [],
      },
      dates: null,
    },
    categories: ["food-wine"],
    source_id: "hermanus-co-za",
    confidence: 0.7,
    relevance_score: 0.85,
    price_indication: "from R150",
    suitable_for: ["couples", "luxury"],
  }),

  cancelledEvent: makePointEvent({
    title: "Cancelled Beach Concert 2027",
    description: "This event was cancelled.",
    location: makeLocation({ venue: "Grotto Beach" }),
    temporal: makePointTemporal("2027-08-15"),
    categories: ["music"],
    source_id: "manual",
    confidence: 0.6,
    status: "cancelled",
  }),

  lowConfidenceEvent: makePointEvent({
    title: "Possible Pop-up Dinner at Wine Farm",
    description:
      "Unconfirmed event — spotted on social media but no official source.",
    location: makeLocation({ venue: null }),
    temporal: makePointTemporal("2027-10-05"),
    categories: ["food-wine"],
    source_id: "manual",
    confidence: 0.4,
    relevance_score: 0.6,
  }),

  ginJazzEvening: makePointEvent({
    title: "Hermanus Craft Gin & Jazz Evening",
    description:
      "Live jazz and local craft gin tastings at the Harbour Square. Submitted by venue owner via manual entry.",
    location: makeLocation({
      name: "Harbour Square",
      venue: "Harbour Square",
    }),
    temporal: makePointTemporal("2027-07-19"),
    categories: ["music", "food-wine"],
    source_id: "manual",
    confidence: 0.7,
    relevance_score: 0.75,
    price_indication: "R250 per person",
    suitable_for: ["couples", "solo"],
  }),
};
