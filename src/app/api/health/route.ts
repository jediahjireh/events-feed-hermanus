import { NextResponse } from "next/server";
import { db } from "@/db";
import { events, sources, ingestRuns } from "@/db/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import { apiSuccess, apiError } from "@/types/api";

/**
 * GET /api/health — system health check.
 *
 * Returns: DB connection status, last successful ingest per source,
 * total active events by temporal type, confidence distribution.
 */
export async function GET() {
  try {
    // Test DB connection
    const dbCheck = await db.execute(sql`SELECT 1 as ok`);
    const dbConnected = dbCheck.rows.length > 0;

    // Last successful ingest per source
    const allSources = await db.select().from(sources);
    const lastIngests = [];
    for (const source of allSources) {
      const [lastRun] = await db
        .select()
        .from(ingestRuns)
        .where(
          and(
            eq(ingestRuns.source_id, source.id),
            eq(ingestRuns.status, "completed")
          )
        )
        .orderBy(desc(ingestRuns.completed_at))
        .limit(1);

      lastIngests.push({
        source_id: source.id,
        source_name: source.name,
        last_completed: lastRun?.completed_at ?? null,
        events_found: lastRun?.events_found ?? 0,
      });
    }

    // Active events by temporal type
    const activeEvents = await db
      .select()
      .from(events)
      .where(eq(events.status, "active"));

    const byType: Record<string, number> = {
      point: 0,
      range: 0,
      recurring: 0,
      seasonal: 0,
    };
    const byConfidence: Record<string, number> = {
      "0.0-0.3": 0,
      "0.3-0.6": 0,
      "0.6-0.8": 0,
      "0.8-1.0": 0,
    };

    for (const event of activeEvents) {
      byType[event.temporal.type] = (byType[event.temporal.type] ?? 0) + 1;

      if (event.confidence < 0.3) byConfidence["0.0-0.3"]++;
      else if (event.confidence < 0.6) byConfidence["0.3-0.6"]++;
      else if (event.confidence < 0.8) byConfidence["0.6-0.8"]++;
      else byConfidence["0.8-1.0"]++;
    }

    return NextResponse.json(
      apiSuccess({
        status: "healthy",
        database: { connected: dbConnected },
        events: {
          total_active: activeEvents.length,
          by_temporal_type: byType,
          by_confidence: byConfidence,
        },
        sources: lastIngests,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("GET /api/health error:", error);
    return NextResponse.json(
      apiError(
        "HEALTH_CHECK_FAILED",
        "System health check failed",
        "Database may be unreachable",
        true
      ),
      { status: 503 }
    );
  }
}
