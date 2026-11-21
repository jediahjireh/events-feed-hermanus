import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { events, eventVersions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ulid } from "ulid";
import { UpdateEventSchema } from "@/types/event";
import { apiSuccess, apiError } from "@/types/api";
import { slugify } from "@/lib/slug";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/events/:id — single event with full detail.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.id, id))
      .limit(1);

    if (!event) {
      return NextResponse.json(
        apiError("NOT_FOUND", `Event '${id}' not found`, undefined, false),
        { status: 404 }
      );
    }

    return NextResponse.json(apiSuccess(event));
  } catch (error) {
    console.error("GET /api/events/:id error:", error);
    return NextResponse.json(
      apiError("INTERNAL_ERROR", "Failed to fetch event", undefined, true),
      { status: 500 }
    );
  }
}

/**
 * PUT /api/events/:id — update event.
 * Requires version field for optimistic concurrency.
 * Creates EventVersion on change.
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const parsed = UpdateEventSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        apiError(
          "VALIDATION_ERROR",
          "Invalid update data",
          parsed.error.issues.map((i) => `${i.path}: ${i.message}`).join("; "),
          false
        ),
        { status: 422 }
      );
    }

    const data = parsed.data;

    // Fetch current event
    const [current] = await db
      .select()
      .from(events)
      .where(eq(events.id, id))
      .limit(1);

    if (!current) {
      return NextResponse.json(
        apiError("NOT_FOUND", `Event '${id}' not found`, undefined, false),
        { status: 404 }
      );
    }

    // Optimistic concurrency check
    if (current.version !== data.version) {
      return NextResponse.json(
        apiError(
          "VERSION_CONFLICT",
          `Event was modified (current version: ${current.version}, your version: ${data.version})`,
          "Re-fetch the event and retry with the latest version",
          true
        ),
        { status: 409 }
      );
    }

    // Build the diff of changed fields
    const { version: _v, ...updateFields } = data;
    const diff: Record<string, { from: unknown; to: unknown }> = {};
    for (const [key, value] of Object.entries(updateFields)) {
      if (value !== undefined) {
        const currentValue = (current as Record<string, unknown>)[key];
        if (JSON.stringify(currentValue) !== JSON.stringify(value)) {
          diff[key] = { from: currentValue, to: value };
        }
      }
    }

    if (Object.keys(diff).length === 0) {
      return NextResponse.json(apiSuccess(current));
    }

    const now = new Date();
    const newVersion = current.version + 1;
    const slug = updateFields.title
      ? slugify(updateFields.title)
      : current.slug;

    const [updated] = await db
      .update(events)
      .set({
        ...updateFields,
        slug,
        updated_at: now,
        version: newVersion,
      })
      .where(eq(events.id, id))
      .returning();

    // Create version record
    await db.insert(eventVersions).values({
      id: ulid(),
      event_id: id,
      version: newVersion,
      changed_at: now,
      changed_by: "manual",
      diff,
      snapshot: { ...updated },
    });

    return NextResponse.json(apiSuccess(updated));
  } catch (error) {
    console.error("PUT /api/events/:id error:", error);
    return NextResponse.json(
      apiError("INTERNAL_ERROR", "Failed to update event", undefined, true),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/events/:id — soft delete (set status to "cancelled").
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const [current] = await db
      .select()
      .from(events)
      .where(eq(events.id, id))
      .limit(1);

    if (!current) {
      return NextResponse.json(
        apiError("NOT_FOUND", `Event '${id}' not found`, undefined, false),
        { status: 404 }
      );
    }

    const now = new Date();
    const newVersion = current.version + 1;

    const [updated] = await db
      .update(events)
      .set({
        status: "cancelled",
        updated_at: now,
        version: newVersion,
      })
      .where(eq(events.id, id))
      .returning();

    // Create version record for the cancellation
    await db.insert(eventVersions).values({
      id: ulid(),
      event_id: id,
      version: newVersion,
      changed_at: now,
      changed_by: "manual",
      diff: { status: { from: current.status, to: "cancelled" } },
      snapshot: { ...updated },
    });

    return NextResponse.json(apiSuccess(updated));
  } catch (error) {
    console.error("DELETE /api/events/:id error:", error);
    return NextResponse.json(
      apiError("INTERNAL_ERROR", "Failed to delete event", undefined, true),
      { status: 500 }
    );
  }
}
