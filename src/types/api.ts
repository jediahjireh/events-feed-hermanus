import { z } from "zod/v4";

// --- Standard API response shapes ---

export type ApiResponse<T> = {
  data: T;
  meta: ApiMeta;
  errors: ApiError[];
};

export type ApiMeta = {
  total_count?: number;
  page?: number;
  per_page?: number;
  has_more?: boolean;
  [key: string]: unknown;
};

export type ApiError = {
  code: string;
  message: string;
  suggestion?: string;
  retryable: boolean;
};

// --- Reusable pagination params ---

export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
});

// --- Query parameters for GET /api/events ---

export const EventQuerySchema = z
  .object({
    q: z.string().optional(), // free-text search on title + description
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    categories: z.string().optional(), // comma-separated
    suitable_for: z.string().optional(), // comma-separated
    source_id: z.string().optional(),
    min_confidence: z.coerce.number().min(0).max(1).default(0.6),
    status: z
      .enum(["active", "cancelled", "tentative", "past"])
      .default("active"),
    sort: z.enum(["relevance", "date", "confidence"]).default("relevance"),
  })
  .extend(PaginationSchema.shape)
  .refine((data) => !data.from || !data.to || data.from <= data.to, {
    message: "'from' must be on or before 'to'",
    path: ["from"],
  });

export type EventQuery = z.infer<typeof EventQuerySchema>;

// --- Ingest trigger input ---

export const IngestTriggerSchema = z.object({
  source_id: z.string().min(1),
});

export type IngestTriggerInput = z.infer<typeof IngestTriggerSchema>;

// --- Ingest run query ---

export const IngestRunQuerySchema = z
  .object({
    source_id: z.string().optional(),
  })
  .extend(PaginationSchema.shape);

export type IngestRunQuery = z.infer<typeof IngestRunQuerySchema>;

// --- Helper to build error responses ---

export function apiError(
  code: string,
  message: string,
  suggestion?: string,
  retryable = false
): ApiResponse<null> {
  return {
    data: null,
    meta: {},
    errors: [{ code, message, suggestion, retryable }],
  };
}

// --- Helper to build success responses ---

export function apiSuccess<T>(
  data: T,
  meta: ApiMeta = {}
): ApiResponse<T> {
  return { data, meta, errors: [] };
}

// --- Helper to build paginated responses ---

export function apiPaginated<T>(
  data: T[],
  total_count: number,
  page: number,
  per_page: number
): ApiResponse<T[]> {
  return {
    data,
    meta: {
      total_count,
      page,
      per_page,
      has_more: page * per_page < total_count,
    },
    errors: [],
  };
}
