/**
 * Seed script — populate the database with realistic test data for Hermanus.
 *
 * Run with: pnpm tsx src/db/seed.ts
 *
 * Matches the hand-worked cases in DESIGN.md so we can verify
 * the API against expected results.
 */

import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { ulid } from "ulid";
import * as schema from "./schema";
import { slugify } from "../lib/slug";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle({ client: sql, schema });

const SOURCES = [
  {
    id: "google-events",
    name: "Google Events (Apify)",
    url: "https://apify.com/johnvc/google-events-api---access-google-events-data",
    trust_level: 0.8,
  },
  {
    id: "facebook",
    name: "Facebook Events (Apify)",
    url: "https://apify.com/apify/facebook-events-scraper",
    trust_level: 0.7,
  },
  {
    id: "eventbrite",
    name: "Eventbrite (Apify)",
    url: "https://apify.com/parseforge/eventbrite-scraper",
    trust_level: 0.8,
  },
  {
    id: "tripadvisor",
    name: "TripAdvisor (Apify)",
    url: "https://apify.com/maxcopell/tripadvisor",
    trust_level: 0.75,
  },
  {
    id: "quicket",
    name: "Quicket (Apify)",
    url: "https://apify.com/gtnetworks/sa-events-listings",
    trust_level: 0.75,
  },
  {
    id: "hermanus-co-za",
    name: "hermanus.co.za",
    url: "https://www.hermanus.co.za/what-to-do/events-calendar/index.html",
    trust_level: 0.7,
  },
  {
    id: "manual",
    name: "Manual Submission",
    url: null,
    trust_level: 0.5,
  },
];

const now = new Date();

const EVENTS: (typeof schema.events.$inferInsert)[] = [
  {
    id: ulid(),
    title: "Southern Right Whale Watching Season",
    slug: slugify("Southern Right Whale Watching Season"),
    description:
      "Watch southern right whales from the Hermanus cliff paths or by boat. Peak season June through November.",
    location: {
      name: "Hermanus Cliff Path",
      venue: "Hermanus Cliff Path",
      town: "Hermanus",
      region: "Overberg",
      province: "Western Cape",
      country: "ZA",
      lat: -34.4187,
      lng: 19.2345,
      radius_km: null,
    },
    temporal: {
      type: "seasonal",
      start_date: null,
      end_date: null,
      start_month: 6,
      end_month: 11,
      recurrence: null,
      dates: null,
    },
    categories: ["wildlife"],
    source_id: "google-events",
    source_url: null,
    relevance_score: 0.95,
    confidence: 0.99,
    status: "active",
    links: {
      website: "https://www.hermanus.co.za/whales",
    },
    images: [],
    price_indication: "free (land-based) / from R1200 (boat)",
    suitable_for: ["couples", "families", "luxury", "solo"],
    created_at: now,
    updated_at: now,
    ingested_at: now,
    version: 1,
  },
  {
    id: ulid(),
    title: "Hermanus Country Market",
    slug: slugify("Hermanus Country Market"),
    description:
      "Weekly market at the Hermanus Cricket Club with local produce, crafts, and food stalls. Every Saturday morning.",
    location: {
      name: "Hermanus Country Market",
      venue: "Hermanus Cricket Club",
      town: "Hermanus",
      region: "Overberg",
      province: "Western Cape",
      country: "ZA",
      lat: -34.4121,
      lng: 19.2298,
      radius_km: null,
    },
    temporal: {
      type: "recurring",
      start_date: null,
      end_date: null,
      start_month: null,
      end_month: null,
      recurrence: {
        frequency: "weekly",
        day_of_week: 5, // Saturday (0=Mon, 5=Sat)
        interval: 1,
        exceptions: [],
      },
      dates: null,
    },
    categories: ["market", "food-wine"],
    source_id: "facebook",
    source_url: null,
    relevance_score: 0.82,
    confidence: 0.95,
    status: "active",
    links: null,
    images: [],
    price_indication: "free entry",
    suitable_for: ["couples", "families", "solo"],
    created_at: now,
    updated_at: now,
    ingested_at: now,
    version: 1,
  },
  {
    id: ulid(),
    title: "FynArts Festival 2027",
    slug: slugify("FynArts Festival 2027"),
    description:
      "Annual arts festival in Hermanus featuring visual arts, music, theatre, and film. Mid-June, 5 days.",
    location: {
      name: "FynArts Festival Hermanus",
      venue: "Various venues",
      town: "Hermanus",
      region: "Overberg",
      province: "Western Cape",
      country: "ZA",
      lat: null,
      lng: null,
      radius_km: null,
    },
    temporal: {
      type: "range",
      start_date: "2027-06-11",
      end_date: "2027-06-15",
      start_month: null,
      end_month: null,
      recurrence: null,
      dates: null,
    },
    categories: ["art", "music"],
    source_id: "hermanus-co-za",
    source_url: "https://fynarts.co.za",
    relevance_score: 0.88,
    confidence: 0.85,
    status: "active",
    links: {
      website: "https://fynarts.co.za",
    },
    images: [],
    price_indication: "varies per event",
    suitable_for: ["couples", "solo", "luxury"],
    created_at: now,
    updated_at: now,
    ingested_at: now,
    version: 1,
  },
  {
    id: ulid(),
    title: "Hermanus Whale Festival 2027",
    slug: slugify("Hermanus Whale Festival 2027"),
    description:
      "Annual festival celebrating the arrival of southern right whales with music, food, and eco-marine activities.",
    location: {
      name: "Hermanus Whale Festival",
      venue: "Hermanus town centre",
      town: "Hermanus",
      region: "Overberg",
      province: "Western Cape",
      country: "ZA",
      lat: null,
      lng: null,
      radius_km: null,
    },
    temporal: {
      type: "range",
      start_date: "2027-09-27",
      end_date: "2027-09-28",
      start_month: null,
      end_month: null,
      recurrence: null,
      dates: null,
    },
    categories: ["wildlife", "music", "food-wine"],
    source_id: "eventbrite",
    source_url: null,
    relevance_score: 0.9,
    confidence: 0.8,
    status: "active",
    links: null,
    images: [],
    price_indication: "free entry / ticketed events vary",
    suitable_for: ["couples", "families", "solo"],
    created_at: now,
    updated_at: now,
    ingested_at: now,
    version: 1,
  },
  {
    id: ulid(),
    title: "Wine Tasting at Creation Wines",
    slug: slugify("Wine Tasting at Creation Wines"),
    description:
      "Open for tastings Friday through Sunday. Award-winning wines in the Hemel-en-Aarde Valley.",
    location: {
      name: "Creation Wines",
      venue: "Creation Wines",
      town: "Hermanus",
      region: "Overberg",
      province: "Western Cape",
      country: "ZA",
      lat: -34.3792,
      lng: 19.2715,
      radius_km: null,
    },
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
    source_url: null,
    relevance_score: 0.85,
    confidence: 0.7,
    status: "active",
    links: {
      website: "https://www.creationwines.com",
    },
    images: [],
    price_indication: "from R150",
    suitable_for: ["couples", "luxury"],
    created_at: now,
    updated_at: now,
    ingested_at: now,
    version: 1,
  },
  {
    id: ulid(),
    title: "Cancelled Beach Concert 2027",
    slug: slugify("Cancelled Beach Concert 2027"),
    description: "This event was cancelled.",
    location: {
      name: "Grotto Beach",
      venue: "Grotto Beach",
      town: "Hermanus",
      region: "Overberg",
      province: "Western Cape",
      country: "ZA",
      lat: null,
      lng: null,
      radius_km: null,
    },
    temporal: {
      type: "point",
      start_date: "2027-08-15",
      end_date: null,
      start_month: null,
      end_month: null,
      recurrence: null,
      dates: null,
    },
    categories: ["music"],
    source_id: "manual",
    source_url: null,
    relevance_score: 0.3,
    confidence: 0.6,
    status: "cancelled",
    links: null,
    images: [],
    price_indication: null,
    suitable_for: [],
    created_at: now,
    updated_at: now,
    ingested_at: now,
    version: 1,
  },
  {
    id: ulid(),
    title: "Possible Pop-up Dinner at Wine Farm",
    slug: slugify("Possible Pop-up Dinner at Wine Farm"),
    description:
      "Unconfirmed event — spotted on social media but no official source.",
    location: {
      name: "Unknown Wine Farm",
      venue: null,
      town: "Hermanus",
      region: "Overberg",
      province: "Western Cape",
      country: "ZA",
      lat: null,
      lng: null,
      radius_km: null,
    },
    temporal: {
      type: "point",
      start_date: "2027-10-05",
      end_date: null,
      start_month: null,
      end_month: null,
      recurrence: null,
      dates: null,
    },
    categories: ["food-wine"],
    source_id: "manual",
    source_url: null,
    relevance_score: 0.6,
    confidence: 0.4,
    status: "active",
    links: null,
    images: [],
    price_indication: null,
    suitable_for: [],
    created_at: now,
    updated_at: now,
    ingested_at: now,
    version: 1,
  },
];

async function seed() {
  console.log("Seeding database...\n");

  // Clear existing data
  await db.delete(schema.eventVersions);
  await db.delete(schema.ingestRuns);
  await db.delete(schema.events);
  await db.delete(schema.sources);
  console.log("Cleared existing data.");

  // Insert sources
  for (const source of SOURCES) {
    await db.insert(schema.sources).values(source);
  }
  console.log(`Inserted ${SOURCES.length} sources.`);

  // Insert events with initial version records
  for (const event of EVENTS) {
    await db.insert(schema.events).values(event);
    await db.insert(schema.eventVersions).values({
      id: ulid(),
      event_id: event.id!,
      version: 1,
      changed_at: now,
      changed_by: "seed",
      diff: { action: "seeded" },
      snapshot: { ...event },
    });
  }
  console.log(`Inserted ${EVENTS.length} events with version records.\n`);

  // Summary
  console.log("Seed data summary:");
  console.log("  Sources: google-events, facebook, eventbrite, tripadvisor, quicket, hermanus-co-za, manual");
  console.log("  Events:");
  for (const event of EVENTS) {
    console.log(
      `    - ${event.title} (${event.temporal.type}, confidence: ${event.confidence}, status: ${event.status})`
    );
  }
  console.log("\nDone.");
}

seed().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
