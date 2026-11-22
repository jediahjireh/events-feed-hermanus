import { NextResponse } from "next/server";
import { OPENAPI_SPEC } from "@/lib/openapi/spec";

/**
 * GET /api/schema — serve the OpenAPI 3.1 spec.
 *
 * This is what AI agents and API tools read to discover the API.
 * Served as raw JSON (not wrapped in the standard response envelope).
 *
 * Spec definition lives in src/lib/openapi/ (schemas, paths, spec).
 */
export async function GET() {
  return NextResponse.json(OPENAPI_SPEC, {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
