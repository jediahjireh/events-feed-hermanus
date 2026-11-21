import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { events, eventVersions, sources } from "@/db/schema";
import { eq, and, gte, inArray, sql } from "drizzle-orm";
import { ulid } from "ulid";
import { EventQuerySchema, apiPaginated, apiError, apiSuccess } from "@/types/api";
import { CreateEventSchema } from "@/types/event";
import { overlaps, nextOccurrenceInRange, parseDate } from "@/lib/temporal";
import { slugify } from "@/lib/slug";

/**
 * GET /api/events — the primary query endpoint.
 *
 * Fetches events, filters by temporal overlap with travel dates,
 * categories, suitable_for, min_confidence, and status.
 * Paginates and sorts results.
 */
export async function GET(request: NextRequest) {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams);
    const parsed = EventQuerySchema.safeParse(params);

    if (!parsed.success) {
      return NextResponse.json(
        apiError(
          "INVALID_QUERY",
          "Invalid query parameters",
          parsed.error.issues.map((i) => `${i.path}: ${i.message}`).join("; "),
          false
        ),
        { status: 400 }
      );
    }

    const query = parsed.data;

    // Build DB filters
    const conditions = [eq(events.status, query.status)];

    if (query.min_confidence > 0) {
      conditions.push(gte(events.confidence, query.min_confidence));
    }

    // Fetch events matching static filters
    const rows = await db
      .select()
      .from(events)
      .where(and(...conditions));

    // Apply temporal overlap filter in application code
    let filtered = rows;
    if (query.from && query.to) {
      const travelStart = parseDate(query.from);
      const travelEnd = parseDate(query.to);

      filtered = rows.filter((row) =>
        overlaps(row.temporal, travelStart, travelEnd)
      );
    }

    // Filter by categories (comma-separated, any match)
    if (query.categories) {
      const cats = query.categories.split(",").map((c) => c.trim());
      filtered = filtered.filter((row) =>
        (row.categories ?? []).some((c: string) => cats.includes(c))
      );
    }

    // Filter by suitable_for (comma-separated, any match)
    if (query.suitable_for) {
      const profiles = query.suitable_for.split(",").map((s) => s.trim());
      filtered = filtered.filter((row) =>
        (row.suitable_for ?? []).some((s: string) => profiles.includes(s))
      );
    }

    // Sort
    if (query.sort === "relevance") {
      filtered.sort((a, b) => b.relevance_score - a.relevance_score);
    } else if (query.sort === "confidence") {
      filtered.sort((a, b) => b.confidence - a.confidence);
    } else if (query.sort === "date") {
      filtered.sort((a, b) => {
        const dateA = a.temporal.start_date ?? "";
        const dateB = b.temporal.start_date ?? "";
        return dateA.localeCompare(dateB);
      });
    }

    // Paginate
    const total = filtered.length;
    const start = (query.page - 1) * query.per_page;
    const page = filtered.slice(start, start + query.per_page);

    // Enrich recurring events with next_occurrence_in_range
    const enriched = page.map((row) => {
      const result: Record<string, unknown> = { ...row };
      if (row.temporal.type === "recurring" && query.from && query.to) {
        const next = nextOccurrenceInRange(
          row.temporal,
          parseDate(query.from),
          parseDate(query.to)
        );
        if (next) {
          result.next_occurrence_in_range = next.toISOString().slice(0, 10);
        }
      }
      return result;
    });

    return NextResponse.json(
      apiPaginated(enriched, total, query.page, query.per_page)
    );
  } catch (error) {
    console.error("GET /api/events error:", error);
    return NextResponse.json(
      apiError("INTERNAL_ERROR", "Failed to fetch events", undefined, true),
      { status: 500 }
    );
  }
}

/**
 * POST /api/events — create a new event.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = CreateEventSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        apiError(
          "VALIDATION_ERROR",
          "Invalid event data",
          parsed.error.issues.map((i) => `${i.path}: ${i.message}`).join("; "),
          false
        ),
        { status: 422 }
      );
    }

    const data = parsed.data;

    // Verify source exists
    const [source] = await db
      .select()
      .from(sources)
      .where(eq(sources.id, data.source_id))
      .limit(1);

    if (!source) {
      return NextResponse.json(
        apiError(
          "SOURCE_NOT_FOUND",
          `Source '${data.source_id}' not found`,
          "Create the source first via POST /api/sources",
          false
        ),
        { status: 404 }
      );
    }

    const id = ulid();
    const now = new Date();
    const slug = slugify(data.title);

    const [created] = await db
      .insert(events)
      .values({
        id,
        title: data.title,
        slug,
        description: data.description,
        location: data.location,
        temporal: data.temporal,
        categories: data.categories,
        source_id: data.source_id,
        source_url: data.source_url,
        relevance_score: data.relevance_score,
        confidence: data.confidence,
        status: data.status,
        links: data.links,
        images: data.images,
        price_indication: data.price_indication,
        suitable_for: data.suitable_for,
        created_at: now,
        updated_at: now,
        ingested_at: now,
        version: 1,
      })
      .returning();

    // Create initial version record
    await db.insert(eventVersions).values({
      id: ulid(),
      event_id: id,
      version: 1,
      changed_at: now,
      changed_by: "manual",
      diff: { action: "created" },
      snapshot: { ...created },
    });

    return NextResponse.json(apiSuccess(created), { status: 201 });
  } catch (error) {
    console.error("POST /api/events error:", error);
    return NextResponse.json(
      apiError("INTERNAL_ERROR", "Failed to create event", undefined, true),
      { status: 500 }
    );
  }
}
