/**
 * OpenAPI 3.1 path definitions.
 *
 * Each key is an API path relative to the server base (/api).
 * References component schemas via $ref.
 */

/** Helper: wrap a schema in the standard { data, meta, errors } envelope. */
function envelope(dataSchema: object) {
  return {
    type: "object",
    properties: {
      data: dataSchema,
      meta: { type: "object" },
      errors: {
        type: "array",
        items: { $ref: "#/components/schemas/ApiError" },
      },
    },
  };
}

/** Helper: paginated envelope (data is an array, meta includes pagination). */
function paginatedEnvelope(itemRef: string) {
  return {
    type: "object",
    properties: {
      data: { type: "array", items: { $ref: itemRef } },
      meta: { $ref: "#/components/schemas/PaginationMeta" },
      errors: {
        type: "array",
        items: { $ref: "#/components/schemas/ApiError" },
      },
    },
  };
}

/** Helper: standard JSON response content wrapper. */
function jsonContent(schema: object) {
  return { content: { "application/json": { schema } } };
}

export const paths = {
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
          name: "source_id",
          in: "query",
          description: "Filter by source (e.g. quicket, eventbrite, manual)",
          schema: { type: "string" },
          example: "quicket",
        },
        {
          name: "min_confidence",
          in: "query",
          description: "Minimum confidence threshold (0-1)",
          schema: { type: "number", minimum: 0, maximum: 1, default: 0.6 },
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
          schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
        },
      ],
      responses: {
        "200": {
          description: "Paginated list of matching events",
          ...jsonContent(paginatedEnvelope("#/components/schemas/Event")),
        },
        "400": {
          description: "Invalid query parameters",
          ...jsonContent({ $ref: "#/components/schemas/ErrorResponse" }),
        },
      },
    },
    post: {
      operationId: "createEvent",
      summary: "Create a new event",
      requestBody: {
        required: true,
        ...jsonContent({ $ref: "#/components/schemas/CreateEvent" }),
      },
      responses: {
        "201": {
          description: "Event created",
          ...jsonContent(envelope({ $ref: "#/components/schemas/Event" })),
        },
        "404": {
          description: "Source not found",
          ...jsonContent({ $ref: "#/components/schemas/ErrorResponse" }),
        },
        "422": {
          description: "Validation error",
          ...jsonContent({ $ref: "#/components/schemas/ErrorResponse" }),
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
          ...jsonContent(envelope({ $ref: "#/components/schemas/Event" })),
        },
        "404": {
          description: "Event not found",
          ...jsonContent({ $ref: "#/components/schemas/ErrorResponse" }),
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
        ...jsonContent({ $ref: "#/components/schemas/UpdateEvent" }),
      },
      responses: {
        "200": {
          description: "Event updated",
          ...jsonContent(envelope({ $ref: "#/components/schemas/Event" })),
        },
        "404": { description: "Event not found" },
        "409": { description: "Version conflict — re-fetch and retry" },
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
          ...jsonContent(envelope({ $ref: "#/components/schemas/Event" })),
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
          schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
        },
      ],
      responses: {
        "200": {
          description: "Paginated version history",
          ...jsonContent(
            paginatedEnvelope("#/components/schemas/EventVersion")
          ),
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
          ...jsonContent(
            envelope({
              type: "array",
              items: { $ref: "#/components/schemas/Source" },
            })
          ),
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
        ...jsonContent({
          type: "object",
          required: ["source_id"],
          properties: {
            source_id: {
              type: "string",
              description: "Source ID or 'all' to ingest from all sources",
            },
          },
        }),
      },
      responses: {
        "202": {
          description: "Ingestion run(s) created",
          ...jsonContent(
            envelope({ $ref: "#/components/schemas/IngestRun" })
          ),
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
          schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
        },
      ],
      responses: {
        "200": {
          description: "Paginated ingest run history",
          ...jsonContent(
            paginatedEnvelope("#/components/schemas/IngestRun")
          ),
        },
      },
    },
  },
  "/review": {
    post: {
      operationId: "triggerReview",
      summary: "Trigger a review pass on existing events",
      description:
        "Re-fetches source URLs, asks Claude Haiku to verify each event is still listed, and updates confidence/status. Returns a review report.",
      requestBody: {
        required: false,
        ...jsonContent({
          type: "object",
          properties: {
            scope: {
              type: "string",
              enum: ["upcoming", "low-confidence", "all"],
              default: "upcoming",
              description:
                "upcoming = events in next 30 days + recurring/seasonal; low-confidence = confidence <= 0.7; all = all active events",
            },
          },
        }),
      },
      responses: {
        "200": {
          description: "Review report",
          ...jsonContent(
            envelope({ $ref: "#/components/schemas/ReviewReport" })
          ),
        },
        "422": { description: "Validation error" },
      },
    },
  },
  "/cron": {
    get: {
      operationId: "cronTrigger",
      summary: "Vercel Cron handler — daily ingest + weekly review",
      description:
        "Called automatically by Vercel Cron at 06:00 UTC daily. Triggers ingest for all sources (fire-and-forget). On Mondays, also runs the review agent (scope: upcoming). Requires CRON_SECRET via Authorization: Bearer header.",
      security: [{ bearerAuth: [] }],
      responses: {
        "200": {
          description: "Cron job triggered successfully",
          ...jsonContent(
            envelope({
              type: "object",
              properties: {
                ingest: {
                  type: "object",
                  properties: {
                    sources_triggered: { type: "integer" },
                    run_ids: { type: "array", items: { type: "string" } },
                  },
                },
                review: {
                  oneOf: [
                    { $ref: "#/components/schemas/ReviewReport" },
                    {
                      type: "object",
                      properties: {
                        skipped: { type: "boolean" },
                        reason: { type: "string" },
                      },
                    },
                  ],
                },
                triggered_at: { type: "string", format: "date-time" },
              },
            })
          ),
        },
        "401": { description: "Invalid or missing CRON_SECRET" },
        "500": { description: "Cron job failed" },
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
          ...jsonContent(
            envelope({ $ref: "#/components/schemas/HealthStatus" })
          ),
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
          ...jsonContent({ type: "object" }),
        },
      },
    },
  },
};
