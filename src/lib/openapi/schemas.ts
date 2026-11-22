/**
 * OpenAPI 3.1 component schemas.
 *
 * Reusable type definitions referenced by $ref in path definitions.
 * Matches the Zod schemas in src/types/ and the Drizzle schema in src/db/schema.ts.
 */

export const LocationSchema = {
  type: "object",
  required: ["name", "town", "region", "province", "country"],
  properties: {
    name: { type: "string" },
    venue: { type: ["string", "null"] },
    town: { type: "string" },
    region: { type: "string" },
    province: { type: "string" },
    country: { type: "string", default: "ZA" },
    lat: { type: ["number", "null"], default: null },
    lng: { type: ["number", "null"], default: null },
    radius_km: { type: ["number", "null"], default: null },
  },
};

export const RecurrenceSchema = {
  type: "object",
  required: ["frequency"],
  properties: {
    frequency: { type: "string", enum: ["daily", "weekly", "monthly"] },
    day_of_week: {
      type: ["integer", "null"],
      minimum: 0,
      maximum: 6,
      description: "0=Monday, 6=Sunday",
      default: null,
    },
    interval: { type: "integer", minimum: 1, default: 1 },
    exceptions: {
      type: "array",
      items: { type: "string", format: "date" },
      default: [],
      description: "ISO dates to skip",
    },
  },
};

export const TemporalSchema = {
  discriminator: { propertyName: "type" },
  oneOf: [
    {
      type: "object",
      title: "PointTemporal",
      required: ["type", "start_date"],
      properties: {
        type: { type: "string", const: "point" },
        start_date: { type: "string", format: "date" },
        end_date: { type: "null" },
        start_month: { type: "null" },
        end_month: { type: "null" },
        recurrence: { type: "null" },
        dates: { type: "null" },
      },
    },
    {
      type: "object",
      title: "RangeTemporal",
      required: ["type", "start_date", "end_date"],
      properties: {
        type: { type: "string", const: "range" },
        start_date: { type: "string", format: "date" },
        end_date: { type: "string", format: "date" },
        start_month: { type: "null" },
        end_month: { type: "null" },
        recurrence: { type: "null" },
        dates: {
          type: ["array", "null"],
          items: { type: "string", format: "date" },
          description: "Explicit dates for multi-date events",
        },
      },
    },
    {
      type: "object",
      title: "RecurringTemporal",
      required: ["type", "recurrence"],
      properties: {
        type: { type: "string", const: "recurring" },
        start_date: {
          type: ["string", "null"],
          format: "date",
          description: "Optional start boundary",
        },
        end_date: {
          type: ["string", "null"],
          format: "date",
          description: "Optional end boundary",
        },
        start_month: { type: "null" },
        end_month: { type: "null" },
        recurrence: { $ref: "#/components/schemas/Recurrence" },
        dates: { type: "null" },
      },
    },
    {
      type: "object",
      title: "SeasonalTemporal",
      required: ["type", "start_month", "end_month"],
      properties: {
        type: { type: "string", const: "seasonal" },
        start_date: { type: "null" },
        end_date: { type: "null" },
        start_month: {
          type: "integer",
          minimum: 1,
          maximum: 12,
          description: "1=January, 12=December",
        },
        end_month: {
          type: "integer",
          minimum: 1,
          maximum: 12,
          description: "Handles year-boundary wrap (e.g. Nov-Feb)",
        },
        recurrence: { type: "null" },
        dates: { type: "null" },
      },
    },
  ],
};

export const LinksSchema = {
  type: ["object", "null"],
  properties: {
    website: { type: "string", format: "uri" },
    tickets: { type: "string", format: "uri" },
    source_url: { type: "string", format: "uri" },
  },
};

export const EventSchema = {
  type: "object",
  required: [
    "id",
    "title",
    "slug",
    "location",
    "temporal",
    "source_id",
    "relevance_score",
    "confidence",
    "status",
    "version",
  ],
  properties: {
    id: { type: "string", description: "ULID" },
    title: { type: "string" },
    slug: { type: "string" },
    description: { type: ["string", "null"] },
    location: { $ref: "#/components/schemas/Location" },
    temporal: { $ref: "#/components/schemas/Temporal" },
    categories: {
      type: "array",
      items: {
        type: "string",
        enum: [
          "music",
          "market",
          "wildlife",
          "art",
          "sport",
          "food-wine",
          "family",
        ],
      },
    },
    source_id: { type: "string" },
    source_url: { type: ["string", "null"] },
    relevance_score: { type: "number", minimum: 0, maximum: 1 },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    status: {
      type: "string",
      enum: ["active", "cancelled", "tentative", "past"],
    },
    links: { $ref: "#/components/schemas/Links" },
    images: { type: "array", items: { type: "string", format: "uri" } },
    price_indication: { type: ["string", "null"] },
    suitable_for: {
      type: "array",
      items: {
        type: "string",
        enum: ["couples", "families", "adventure", "luxury", "solo"],
      },
    },
    created_at: { type: "string", format: "date-time" },
    updated_at: { type: "string", format: "date-time" },
    ingested_at: { type: "string", format: "date-time" },
    last_verified_at: { type: ["string", "null"], format: "date-time" },
    version: { type: "integer", minimum: 1 },
    next_occurrence_in_range: {
      type: "string",
      format: "date",
      description:
        "Pre-computed for recurring events when from/to query params are provided",
    },
  },
};

export const CreateEventSchema = {
  type: "object",
  required: ["title", "location", "temporal", "source_id"],
  properties: {
    title: { type: "string", minLength: 1 },
    description: { type: ["string", "null"] },
    location: { $ref: "#/components/schemas/Location" },
    temporal: { $ref: "#/components/schemas/Temporal" },
    categories: { type: "array", items: { type: "string" }, default: [] },
    source_id: { type: "string" },
    source_url: { type: ["string", "null"] },
    relevance_score: { type: "number", minimum: 0, maximum: 1, default: 0.5 },
    confidence: { type: "number", minimum: 0, maximum: 1, default: 0.5 },
    status: {
      type: "string",
      enum: ["active", "cancelled", "tentative", "past"],
      default: "active",
    },
    links: { $ref: "#/components/schemas/Links" },
    images: { type: "array", items: { type: "string" }, default: [] },
    price_indication: { type: ["string", "null"] },
    suitable_for: { type: "array", items: { type: "string" }, default: [] },
  },
};

export const UpdateEventSchema = {
  type: "object",
  required: ["version"],
  description:
    "Partial event update. All fields except version are optional. Version is required for optimistic concurrency control.",
  properties: {
    version: {
      type: "integer",
      minimum: 1,
      description: "Must match current version. Re-fetch on 409 conflict.",
    },
    title: { type: "string" },
    description: { type: ["string", "null"] },
    location: { $ref: "#/components/schemas/Location" },
    temporal: { $ref: "#/components/schemas/Temporal" },
    categories: { type: "array", items: { type: "string" } },
    source_id: { type: "string" },
    source_url: { type: ["string", "null"] },
    relevance_score: { type: "number", minimum: 0, maximum: 1 },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    status: {
      type: "string",
      enum: ["active", "cancelled", "tentative", "past"],
    },
    links: { $ref: "#/components/schemas/Links" },
    images: { type: "array", items: { type: "string" } },
    price_indication: { type: ["string", "null"] },
    suitable_for: { type: "array", items: { type: "string" } },
  },
};

export const EventVersionSchema = {
  type: "object",
  required: [
    "id",
    "event_id",
    "version",
    "changed_at",
    "changed_by",
    "diff",
    "snapshot",
  ],
  properties: {
    id: { type: "string" },
    event_id: { type: "string" },
    version: { type: "integer" },
    changed_at: { type: "string", format: "date-time" },
    changed_by: {
      type: "string",
      description:
        "Who made the change: 'ingest-agent', 'manual', 'review-agent', 'seed'",
    },
    diff: {
      type: "object",
      description: "Changed fields with { from, to } values",
    },
    snapshot: {
      type: "object",
      description: "Full event state at this version",
    },
  },
};

export const SourceSchema = {
  type: "object",
  required: ["id", "name", "trust_level"],
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    url: { type: ["string", "null"] },
    trust_level: { type: "number", minimum: 0, maximum: 1 },
    last_scraped: { type: ["string", "null"], format: "date-time" },
    scrape_config: { type: ["object", "null"] },
  },
};

export const IngestRunSchema = {
  type: "object",
  required: ["id", "source_id", "started_at", "status"],
  properties: {
    id: { type: "string" },
    source_id: { type: "string" },
    started_at: { type: "string", format: "date-time" },
    completed_at: { type: ["string", "null"], format: "date-time" },
    status: { type: "string", enum: ["running", "completed", "failed"] },
    events_found: { type: "integer", default: 0 },
    events_created: { type: "integer", default: 0 },
    events_updated: { type: "integer", default: 0 },
    events_skipped: { type: "integer", default: 0 },
    avg_confidence: { type: ["number", "null"] },
    tokens_used: { type: "integer", default: 0 },
    cost_usd: { type: "number", default: 0 },
    error: { type: ["string", "null"] },
  },
};

export const HealthStatusSchema = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["healthy"] },
    database: {
      type: "object",
      properties: { connected: { type: "boolean" } },
    },
    events: {
      type: "object",
      properties: {
        total_active: { type: "integer" },
        by_temporal_type: {
          type: "object",
          properties: {
            point: { type: "integer" },
            range: { type: "integer" },
            recurring: { type: "integer" },
            seasonal: { type: "integer" },
          },
        },
        by_confidence: {
          type: "object",
          properties: {
            "0.0-0.3": { type: "integer" },
            "0.3-0.6": { type: "integer" },
            "0.6-0.8": { type: "integer" },
            "0.8-1.0": { type: "integer" },
          },
        },
      },
    },
    sources: {
      type: "array",
      items: {
        type: "object",
        properties: {
          source_id: { type: "string" },
          source_name: { type: "string" },
          last_completed: { type: ["string", "null"], format: "date-time" },
          events_found: { type: "integer" },
        },
      },
    },
    timestamp: { type: "string", format: "date-time" },
  },
};

export const ReviewReportSchema = {
  type: "object",
  properties: {
    events_checked: { type: "integer" },
    events_confirmed: {
      type: "integer",
      description: "Events still found at source URL",
    },
    events_updated: {
      type: "integer",
      description: "Events with changed details or cancelled status",
    },
    events_stale: {
      type: "integer",
      description:
        "Events no longer found at source URL (confidence lowered)",
    },
    tokens_used: { type: "integer" },
    cost_usd: { type: "number" },
    errors: { type: "array", items: { type: "string" } },
  },
};

export const PaginationMetaSchema = {
  type: "object",
  properties: {
    total_count: { type: "integer" },
    page: { type: "integer" },
    per_page: { type: "integer" },
    has_more: { type: "boolean" },
  },
};

export const ApiErrorSchema = {
  type: "object",
  required: ["code", "message", "retryable"],
  properties: {
    code: { type: "string" },
    message: { type: "string" },
    suggestion: { type: "string" },
    retryable: { type: "boolean" },
  },
};

export const ErrorResponseSchema = {
  type: "object",
  properties: {
    data: { type: "null" },
    meta: { type: "object" },
    errors: {
      type: "array",
      items: { $ref: "#/components/schemas/ApiError" },
    },
  },
};
