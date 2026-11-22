import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { runReview } from "@/agents/review";
import { apiSuccess, apiError } from "@/types/api";

const ReviewTriggerSchema = z.object({
  scope: z.enum(["upcoming", "low-confidence", "all"]).default("upcoming"),
});

/**
 * POST /api/review — trigger a review pass on existing events.
 *
 * Body: { scope?: "upcoming" | "low-confidence" | "all" }
 * Default scope is "upcoming" (events happening in next 30 days).
 *
 * The review agent re-fetches source URLs, asks Claude Haiku to verify
 * each event is still listed, and updates confidence/status accordingly.
 *
 * Returns the review report synchronously. For the Hermanus dataset
 * (~10 events), this completes well within Vercel's function timeout.
 */
export async function POST(request: NextRequest) {
  try {
    let body: unknown = {};
    const text = await request.text();
    if (text.trim()) {
      try {
        body = JSON.parse(text);
      } catch {
        return NextResponse.json(
          apiError(
            "INVALID_JSON",
            "Request body is not valid JSON",
            "Send a JSON object like { \"scope\": \"upcoming\" } or omit the body entirely",
            false
          ),
          { status: 400 }
        );
      }
    }
    const parsed = ReviewTriggerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        apiError(
          "VALIDATION_ERROR",
          "Invalid review trigger",
          "Provide { scope: 'upcoming' | 'low-confidence' | 'all' }",
          false
        ),
        { status: 422 }
      );
    }

    const { scope } = parsed.data;
    const report = await runReview(scope);

    return NextResponse.json(apiSuccess(report));
  } catch (error) {
    console.error("POST /api/review error:", error);
    return NextResponse.json(
      apiError(
        "INTERNAL_ERROR",
        "Failed to run review",
        undefined,
        true
      ),
      { status: 500 }
    );
  }
}
