import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sources, ingestRuns } from "@/db/schema";
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

    const result = {
      ingest: { sources_triggered: sourceRows.length, run_ids: runIds },
      review,
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
