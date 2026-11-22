/**
 * Assembles the full OpenAPI 3.1 specification from schemas and paths.
 */

import {
  LocationSchema,
  RecurrenceSchema,
  TemporalSchema,
  LinksSchema,
  EventSchema,
  CreateEventSchema,
  UpdateEventSchema,
  EventVersionSchema,
  SourceSchema,
  IngestRunSchema,
  HealthStatusSchema,
  ReviewReportSchema,
  PaginationMetaSchema,
  ApiErrorSchema,
  ErrorResponseSchema,
} from "./schemas";
import { paths } from "./paths";

export const OPENAPI_SPEC = {
  openapi: "3.1.0",
  info: {
    title: "Hermanus Event Feed API",
    version: "1.0.0",
    description:
      "Agent-friendly REST API for local events in Hermanus, South Africa. Query events by travel dates, categories, and traveller profiles to answer: 'What is on while my traveller is there?'",
    contact: { name: "Hermanus Event Feed" },
  },
  servers: [{ url: "/api", description: "Relative API base" }],
  paths,
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        description:
          "CRON_SECRET token sent by Vercel for scheduled cron jobs",
      },
    },
    schemas: {
      Location: LocationSchema,
      Recurrence: RecurrenceSchema,
      Temporal: TemporalSchema,
      Links: LinksSchema,
      Event: EventSchema,
      CreateEvent: CreateEventSchema,
      UpdateEvent: UpdateEventSchema,
      EventVersion: EventVersionSchema,
      Source: SourceSchema,
      IngestRun: IngestRunSchema,
      HealthStatus: HealthStatusSchema,
      ReviewReport: ReviewReportSchema,
      PaginationMeta: PaginationMetaSchema,
      ApiError: ApiErrorSchema,
      ErrorResponse: ErrorResponseSchema,
    },
  },
};
