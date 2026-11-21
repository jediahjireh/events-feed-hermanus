/**
 * Ingest Agent tests — verify the ingestion pipeline logic.
 *
 * Mocks: Anthropic SDK (Claude extraction), database (Drizzle).
 * Tests the pipeline flow: extraction → validation → dedup → store.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Hoisted mocks (available in vi.mock factories) ---
const { mockInsert, mockUpdate, mockCreate } = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockCreate: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    insert: mockInsert,
    update: mockUpdate,
    select: () => ({
      from: () => Promise.resolve([]), // No existing events for dedup
    }),
  },
}));

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = { create: mockCreate };
    },
  };
});

import { runIngest } from "@/agents/ingest";

function makeClaudeResponse(json: Record<string, unknown>) {
  return {
    content: [{ type: "text", text: JSON.stringify(json) }],
    usage: { input_tokens: 500, output_tokens: 200 },
  };
}

function resetDbMocks() {
  mockInsert.mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([
        {
          id: "created-id",
          title: "Test Event",
          version: 1,
          temporal: { type: "point", start_date: "2027-12-25" },
          location: {
            name: "Test",
            town: "Hermanus",
            region: "Overberg",
            province: "Western Cape",
            country: "ZA",
          },
        },
      ]),
    }),
  });
  mockUpdate.mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    }),
  });
}

describe("runIngest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMocks();
  });

  it("returns empty report for no raw events", async () => {
    const report = await runIngest("test-source", [], "run-1");

    expect(report.events_found).toBe(0);
    expect(report.events_created).toBe(0);
    expect(report.events_updated).toBe(0);
    expect(report.events_skipped).toBe(0);
    expect(report.errors).toHaveLength(0);
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("extracts and creates a valid point event", async () => {
    mockCreate.mockResolvedValueOnce(
      makeClaudeResponse({
        title: "Christmas Market",
        description: "Annual Christmas market in Hermanus",
        location: {
          name: "Hermanus Town Centre",
          venue: "Market Square",
          town: "Hermanus",
          region: "Overberg",
          province: "Western Cape",
          country: "ZA",
        },
        temporal: { type: "point", start_date: "2027-12-25" },
        categories: ["market"],
        confidence: 0.8,
        price_indication: "free entry",
        suitable_for: ["families", "couples"],
        reasoning: "Single date event on Christmas Day",
      })
    );

    const report = await runIngest(
      "test-source",
      [{ title: "Christmas Market", date: "2027-12-25" }],
      "run-2"
    );

    expect(report.events_found).toBe(1);
    expect(report.events_created).toBe(1);
    expect(report.events_skipped).toBe(0);
    expect(report.tokens_used).toBe(700);
    expect(report.errors).toHaveLength(0);
  });

  it("extracts a seasonal event with correct temporal normalisation", async () => {
    mockCreate.mockResolvedValueOnce(
      makeClaudeResponse({
        title: "Whale Season",
        description: null,
        location: {
          name: "Hermanus",
          town: "Hermanus",
          region: "Overberg",
          province: "Western Cape",
          country: "ZA",
        },
        temporal: { type: "seasonal", start_month: 6, end_month: 11 },
        categories: ["wildlife"],
        confidence: 0.9,
        suitable_for: ["couples", "families"],
        reasoning: "Seasonal whale watching from June to November",
      })
    );

    const report = await runIngest(
      "test-source",
      [{ title: "Whale Season" }],
      "run-3"
    );

    expect(report.events_found).toBe(1);
    expect(report.events_created).toBe(1);
    expect(report.avg_confidence).toBe(0.9);
  });

  it("extracts a recurring event", async () => {
    mockCreate.mockResolvedValueOnce(
      makeClaudeResponse({
        title: "Saturday Market",
        description: null,
        location: {
          name: "Market",
          town: "Hermanus",
          region: "Overberg",
          province: "Western Cape",
          country: "ZA",
        },
        temporal: {
          type: "recurring",
          recurrence: {
            frequency: "weekly",
            day_of_week: 5,
            interval: 1,
            exceptions: [],
          },
        },
        categories: ["market"],
        confidence: 0.85,
        suitable_for: ["families"],
        reasoning: "Weekly Saturday market",
      })
    );

    const report = await runIngest(
      "test-source",
      [{ title: "Saturday Market" }],
      "run-4"
    );

    expect(report.events_found).toBe(1);
    expect(report.events_created).toBe(1);
  });

  it("handles Claude returning markdown-wrapped JSON", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: '```json\n{"title":"Wrapped Event","description":null,"location":{"name":"Test","town":"Hermanus","region":"Overberg","province":"Western Cape","country":"ZA"},"temporal":{"type":"point","start_date":"2027-01-01"},"categories":["music"],"confidence":0.7,"suitable_for":[],"reasoning":"test"}\n```',
        },
      ],
      usage: { input_tokens: 400, output_tokens: 150 },
    });

    const report = await runIngest(
      "test-source",
      [{ title: "Some Event" }],
      "run-5"
    );

    expect(report.events_created).toBe(1);
    expect(report.errors).toHaveLength(0);
  });

  it("records error when Claude returns invalid JSON", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "This is not JSON at all" }],
      usage: { input_tokens: 300, output_tokens: 50 },
    });

    const report = await runIngest(
      "test-source",
      [{ title: "Bad Event" }],
      "run-6"
    );

    expect(report.events_found).toBe(1);
    expect(report.events_created).toBe(0);
    // Extraction failure returns null and continues — not counted as skipped
    // (events_skipped only increments for validation failures or medium-confidence dedup)
    expect(report.errors.length).toBeGreaterThan(0);
    expect(report.errors[0]).toContain("Extraction failed");
  });

  it("handles multiple raw events and accumulates report", async () => {
    mockCreate
      .mockResolvedValueOnce(
        makeClaudeResponse({
          title: "Event One",
          description: null,
          location: { name: "V1", town: "Hermanus", region: "Overberg", province: "Western Cape", country: "ZA" },
          temporal: { type: "point", start_date: "2027-03-01" },
          categories: ["music"],
          confidence: 0.8,
          suitable_for: [],
          reasoning: "test",
        })
      )
      .mockResolvedValueOnce({
        content: [{ type: "text", text: "not json" }],
        usage: { input_tokens: 100, output_tokens: 20 },
      })
      .mockResolvedValueOnce(
        makeClaudeResponse({
          title: "Event Three",
          description: null,
          location: { name: "V3", town: "Hermanus", region: "Overberg", province: "Western Cape", country: "ZA" },
          temporal: { type: "point", start_date: "2027-04-01" },
          categories: ["art"],
          confidence: 0.7,
          suitable_for: [],
          reasoning: "test",
        })
      );

    const report = await runIngest(
      "test-source",
      [{ title: "One" }, { title: "Two" }, { title: "Three" }],
      "run-7"
    );

    expect(report.events_found).toBe(3);
    expect(report.events_created).toBe(2);
    // Extraction failure (event 2) doesn't increment events_skipped
    expect(report.errors).toHaveLength(1);
    expect(report.avg_confidence).toBe(0.75);
  });

  it("calculates cost from token usage", async () => {
    mockCreate.mockResolvedValueOnce(
      makeClaudeResponse({
        title: "Cost Test",
        description: null,
        location: { name: "Test", town: "Hermanus", region: "Overberg", province: "Western Cape", country: "ZA" },
        temporal: { type: "point", start_date: "2027-01-01" },
        categories: [],
        confidence: 0.5,
        suitable_for: [],
        reasoning: "test",
      })
    );

    const report = await runIngest(
      "test-source",
      [{ title: "Test" }],
      "run-8"
    );

    expect(report.cost_usd).toBeGreaterThan(0);
    expect(report.tokens_used).toBe(700);
  });
});
