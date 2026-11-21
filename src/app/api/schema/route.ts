import { NextResponse } from "next/server";

/**
 * GET /api/schema — serve the OpenAPI 3.1 spec.
 *
 * This is what AI agents and API tools read to discover the API.
 * Served as raw JSON (not wrapped in the standard response envelope).
 */
export async function GET() {
  return NextResponse.json(OPENAPI_SPEC, {
    headers: { "Content-Type": "application/json" },
  });
}

// --- Reusable component schemas ---

const LocationSchema = {
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

const RecurrenceSchema = {
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

const TemporalSchema = {
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

const LinksSchema = {
  type: ["object", "null"],
  properties: {
    website: { type: "string", format: "uri" },
    tickets: { type: "string", format: "uri" },
    source_url: { type: "string", format: "uri" },
  },
};

const EventSchema = {
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

const ApiErrorSchema = {
  type: "object",
  required: ["code", "message", "retryable"],
  properties: {
    code: { type: "string" },
    message: { type: "string" },
    suggestion: { type: "string" },
    retryable: { type: "boolean" },
  },
};

const PaginationMeta = {
  type: "object",
  properties: {
    total_count: { type: "integer" },
    page: { type: "integer" },
    per_page: { type: "integer" },
    has_more: { type: "boolean" },
  },
};

// --- The full OpenAPI 3.1 spec ---

const OPENAPI_SPEC = {
  openapi: "3.1.0",
  info: {
    title: "Hermanus Event Feed API",
    version: "1.0.0",
    description:
      "Agent-friendly REST API for local events in Hermanus, South Africa. Query events by travel dates, categories, and traveller profiles to answer: 'What is on while my traveller is there?'",
    contact: {
      name: "Hermanus Event Feed",
    },
  },
  servers: [{ url: "/api", description: "Relative API base" }],
  paths: {
    "/events": {
      get: {
        operationId: "listEvents",
        summary: "Query events by travel dates, categories, and profiles",
        description:
          "The primary query endpoint. Fetches events that overlap with the given travel date range, filtered by categories, traveller profiles, confidence threshold, and status. Recurring events are enriched with next_occurrence_in_range.",
        parameters: [
          {
            name: "from",
            in: "query",
            description: "Travel start date (ISO 8601)",
            schema: { type: "string", format: "date" },
            example: "2027-09-14",
          },
          {
            name: "to",
            in: "query",
            description: "Travel end date (ISO 8601)",
            schema: { type: "string", format: "date" },
            example: "2027-09-21",
          },
          {
            name: "categories",
            in: "query",
            description: "Comma-separated category filter (any match)",
            schema: { type: "string" },
            example: "wildlife,food-wine",
          },
          {
            name: "suitable_for",
            in: "query",
            description: "Comma-separated traveller profile filter (any match)",
            schema: { type: "string" },
            example: "couples,luxury",
          },
          {
            name: "min_confidence",
            in: "query",
            description: "Minimum confidence threshold (0-1)",
            schema: {
              type: "number",
              minimum: 0,
              maximum: 1,
              default: 0.6,
            },
          },
          {
            name: "status",
            in: "query",
            description: "Event status filter",
            schema: {
              type: "string",
              enum: ["active", "cancelled", "tentative", "past"],
              default: "active",
            },
          },
          {
            name: "sort",
            in: "query",
            description: "Sort order",
            schema: {
              type: "string",
              enum: ["relevance", "date", "confidence"],
              default: "relevance",
            },
          },
          {
            name: "page",
            in: "query",
            schema: { type: "integer", minimum: 1, default: 1 },
          },
          {
            name: "per_page",
            in: "query",
            schema: {
              type: "integer",
              minimum: 1,
              maximum: 100,
              default: 20,
            },
          },
        ],
        responses: {
          "200": {
            description: "Paginated list of matching events",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Event" },
                    },
                    meta: { $ref: "#/components/schemas/PaginationMeta" },
                    errors: {
                      type: "array",
                      items: { $ref: "#/components/schemas/ApiError" },
                    },
                  },
                },
              },
            },
          },
          "400": {
            description: "Invalid query parameters",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      post: {
        operationId: "createEvent",
        summary: "Create a new event",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateEvent" },
            },
          },
        },
        responses: {
          "201": {
            description: "Event created",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { $ref: "#/components/schemas/Event" },
                    meta: { type: "object" },
                    errors: {
                      type: "array",
                      items: { $ref: "#/components/schemas/ApiError" },
                    },
                  },
                },
              },
            },
          },
          "404": {
            description: "Source not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "422": {
            description: "Validation error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/events/{id}": {
      get: {
        operationId: "getEvent",
        summary: "Get a single event by ID",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Event ULID",
          },
        ],
        responses: {
          "200": {
            description: "Event detail",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { $ref: "#/components/schemas/Event" },
                    meta: { type: "object" },
                    errors: {
                      type: "array",
                      items: { $ref: "#/components/schemas/ApiError" },
                    },
                  },
                },
              },
            },
          },
          "404": {
            description: "Event not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      put: {
        operationId: "updateEvent",
        summary:
          "Update an event (optimistic concurrency via version field)",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateEvent" },
            },
          },
        },
        responses: {
          "200": {
            description: "Event updated",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { $ref: "#/components/schemas/Event" },
                    meta: { type: "object" },
                    errors: {
                      type: "array",
                      items: { $ref: "#/components/schemas/ApiError" },
                    },
                  },
                },
              },
            },
          },
          "404": { description: "Event not found" },
          "409": {
            description: "Version conflict — re-fetch and retry",
          },
          "422": { description: "Validation error" },
        },
      },
      delete: {
        operationId: "deleteEvent",
        summary: "Soft-delete an event (sets status to 'cancelled')",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Event cancelled",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { $ref: "#/components/schemas/Event" },
                    meta: { type: "object" },
                    errors: {
                      type: "array",
                      items: { $ref: "#/components/schemas/ApiError" },
                    },
                  },
                },
              },
            },
          },
          "404": { description: "Event not found" },
        },
      },
    },
    "/events/{id}/versions": {
      get: {
        operationId: "listEventVersions",
        summary: "Get version history (audit trail) for an event",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
          {
            name: "page",
            in: "query",
            schema: { type: "integer", minimum: 1, default: 1 },
          },
          {
            name: "per_page",
            in: "query",
            schema: {
              type: "integer",
              minimum: 1,
              maximum: 100,
              default: 20,
            },
          },
        ],
        responses: {
          "200": {
            description: "Paginated version history",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: {
                        $ref: "#/components/schemas/EventVersion",
                      },
                    },
                    meta: { $ref: "#/components/schemas/PaginationMeta" },
                    errors: {
                      type: "array",
                      items: { $ref: "#/components/schemas/ApiError" },
                    },
                  },
                },
              },
            },
          },
          "404": { description: "Event not found" },
        },
      },
    },
    "/sources": {
      get: {
        operationId: "listSources",
        summary: "List all configured event sources",
        responses: {
          "200": {
            description: "All sources",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Source" },
                    },
                    meta: { type: "object" },
                    errors: {
                      type: "array",
                      items: { $ref: "#/components/schemas/ApiError" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/ingest": {
      post: {
        operationId: "triggerIngest",
        summary: "Trigger an ingestion run for a source",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["source_id"],
                properties: {
                  source_id: {
                    type: "string",
                    description:
                      "Source ID or 'all' to ingest from all sources",
                  },
                },
              },
            },
          },
        },
        responses: {
          "202": {
            description: "Ingestion run(s) created",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { $ref: "#/components/schemas/IngestRun" },
                    meta: { type: "object" },
                    errors: {
                      type: "array",
                      items: { $ref: "#/components/schemas/ApiError" },
                    },
                  },
                },
              },
            },
          },
          "404": { description: "Source not found" },
          "422": { description: "Validation error" },
        },
      },
    },
    "/ingest/runs": {
      get: {
        operationId: "listIngestRuns",
        summary: "List ingestion run history with stats",
        parameters: [
          {
            name: "source_id",
            in: "query",
            description: "Filter by source ID",
            schema: { type: "string" },
          },
          {
            name: "page",
            in: "query",
            schema: { type: "integer", minimum: 1, default: 1 },
          },
          {
            name: "per_page",
            in: "query",
            schema: {
              type: "integer",
              minimum: 1,
              maximum: 100,
              default: 20,
            },
          },
        ],
        responses: {
          "200": {
            description: "Paginated ingest run history",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/IngestRun" },
                    },
                    meta: { $ref: "#/components/schemas/PaginationMeta" },
                    errors: {
                      type: "array",
                      items: { $ref: "#/components/schemas/ApiError" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/health": {
      get: {
        operationId: "healthCheck",
        summary: "System health check",
        description:
          "Returns database connection status, last successful ingest per source, event counts by temporal type, and confidence distribution.",
        responses: {
          "200": {
            description: "System healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      $ref: "#/components/schemas/HealthStatus",
                    },
                    meta: { type: "object" },
                    errors: {
                      type: "array",
                      items: { $ref: "#/components/schemas/ApiError" },
                    },
                  },
                },
              },
            },
          },
          "503": { description: "System unhealthy" },
        },
      },
    },
    "/schema": {
      get: {
        operationId: "getOpenApiSpec",
        summary: "Get this OpenAPI specification",
        responses: {
          "200": {
            description: "OpenAPI 3.1 JSON spec",
            content: {
              "application/json": { schema: { type: "object" } },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      Location: LocationSchema,
      Recurrence: RecurrenceSchema,
      Temporal: TemporalSchema,
      Links: LinksSchema,
      Event: EventSchema,
      CreateEvent: {
        type: "object",
        required: ["title", "location", "temporal", "source_id"],
        properties: {
          title: { type: "string", minLength: 1 },
          description: { type: ["string", "null"] },
          location: { $ref: "#/components/schemas/Location" },
          temporal: { $ref: "#/components/schemas/Temporal" },
          categories: {
            type: "array",
            items: { type: "string" },
            default: [],
          },
          source_id: { type: "string" },
          source_url: { type: ["string", "null"] },
          relevance_score: {
            type: "number",
            minimum: 0,
            maximum: 1,
            default: 0.5,
          },
          confidence: {
            type: "number",
            minimum: 0,
            maximum: 1,
            default: 0.5,
          },
          status: {
            type: "string",
            enum: ["active", "cancelled", "tentative", "past"],
            default: "active",
          },
          links: { $ref: "#/components/schemas/Links" },
          images: {
            type: "array",
            items: { type: "string" },
            default: [],
          },
          price_indication: { type: ["string", "null"] },
          suitable_for: {
            type: "array",
            items: { type: "string" },
            default: [],
          },
        },
      },
      UpdateEvent: {
        type: "object",
        required: ["version"],
        description:
          "Partial event update. All fields except version are optional. Version is required for optimistic concurrency control.",
        properties: {
          version: {
            type: "integer",
            minimum: 1,
            description:
              "Must match current version. Re-fetch on 409 conflict.",
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
      },
      EventVersion: {
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
      },
      Source: {
        type: "object",
        required: ["id", "name", "trust_level"],
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          url: { type: ["string", "null"] },
          trust_level: { type: "number", minimum: 0, maximum: 1 },
          last_scraped: {
            type: ["string", "null"],
            format: "date-time",
          },
          scrape_config: { type: ["object", "null"] },
        },
      },
      IngestRun: {
        type: "object",
        required: ["id", "source_id", "started_at", "status"],
        properties: {
          id: { type: "string" },
          source_id: { type: "string" },
          started_at: { type: "string", format: "date-time" },
          completed_at: {
            type: ["string", "null"],
            format: "date-time",
          },
          status: {
            type: "string",
            enum: ["running", "completed", "failed"],
          },
          events_found: { type: "integer", default: 0 },
          events_created: { type: "integer", default: 0 },
          events_updated: { type: "integer", default: 0 },
          events_skipped: { type: "integer", default: 0 },
          avg_confidence: { type: ["number", "null"] },
          tokens_used: { type: "integer", default: 0 },
          cost_usd: { type: "number", default: 0 },
          error: { type: ["string", "null"] },
        },
      },
      HealthStatus: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["healthy"] },
          database: {
            type: "object",
            properties: {
              connected: { type: "boolean" },
            },
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
                last_completed: {
                  type: ["string", "null"],
                  format: "date-time",
                },
                events_found: { type: "integer" },
              },
            },
          },
          timestamp: { type: "string", format: "date-time" },
        },
      },
      PaginationMeta: PaginationMeta,
      ApiError: ApiErrorSchema,
      ErrorResponse: {
        type: "object",
        properties: {
          data: { type: "null" },
          meta: { type: "object" },
          errors: {
            type: "array",
            items: { $ref: "#/components/schemas/ApiError" },
          },
        },
      },
    },
  },
};
