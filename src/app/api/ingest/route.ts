import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sources, ingestRuns } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ulid } from "ulid";
import { IngestTriggerSchema, apiSuccess, apiError } from "@/types/api";
import { fetchGoogleEvents } from "@/lib/sources/google-events";
import { fetchFacebookEvents } from "@/lib/sources/facebook";
import { fetchEventbriteEvents } from "@/lib/sources/eventbrite";
import { fetchTripAdvisorItems } from "@/lib/sources/tripadvisor";
import { fetchQuicketEvents } from "@/lib/sources/quicket";
import { scrapeUrl } from "@/lib/sources/scraper";
import { runIngest } from "@/agents/ingest";

/**
 * Fetch raw events for a given source ID.
 * Returns an array of raw event objects to feed into the ingest agent.
 */
async function fetchRawEvents(
  sourceId: string,
  sourceUrl: string | null
): Promise<Record<string, unknown>[]> {
  switch (sourceId) {
    case "google-events": {
      const events = await fetchGoogleEvents();
      return events as unknown as Record<string, unknown>[];
    }
    case "facebook": {
      const events = await fetchFacebookEvents();
      return events as unknown as Record<string, unknown>[];
    }
    case "eventbrite": {
      const events = await fetchEventbriteEvents();
      return events as unknown as Record<string, unknown>[];
    }
    case "tripadvisor": {
      const events = await fetchTripAdvisorItems();
      return events as unknown as Record<string, unknown>[];
    }
    case "quicket": {
      const events = await fetchQuicketEvents();
      return events as unknown as Record<string, unknown>[];
    }
    case "manual":
      // Manual source has no fetcher — events are submitted via POST /api/events
      return [];
    default: {
      // For web-scraper sources, use the source URL with the Claude-powered scraper
      if (sourceUrl) {
        const result = await scrapeUrl(sourceUrl);
        return result.events as unknown as Record<string, unknown>[];
      }
      return [];
    }
  }
}

/**
 * Run the full ingestion pipeline for a source.
 * Called fire-and-forget after the HTTP response is sent.
 */
async function executeIngest(
  sourceId: string,
  sourceUrl: string | null,
  runId: string
): Promise<void> {
  try {
    const rawEvents = await fetchRawEvents(sourceId, sourceUrl);
    const report = await runIngest(sourceId, rawEvents, runId);
    console.log(
      `Ingest [${sourceId}] complete:`,
      `found=${report.events_found}`,
      `created=${report.events_created}`,
      `updated=${report.events_updated}`,
      `skipped=${report.events_skipped}`,
      `cost=$${report.cost_usd.toFixed(4)}`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Ingest [${sourceId}] failed:`, msg);
    // Mark the run as failed
    await db
      .update(ingestRuns)
      .set({
        completed_at: new Date(),
        status: "failed",
        error: msg,
      })
      .where(eq(ingestRuns.id, runId));
  }
}

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
