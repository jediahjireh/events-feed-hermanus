/**
 * Shared ingest pipeline logic.
 *
 * Used by both POST /api/ingest (manual trigger) and GET /api/cron (scheduled).
 * Extracted from the ingest route to avoid duplication.
 */

import { db } from "@/db";
import { ingestRuns } from "@/db/schema";
import { eq } from "drizzle-orm";
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
export async function fetchRawEvents(
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
 * Called fire-and-forget by both the HTTP endpoint and the cron handler.
 */
export async function executeIngest(
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
