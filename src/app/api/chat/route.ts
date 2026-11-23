import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import { chatMonthlySpend } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { apiSuccess, apiError } from "@/types/api";

/**
 * POST /api/chat — conversational agent that queries the events API.
 *
 * Request body: { question: string, history: Array<{ role, content }> }
 * Response: { answer: string, toolCalls: Array, usage: { input_tokens, output_tokens } }
 *
 * Uses Claude function calling with three tools:
 * - query_events: Search for events with filters (dates, categories, etc.)
 * - get_event_detail: Get full details for a specific event by ID
 * - get_health: Check system health (DB status, ingestion stats, event counts)
 */

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const TOOLS: Anthropic.Tool[] = [
  {
    name: "query_events",
    description: `Search for events in Hermanus, South Africa. Filters by travel dates (from/to), categories (music, market, wildlife, art, sport, food-wine, family), suitable_for traveller types (luxury, budget, family, couples, solo, adventure, culture), min_confidence (0-1), and free-text search (q). Returns paginated results with event details including temporal info, venue, and links.

Parameters:
- from, to: Travel date range in YYYY-MM-DD format (both required for temporal filtering)
- categories: Comma-separated list (e.g. "music,market")
- suitable_for: Comma-separated traveller profiles (e.g. "luxury,couples")
- min_confidence: Minimum confidence score 0-1 (default 0.6)
- q: Free-text search on title/description
- source_id: Filter by source (google-events, facebook, eventbrite, tripadvisor, quicket, manual)
- sort: "relevance" (requires suitable_for) or "confidence"
- page: Page number (default 1)
- per_page: Results per page (default 20, max 100)
- status: "active" (default) or "archived"`,
    input_schema: {
      type: "object",
      properties: {
        from: { type: "string", description: "Start date YYYY-MM-DD" },
        to: { type: "string", description: "End date YYYY-MM-DD" },
        categories: {
          type: "string",
          description: "Comma-separated: music, market, wildlife, art, sport, food-wine, family",
        },
        suitable_for: {
          type: "string",
          description: "Comma-separated: luxury, budget, family, couples, solo, adventure, culture",
        },
        min_confidence: { type: "number", description: "0-1, default 0.6" },
        q: { type: "string", description: "Free-text search" },
        source_id: { type: "string", description: "Source filter" },
        sort: { type: "string", description: "relevance or confidence" },
        page: { type: "number", description: "Page number" },
        per_page: { type: "number", description: "Results per page (max 100)" },
        status: { type: "string", description: "active or archived" },
      },
    },
  },
  {
    name: "get_event_detail",
    description: `Get full details for a specific event by its ID. Returns the complete event record including all temporal data, location, categories, suitable_for traveller types, links, and metadata (source, confidence, created/updated times).`,
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Event ID (ULID format)" },
      },
      required: ["id"],
    },
  },
  {
    name: "get_health",
    description: `Get system health check: database connection status, last successful ingestion per source (google-events, facebook, eventbrite, tripadvisor, quicket, scraped sites), total active events by temporal type (point, range, recurring, seasonal), and confidence distribution. Use this to understand data freshness and coverage.`,
    input_schema: {
      type: "object",
      properties: {},
    },
  },
];

const SYSTEM_PROMPT = `You are Ask API — a helpful assistant that queries the Hermanus Event Feed API to answer questions about events in Hermanus, South Africa.

You have access to three tools:
- query_events: Search for events with filters (dates, categories, traveller profiles, confidence, free-text search)
- get_event_detail: Get full details for a specific event
- get_health: Check system health and data freshness

**Key concepts:**

1. **Temporal model** — Events have four temporal types:
   - point: Single date (e.g. "2026-12-25")
   - range: Date range (e.g. "2026-06-01 to 2026-11-30")
   - recurring: Regular schedule (e.g. "Every Saturday" with recurrence rules)
   - seasonal: Month ranges without specific dates (e.g. "June to November" for whale season)

2. **Categories**: music, market, wildlife, art, sport, food-wine, family

3. **Traveller profiles (suitable_for)**: luxury, budget, family, couples, solo, adventure, culture

4. **Confidence**: 0-1 score indicating extraction certainty. Default min is 0.6. Low-confidence events exist but don't appear by default.

5. **Sources**: google-events (Google Events via SerpAPI), facebook (Facebook Events via Apify), eventbrite (Eventbrite via SerpAPI), tripadvisor (TripAdvisor via SerpAPI), quicket (Quicket via Apify scraper), plus scraped sites (hermanus.co.za, ShowMe Hermanus, fynarts.co.za), and manual submissions.

**Response style:**
- Be conversational and helpful
- When showing events, format them clearly with key details (title, date, venue, categories)
- For recurring/seasonal events, explain the temporal pattern in natural language
- If no events match, suggest alternative queries or date ranges
- Surface confidence scores when relevant (low confidence = uncertain data)
- For whale watching queries, note the whale season is typically June-November (seasonal pattern)

**Dig deeper section:**
If the user might want to refine their search, end your response with:

**Dig deeper:**
- [Question 1 that would refine or expand the query?]
- [Question 2 that explores a related angle?]
- [Question 3 that narrows down based on traveller type or category?]

Only include "Dig deeper" if follow-up questions would be useful. Keep questions short and actionable.`;

type Turn = {
  role: "user" | "assistant";
  content: string;
};

type RequestBody = {
  question: string;
  history?: Turn[];
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody;
    const { question, history = [] } = body;

    if (!question || typeof question !== "string") {
      return NextResponse.json(
        apiError(
          "INVALID_REQUEST",
          "Missing or invalid 'question' field",
          "Provide a question string in the request body",
          false
        ),
        { status: 400 }
      );
    }

    const messages: Anthropic.MessageParam[] = [
      ...history.map((turn) => ({
        role: turn.role,
        content: turn.content,
      })),
      {
        role: "user" as const,
        content: question,
      },
    ];

    let response = await anthropic.messages.create({
      model: "claude-haiku-5-5",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    });

    const toolCalls: Array<{ tool: string; input: unknown; result: unknown }> = [];
    let totalInputTokens = response.usage.input_tokens;
    let totalOutputTokens = response.usage.output_tokens;

    // Function calling loop — max 10 rounds to prevent infinite loops
    for (let round = 0; round < 10; round++) {
      if (response.stop_reason !== "tool_use") break;

      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
      );

      if (toolUseBlocks.length === 0) break;

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        let result: unknown;
        try {
          result = await executeTool(toolUse.name, toolUse.input);
        } catch (err) {
          result = {
            error: err instanceof Error ? err.message : String(err),
          };
        }

        toolCalls.push({
          tool: toolUse.name,
          input: toolUse.input,
          result,
        });

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
      }

      // Continue conversation with tool results
      response = await anthropic.messages.create({
        model: "claude-haiku-5-5",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages: [
          ...messages,
          {
            role: "assistant",
            content: response.content,
          },
          {
            role: "user",
            content: toolResults,
          },
        ],
      });

      totalInputTokens += response.usage.input_tokens;
      totalOutputTokens += response.usage.output_tokens;
    }

    // Extract final text answer
    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );
    const answer = textBlock?.text ?? "(no answer)";

    // Track monthly spend (Claude Haiku 5.5 pricing: $0.10/M input, $0.50/M output)
    const costUsd =
      (totalInputTokens * 0.1 + totalOutputTokens * 0.5) / 1_000_000;

    try {
      const monthKey = new Date().toISOString().slice(0, 7); // YYYY-MM
      await db
        .insert(chatMonthlySpend)
        .values({
          month_key: monthKey,
          total_usd: costUsd,
          query_count: 1,
          updated_at: new Date(),
        })
        .onConflictDoUpdate({
          target: chatMonthlySpend.month_key,
          set: {
            total_usd: sql`${chatMonthlySpend.total_usd} + ${costUsd}`,
            query_count: sql`${chatMonthlySpend.query_count} + 1`,
            updated_at: new Date(),
          },
        });
    } catch (err) {
      console.warn("Failed to update monthly spend:", err);
      // Don't fail the request if spend tracking fails
    }

    return NextResponse.json(
      apiSuccess({
        answer,
        toolCalls,
        usage: {
          input_tokens: totalInputTokens,
          output_tokens: totalOutputTokens,
        },
      })
    );
  } catch (error) {
    console.error("POST /api/chat error:", error);
    return NextResponse.json(
      apiError(
        "CHAT_FAILED",
        "Failed to process chat request",
        error instanceof Error ? error.message : String(error),
        true
      ),
      { status: 500 }
    );
  }
}

/**
 * Execute a tool call by making an internal API request.
 */
async function executeTool(name: string, input: unknown): Promise<unknown> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

  switch (name) {
    case "query_events": {
      const params = new URLSearchParams();
      const inp = input as Record<string, unknown>;
      for (const [key, value] of Object.entries(inp)) {
        if (value !== undefined && value !== null) {
          params.set(key, String(value));
        }
      }
      const url = `${baseUrl}/api/events?${params.toString()}`;
      const res = await fetch(url);
      return await res.json();
    }

    case "get_event_detail": {
      const inp = input as { id: string };
      const url = `${baseUrl}/api/events/${inp.id}`;
      const res = await fetch(url);
      return await res.json();
    }

    case "get_health": {
      const url = `${baseUrl}/api/health`;
      const res = await fetch(url);
      return await res.json();
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
