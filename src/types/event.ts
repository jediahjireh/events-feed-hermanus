import { z } from "zod/v4";

// --- Location ---

export const LocationSchema = z.object({
  name: z.string(),
  venue: z.string().nullable(),
  town: z.string(),
  region: z.string(),
  province: z.string(),
  country: z.string().default("ZA"),
  lat: z.number().nullable().default(null),
  lng: z.number().nullable().default(null),
  radius_km: z.number().nullable().default(null),
});

export type Location = z.infer<typeof LocationSchema>;

// --- Recurrence ---

export const RecurrenceSchema = z.object({
  frequency: z.enum(["daily", "weekly", "monthly"]),
  day_of_week: z.number().int().min(0).max(6).nullable().default(null), // 0=Mon, 6=Sun
  interval: z.number().int().positive().default(1),
  exceptions: z.array(z.iso.date()).default([]),
});

export type Recurrence = z.infer<typeof RecurrenceSchema>;

// --- Temporal (discriminated union on "type") ---

const PointTemporalSchema = z.object({
  type: z.literal("point"),
  start_date: z.iso.date(),
  end_date: z.null().default(null),
  start_month: z.null().default(null),
  end_month: z.null().default(null),
  recurrence: z.null().default(null),
  dates: z.null().default(null),
});

const RangeTemporalSchema = z.object({
  type: z.literal("range"),
  start_date: z.iso.date(),
  end_date: z.iso.date(),
  start_month: z.null().default(null),
  end_month: z.null().default(null),
  recurrence: z.null().default(null),
  dates: z.array(z.iso.date()).nullable().default(null),
});

const RecurringTemporalSchema = z.object({
  type: z.literal("recurring"),
  start_date: z.iso.date().nullable().default(null),
  end_date: z.iso.date().nullable().default(null),
  start_month: z.null().default(null),
  end_month: z.null().default(null),
  recurrence: RecurrenceSchema,
  dates: z.null().default(null),
});

const SeasonalTemporalSchema = z.object({
  type: z.literal("seasonal"),
  start_date: z.null().default(null),
  end_date: z.null().default(null),
  start_month: z.number().int().min(1).max(12),
  end_month: z.number().int().min(1).max(12),
  recurrence: z.null().default(null),
  dates: z.null().default(null),
});

export const TemporalSchema = z.discriminatedUnion("type", [
  PointTemporalSchema,
  RangeTemporalSchema,
  RecurringTemporalSchema,
  SeasonalTemporalSchema,
]);

export type Temporal = z.infer<typeof TemporalSchema>;

// --- Links ---

export const LinksSchema = z.object({
  website: z.string().optional(),
  tickets: z.string().optional(),
  source_url: z.string().optional(),
});

export type Links = z.infer<typeof LinksSchema>;

// --- Event status ---

export const EventStatusSchema = z.enum([
  "active",
  "cancelled",
  "tentative",
  "past",
]);

export type EventStatus = z.infer<typeof EventStatusSchema>;

// --- Categories ---

export const CategorySchema = z.enum([
  "music",
  "market",
  "wildlife",
  "art",
  "sport",
  "food-wine",
  "family",
]);

export type Category = z.infer<typeof CategorySchema>;

// --- Suitable for ---

export const SuitableForSchema = z.enum([
  "couples",
  "families",
  "adventure",
  "luxury",
  "solo",
]);

export type SuitableFor = z.infer<typeof SuitableForSchema>;

// --- Full Event schema ---

export const EventSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().nullable().default(null),
  location: LocationSchema,
  temporal: TemporalSchema,
  categories: z.array(z.string()).default([]),
  source_id: z.string(),
  source_url: z.string().nullable().default(null),
  relevance_score: z.number().min(0).max(1).default(0.5),
  confidence: z.number().min(0).max(1).default(0.5),
  status: EventStatusSchema.default("active"),
  links: LinksSchema.nullable().default(null),
  images: z.array(z.string()).default([]),
  price_indication: z.string().nullable().default(null),
  suitable_for: z.array(z.string()).default([]),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  ingested_at: z.string().datetime(),
  last_verified_at: z.string().datetime().nullable().default(null),
  version: z.number().int().positive().default(1),
});

export type Event = z.infer<typeof EventSchema>;

// --- Create Event input (for POST /api/events) ---

export const CreateEventSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().default(null),
  location: LocationSchema,
  temporal: TemporalSchema,
  categories: z.array(z.string()).default([]),
  source_id: z.string(),
  source_url: z.string().nullable().default(null),
  relevance_score: z.number().min(0).max(1).default(0.5),
  confidence: z.number().min(0).max(1).default(0.5),
  status: EventStatusSchema.default("active"),
  links: LinksSchema.nullable().default(null),
  images: z.array(z.string()).default([]),
  price_indication: z.string().nullable().default(null),
  suitable_for: z.array(z.string()).default([]),
});

export type CreateEventInput = z.infer<typeof CreateEventSchema>;

// --- Update Event input (for PUT /api/events/:id) ---

export const UpdateEventSchema = CreateEventSchema.partial().extend({
  version: z.number().int().positive(), // Required for optimistic concurrency
});

export type UpdateEventInput = z.infer<typeof UpdateEventSchema>;

// --- Source schema ---

export const SourceSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  url: z.string().nullable().default(null),
  trust_level: z.number().min(0).max(1).default(0.7),
  last_scraped: z.string().datetime().nullable().default(null),
  scrape_config: z.record(z.string(), z.unknown()).nullable().default(null),
});

export type Source = z.infer<typeof SourceSchema>;
