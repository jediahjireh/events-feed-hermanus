import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { chatMonthlySpend } from "@/db/schema";
import { eq } from "drizzle-orm";
import { apiSuccess, apiError } from "@/types/api";

/**
 * GET /api/chat/spend/:month — get monthly spend for a given month (YYYY-MM format).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ month: string }> }
) {
  try {
    const { month } = await params;

    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        apiError(
          "INVALID_MONTH",
          "Invalid month format",
          "Use YYYY-MM format (e.g., 2026-11)",
          false
        ),
        { status: 400 }
      );
    }

    const [row] = await db
      .select()
      .from(chatMonthlySpend)
      .where(eq(chatMonthlySpend.month_key, month))
      .limit(1);

    const spend = row
      ? { total_usd: row.total_usd, query_count: row.query_count }
      : { total_usd: 0, query_count: 0 };

    return NextResponse.json(apiSuccess(spend));
  } catch (error) {
    console.error("GET /api/chat/spend/:month error:", error);
    return NextResponse.json(
      apiError(
        "SPEND_FETCH_FAILED",
        "Failed to fetch spend data",
        error instanceof Error ? error.message : String(error),
        true
      ),
      { status: 500 }
    );
  }
}
