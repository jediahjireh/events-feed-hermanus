import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ingestRuns } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { IngestRunQuerySchema, apiPaginated, apiError } from "@/types/api";

/**
 * GET /api/ingest/runs — history of ingestion runs with stats.
 */
export async function GET(request: NextRequest) {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams);
    const parsed = IngestRunQuerySchema.safeParse(params);

    if (!parsed.success) {
      return NextResponse.json(
        apiError("INVALID_QUERY", "Invalid query parameters", undefined, false),
        { status: 400 }
      );
    }

    const query = parsed.data;

    const conditions = [];
    if (query.source_id) {
      conditions.push(eq(ingestRuns.source_id, query.source_id));
    }

    const rows = await db
      .select()
      .from(ingestRuns)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(ingestRuns.started_at));

    const total = rows.length;
    const start = (query.page - 1) * query.per_page;
    const page = rows.slice(start, start + query.per_page);

    return NextResponse.json(
      apiPaginated(page, total, query.page, query.per_page)
    );
  } catch (error) {
    console.error("GET /api/ingest/runs error:", error);
    return NextResponse.json(
      apiError(
        "INTERNAL_ERROR",
        "Failed to fetch ingest runs",
        undefined,
        true
      ),
      { status: 500 }
    );
  }
}
