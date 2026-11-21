import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { events, eventVersions } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { apiPaginated, apiError } from "@/types/api";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/events/:id/versions — version history (audit trail).
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    // Verify event exists
    const [event] = await db
      .select({ id: events.id })
      .from(events)
      .where(eq(events.id, id))
      .limit(1);

    if (!event) {
      return NextResponse.json(
        apiError("NOT_FOUND", `Event '${id}' not found`, undefined, false),
        { status: 404 }
      );
    }

    const page = Number(request.nextUrl.searchParams.get("page") ?? 1);
    const perPage = Math.min(
      Number(request.nextUrl.searchParams.get("per_page") ?? 20),
      100
    );

    const versions = await db
      .select()
      .from(eventVersions)
      .where(eq(eventVersions.event_id, id))
      .orderBy(desc(eventVersions.version));

    const total = versions.length;
    const start = (page - 1) * perPage;
    const pageData = versions.slice(start, start + perPage);

    return NextResponse.json(apiPaginated(pageData, total, page, perPage));
  } catch (error) {
    console.error("GET /api/events/:id/versions error:", error);
    return NextResponse.json(
      apiError(
        "INTERNAL_ERROR",
        "Failed to fetch event versions",
        undefined,
        true
      ),
      { status: 500 }
    );
  }
}
