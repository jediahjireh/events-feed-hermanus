import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ingestRuns } from "@/db/schema";
import { eq } from "drizzle-orm";
import { apiSuccess, apiError } from "@/types/api";

/**
 * PATCH /api/ingest/runs/:id — cancel a stuck "running" ingest run.
 * Sets status to "failed" with an error message indicating manual cancellation.
 */
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [run] = await db
      .select()
      .from(ingestRuns)
      .where(eq(ingestRuns.id, id))
      .limit(1);

    if (!run) {
      return NextResponse.json(
        apiError("NOT_FOUND", `Ingest run '${id}' not found`, undefined, false),
        { status: 404 }
      );
    }

    if (run.status !== "running") {
      return NextResponse.json(
        apiError(
          "INVALID_STATE",
          `Run is already '${run.status}', only running runs can be cancelled`,
          undefined,
          false
        ),
        { status: 409 }
      );
    }

    const [updated] = await db
      .update(ingestRuns)
      .set({
        status: "failed",
        completed_at: new Date(),
        error: "Manually cancelled by user",
      })
      .where(eq(ingestRuns.id, id))
      .returning();

    return NextResponse.json(apiSuccess(updated));
  } catch (error) {
    console.error("PATCH /api/ingest/runs/[id] error:", error);
    return NextResponse.json(
      apiError("INTERNAL_ERROR", "Failed to cancel ingest run", undefined, true),
      { status: 500 }
    );
  }
}
