import {
  pgTable,
  text,
  timestamp,
  real,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

// --- Sources ---

export const sources = pgTable("sources", {
  id: text("id").primaryKey(), // ULID
  name: text("name").notNull(),
  url: text("url"),
  trust_level: real("trust_level").notNull().default(0.7),
  last_scraped: timestamp("last_scraped", { withTimezone: true }),
  scrape_config: jsonb("scrape_config"),
});

// --- Events ---

export const events = pgTable(
  "events",
  {
    id: text("id").primaryKey(), // ULID
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    location: jsonb("location").notNull().$type<LocationJson>(),
    temporal: jsonb("temporal").notNull().$type<TemporalJson>(),
    categories: jsonb("categories").notNull().$type<string[]>().default([]),
    source_id: text("source_id")
      .notNull()
      .references(() => sources.id),
    source_url: text("source_url"),
    relevance_score: real("relevance_score").notNull().default(0.5),
    confidence: real("confidence").notNull().default(0.5),
    status: text("status", {
      enum: ["active", "cancelled", "tentative", "past"],
    })
      .notNull()
      .default("active"),
    links: jsonb("links").$type<LinksJson>(),
    images: jsonb("images").$type<string[]>().default([]),
    price_indication: text("price_indication"),
    suitable_for: jsonb("suitable_for").$type<string[]>().default([]),
    created_at: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ingested_at: timestamp("ingested_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    last_verified_at: timestamp("last_verified_at", { withTimezone: true }),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    index("events_status_idx").on(table.status),
    index("events_confidence_idx").on(table.confidence),
    index("events_source_id_idx").on(table.source_id),
    index("events_slug_idx").on(table.slug),
    index("events_categories_idx").on(table.categories),
  ]
);

// --- Event Versions (audit trail) ---

export const eventVersions = pgTable(
  "event_versions",
  {
    id: text("id").primaryKey(), // ULID
    event_id: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    changed_at: timestamp("changed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    changed_by: text("changed_by").notNull(), // "ingest-agent", "manual", "review-agent"
    diff: jsonb("diff").notNull().$type<Record<string, unknown>>(),
    snapshot: jsonb("snapshot").notNull().$type<Record<string, unknown>>(),
  },
  (table) => [
    index("event_versions_event_id_idx").on(table.event_id),
    index("event_versions_version_idx").on(table.event_id, table.version),
  ]
);

// --- Ingest Runs ---

export const ingestRuns = pgTable(
  "ingest_runs",
  {
    id: text("id").primaryKey(), // ULID
    source_id: text("source_id")
      .notNull()
      .references(() => sources.id),
    started_at: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completed_at: timestamp("completed_at", { withTimezone: true }),
    status: text("status", {
      enum: ["running", "completed", "failed"],
    })
      .notNull()
      .default("running"),
    events_found: integer("events_found").notNull().default(0),
    events_created: integer("events_created").notNull().default(0),
    events_updated: integer("events_updated").notNull().default(0),
    events_skipped: integer("events_skipped").notNull().default(0),
    avg_confidence: real("avg_confidence"),
    tokens_used: integer("tokens_used").default(0),
    cost_usd: real("cost_usd").default(0),
    error: text("error"),
  },
  (table) => [index("ingest_runs_source_id_idx").on(table.source_id)]
);

// --- Chat Threads (Ask API conversations) ---

export const chatThreads = pgTable(
  "chat_threads",
  {
    id: text("id").primaryKey(), // ULID
    title: text("title").notNull(),
    messages: jsonb("messages").notNull().$type<ChatMessage[]>().default([]),
    cost_usd: real("cost_usd").notNull().default(0),
    tokens_input: integer("tokens_input").notNull().default(0),
    tokens_output: integer("tokens_output").notNull().default(0),
    created_at: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("chat_threads_updated_at_idx").on(table.updated_at)]
);

// --- Chat Monthly Spend ---

export const chatMonthlySpend = pgTable("chat_monthly_spend", {
  month_key: text("month_key").primaryKey(), // "YYYY-MM"
  total_usd: real("total_usd").notNull().default(0),
  query_count: integer("query_count").notNull().default(0),
  updated_at: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// --- JSON column type definitions ---
// These mirror the Zod schemas in src/types/event.ts

export type LocationJson = {
  name: string;
  venue: string | null;
  town: string;
  region: string;
  province: string;
  country: string;
  lat: number | null;
  lng: number | null;
  radius_km: number | null;
};

export type RecurrenceJson = {
  frequency: "daily" | "weekly" | "monthly";
  day_of_week: number | null; // 0=Mon ... 6=Sun
  interval: number;
  exceptions: string[]; // ISO date strings
};

export type TemporalJson =
  | {
      type: "point";
      start_date: string; // ISO date
      end_date: null;
      start_month: null;
      end_month: null;
      recurrence: null;
      dates: null;
    }
  | {
      type: "range";
      start_date: string;
      end_date: string;
      start_month: null;
      end_month: null;
      recurrence: null;
      dates: string[] | null; // For multi-date events
    }
  | {
      type: "recurring";
      start_date: string | null; // Optional range boundary
      end_date: string | null;
      start_month: null;
      end_month: null;
      recurrence: RecurrenceJson;
      dates: null;
    }
  | {
      type: "seasonal";
      start_date: null;
      end_date: null;
      start_month: number; // 1-12
      end_month: number; // 1-12
      recurrence: null;
      dates: null;
    };

export type LinksJson = {
  website?: string;
  tickets?: string;
  source_url?: string;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  tool_calls?: Array<{
    tool: string;
    input: unknown;
    result: unknown;
  }>;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
};
