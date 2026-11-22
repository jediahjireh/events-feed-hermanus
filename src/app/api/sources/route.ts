import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sources } from "@/db/schema";
import { PaginationSchema, apiPaginated, apiError } from "@/types/api";

/**
 * GET /api/sources — list all configured sources with last_scraped timestamp.
 */
export async function GET(request: NextRequest) {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams);
    const parsed = PaginationSchema.safeParse(params);

    if (!parsed.success) {
      return NextResponse.json(
        apiError("INVALID_QUERY", "Invalid query parameters", undefined, false),
        { status: 400 }
      );
    }

    const { page, per_page } = parsed.data;

    const rows = await db.select().from(sources);

    const total = rows.length;
    const start = (page - 1) * per_page;
    const pageData = rows.slice(start, start + per_page);

    return NextResponse.json(apiPaginated(pageData, total, page, per_page));
  } catch (error) {
    console.error("GET /api/sources error:", error);
    return NextResponse.json(
      apiError("INTERNAL_ERROR", "Failed to fetch sources", undefined, true),
      { status: 500 }
    );
  }
}
