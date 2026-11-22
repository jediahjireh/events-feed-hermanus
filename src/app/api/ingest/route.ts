import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sources, ingestRuns } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ulid } from "ulid";
import { IngestTriggerSchema, apiSuccess, apiError } from "@/types/api";
import { executeIngest } from "@/lib/ingest-pipeline";

/**
 * POST /api/ingest — trigger an ingestion run.
 * Body: { source_id } or { source_id: "all" }.
 *
 * Returns 202 immediately with the run record(s).
 * The actual pipeline runs asynchronously in the background.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = IngestTriggerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        apiError(
          "VALIDATION_ERROR",
          "Invalid ingest trigger",
          "Provide { source_id: '<id>' } or { source_id: 'all' }",
          false
        ),
        { status: 422 }
      );
    }

    const { source_id } = parsed.data;

    // Determine which sources to ingest
    let sourceRows;
    if (source_id === "all") {
      sourceRows = await db.select().from(sources);
    } else {
      sourceRows = await db
        .select()
        .from(sources)
        .where(eq(sources.id, source_id));

      if (sourceRows.length === 0) {
        return NextResponse.json(
          apiError(
            "SOURCE_NOT_FOUND",
            `Source '${source_id}' not found`,
            "Check GET /api/sources for available sources",
            false
          ),
          { status: 404 }
        );
      }
    }

    // Create ingest run records and kick off pipelines
    const runs = [];
    for (const source of sourceRows) {
      const runId = ulid();
      const [run] = await db
        .insert(ingestRuns)
        .values({
          id: runId,
          source_id: source.id,
          started_at: new Date(),
          status: "running",
        })
        .returning();
      runs.push(run);

      // Fire-and-forget: run the pipeline without awaiting
      executeIngest(source.id, source.url, runId).catch((err) =>
        console.error(`Ingest [${source.id}] unhandled error:`, err)
      );
    }

    return NextResponse.json(
      apiSuccess(runs.length === 1 ? runs[0] : runs),
      { status: 202 }
    );
  } catch (error) {
    console.error("POST /api/ingest error:", error);
    return NextResponse.json(
      apiError(
        "INTERNAL_ERROR",
        "Failed to trigger ingestion",
        undefined,
        true
      ),
      { status: 500 }
    );
  }
}
