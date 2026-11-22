import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { events, eventVersions, sources, ingestRuns } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ulid } from "ulid";
import { executeIngest } from "@/lib/ingest-pipeline";
import { runReview } from "@/agents/review";
import { apiSuccess, apiError } from "@/types/api";

/**
 * GET /api/cron — Vercel Cron handler.
 *
 * Schedule: Daily at 06:00 UTC (08:00 SAST).
 * - Always: triggers ingest for all sources (fire-and-forget).
 * - Mondays: also runs the review agent (scope: "upcoming").
 *
 * Protected by CRON_SECRET via Authorization: Bearer header.
 * Vercel injects this header automatically for configured cron jobs.
 */
export async function GET(request: NextRequest) {
  // Verify CRON_SECRET
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      apiError("UNAUTHORIZED", "Invalid or missing cron secret", undefined, false),
      { status: 401 }
    );
  }

  try {
    // Ingest all sources (fire-and-forget — Apify calls take 30-120s)
    const sourceRows = await db.select().from(sources);
    const runIds: string[] = [];

    for (const source of sourceRows) {
      const runId = ulid();
      await db.insert(ingestRuns).values({
        id: runId,
        source_id: source.id,
        started_at: new Date(),
        status: "running",
      });
      runIds.push(runId);

      // Fire-and-forget — starts HTTP request immediately.
      // Cannot use setTimeout on Vercel serverless (context terminates after response).
      executeIngest(source.id, source.url, runId).catch((err) =>
        console.error(`Cron ingest [${source.id}] error:`, err)
      );
    }

    // Run review on Mondays (getUTCDay() === 1)
    const isMonday = new Date().getUTCDay() === 1;
    let review: Record<string, unknown> = { skipped: true, reason: "Not Monday" };

    if (isMonday) {
      const report = await runReview("upcoming");
      review = report as unknown as Record<string, unknown>;
    }

    // Mark past events (runs daily)
    const pastCount = await markPastEvents();

    const result = {
      ingest: { sources_triggered: sourceRows.length, run_ids: runIds },
      review,
      events_marked_past: pastCount,
      triggered_at: new Date().toISOString(),
    };

    console.log("Cron completed:", JSON.stringify(result));
    return NextResponse.json(apiSuccess(result));
  } catch (error) {
    console.error("GET /api/cron error:", error);
    return NextResponse.json(
      apiError("CRON_FAILED", "Cron job failed", undefined, true),
      { status: 500 }
    );
  }
}

/**
 * Mark active events whose dates have fully passed as "past".
 *
 * Checks point (start_date), range (end_date), and recurring (end_date) events.
 * Seasonal events are never marked past (they recur every year).
 */
async function markPastEvents(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);

  const activeEvents = await db
    .select({ id: events.id, version: events.version, temporal: events.temporal })
    .from(events)
    .where(eq(events.status, "active"));

  let count = 0;

  for (const event of activeEvents) {
    const t = event.temporal;
    let isPast = false;

    switch (t.type) {
      case "point":
        if (t.start_date < today) isPast = true;
        break;
      case "range":
        if (t.end_date < today) isPast = true;
        break;
      case "recurring":
        if (t.end_date && t.end_date < today) isPast = true;
        break;
      // Seasonal events recur every year — never auto-mark as past
    }

    if (isPast) {
      const now = new Date();
      const newVersion = event.version + 1;
      const [updated] = await db
        .update(events)
        .set({ status: "past", updated_at: now, version: newVersion })
        .where(eq(events.id, event.id))
        .returning({ id: events.id });

      if (updated) {
        await db.insert(eventVersions).values({
          id: ulid(),
          event_id: updated.id,
          version: newVersion,
          changed_at: now,
          changed_by: "cron",
          diff: { action: "marked_past", previous_status: "active" },
          snapshot: { id: updated.id, status: "past", temporal: t },
        });
      }
      count++;
    }
  }

  if (count > 0) {
    console.log(`Cron: marked ${count} event(s) as past`);
  }

  return count;
}
