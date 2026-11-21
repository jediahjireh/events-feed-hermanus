import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sources } from "@/db/schema";
import { apiSuccess, apiError } from "@/types/api";

/**
 * GET /api/sources — list all configured sources with last_scraped timestamp.
 */
export async function GET() {
  try {
    const rows = await db.select().from(sources);
    return NextResponse.json(apiSuccess(rows));
  } catch (error) {
    console.error("GET /api/sources error:", error);
    return NextResponse.json(
      apiError("INTERNAL_ERROR", "Failed to fetch sources", undefined, true),
      { status: 500 }
    );
  }
}
