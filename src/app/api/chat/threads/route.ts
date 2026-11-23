import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { chatThreads, chatMonthlySpend } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { ulid } from "ulid";
import { apiSuccess, apiError } from "@/types/api";

/**
 * GET /api/chat/threads — list all chat threads (newest first).
 */
export async function GET() {
  try {
    const threads = await db
      .select()
      .from(chatThreads)
      .orderBy(desc(chatThreads.updated_at));

    return NextResponse.json(apiSuccess(threads));
  } catch (error) {
    console.error("GET /api/chat/threads error:", error);
    return NextResponse.json(
      apiError(
        "THREADS_FETCH_FAILED",
        "Failed to fetch threads",
        error instanceof Error ? error.message : String(error),
        true
      ),
      { status: 500 }
    );
  }
}

/**
 * POST /api/chat/threads — create a new chat thread.
 *
 * Request body: { title: string, messages: Array }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, messages = [] } = body;

    if (!title || typeof title !== "string") {
      return NextResponse.json(
        apiError(
          "INVALID_REQUEST",
          "Missing or invalid 'title' field",
          "Provide a title string",
          false
        ),
        { status: 400 }
      );
    }

    const id = ulid();
    const thread = {
      id,
      title: title.slice(0, 80),
      messages,
      cost_usd: 0,
      tokens_input: 0,
      tokens_output: 0,
      created_at: new Date(),
      updated_at: new Date(),
    };

    await db.insert(chatThreads).values(thread);

    return NextResponse.json(apiSuccess({ id }), { status: 201 });
  } catch (error) {
    console.error("POST /api/chat/threads error:", error);
    return NextResponse.json(
      apiError(
        "THREAD_CREATE_FAILED",
        "Failed to create thread",
        error instanceof Error ? error.message : String(error),
        true
      ),
      { status: 500 }
    );
  }
}

/**
 * PUT /api/chat/threads/:id — update an existing thread.
 *
 * Request body: { messages: Array, costUsd?: number, tokensInput?: number, tokensOutput?: number, title?: string }
 */
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        apiError("INVALID_REQUEST", "Missing thread ID", "", false),
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      messages,
      costUsd,
      tokensInput,
      tokensOutput,
      title,
    } = body;

    const updates: Record<string, unknown> = {
      updated_at: new Date(),
    };

    if (messages) updates.messages = messages;
    if (typeof costUsd === "number") updates.cost_usd = costUsd;
    if (typeof tokensInput === "number") updates.tokens_input = tokensInput;
    if (typeof tokensOutput === "number") updates.tokens_output = tokensOutput;
    if (title) updates.title = title.slice(0, 80);

    await db
      .update(chatThreads)
      .set(updates)
      .where(eq(chatThreads.id, id));

    return NextResponse.json(apiSuccess({ updated: true }));
  } catch (error) {
    console.error("PUT /api/chat/threads error:", error);
    return NextResponse.json(
      apiError(
        "THREAD_UPDATE_FAILED",
        "Failed to update thread",
        error instanceof Error ? error.message : String(error),
        true
      ),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/chat/threads/:id — delete a thread.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        apiError("INVALID_REQUEST", "Missing thread ID", "", false),
        { status: 400 }
      );
    }

    await db.delete(chatThreads).where(eq(chatThreads.id, id));

    return NextResponse.json(apiSuccess({ deleted: true }));
  } catch (error) {
    console.error("DELETE /api/chat/threads error:", error);
    return NextResponse.json(
      apiError(
        "THREAD_DELETE_FAILED",
        "Failed to delete thread",
        error instanceof Error ? error.message : String(error),
        true
      ),
      { status: 500 }
    );
  }
}
