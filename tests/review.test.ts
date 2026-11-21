/**
 * Review Agent tests — verify the event re-verification pipeline.
 *
 * Mocks: Anthropic SDK (Claude verification), database (Drizzle), global fetch.
 * Tests the review flow: select events → fetch source URLs → verify → update.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Hoisted mocks ---
const { mockCreate, mockDbSelect, mockDbUpdate, mockDbInsert } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockDbSelect: vi.fn(),
  mockDbUpdate: vi.fn(),
  mockDbInsert: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    select: mockDbSelect,
    update: mockDbUpdate,
    insert: mockDbInsert,
  },
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
  },
}));

import { runReview } from "@/agents/review";

// --- Test data ---
const eventWithSourceUrl = {
  id: "evt-1",
  title: "FynArts Festival 2027",
  source_url: "https://fynarts.co.za",
  links: null,
  status: "active",
  confidence: 0.85,
  version: 1,
  temporal: {
    type: "range" as const,
    start_date: "2027-06-11",
    end_date: "2027-06-15",
    start_month: null,
    end_month: null,
    recurrence: null,
    dates: null,
  },
  location: {
    name: "FynArts Hermanus",
    venue: "Various venues",
    town: "Hermanus",
    region: "Overberg",
    province: "Western Cape",
    country: "ZA",
    lat: null,
    lng: null,
    radius_km: null,
  },
  categories: ["art", "music"],
  suitable_for: ["couples", "solo", "luxury"],
};

const eventWithoutSourceUrl = {
  ...eventWithSourceUrl,
  id: "evt-2",
  title: "Whale Watching Season",
  source_url: null,
  links: null,
  temporal: {
    type: "seasonal" as const,
    start_date: null,
    end_date: null,
    start_month: 6,
    end_month: 11,
    recurrence: null,
    dates: null,
  },
};

const eventWithLinksSourceUrl = {
  ...eventWithSourceUrl,
  id: "evt-3",
  title: "Event with link source",
  source_url: null,
  links: { source_url: "https://example.com/event" },
};

function makeVerificationResponse(json: Record<string, unknown>) {
  return {
    content: [{ type: "text", text: JSON.stringify(json) }],
    usage: { input_tokens: 300, output_tokens: 100 },
  };
}

function setupDbMocks(events: Record<string, unknown>[]) {
  // select().from(events).where(...) chain for selectEventsForReview
  mockDbSelect.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(events),
    }),
  });
  mockDbUpdate.mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "updated" }]),
      }),
    }),
  });
  mockDbInsert.mockReturnValue({
    values: vi.fn().mockResolvedValue([]),
  });
}

describe("runReview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("returns empty report when no events to review", async () => {
    setupDbMocks([]);

    const report = await runReview("all");

    expect(report.events_checked).toBe(0);
    expect(report.events_confirmed).toBe(0);
    expect(report.events_updated).toBe(0);
    expect(report.events_stale).toBe(0);
  });

  it("skips events without a source URL", async () => {
    setupDbMocks([eventWithoutSourceUrl]);

    const report = await runReview("all");

    expect(report.events_checked).toBe(1);
    // Event is checked but skipped (no source URL to verify against)
    expect(report.events_confirmed).toBe(0);
    expect(report.events_updated).toBe(0);
    expect(report.events_stale).toBe(0);
    // Claude should NOT have been called (no URL to fetch)
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("confirms an event still found at source URL", async () => {
    setupDbMocks([eventWithSourceUrl]);

    // Mock fetch to return a page containing the event
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("<html>FynArts Festival 2027 - June 11-15</html>"),
      })
    );

    mockCreate.mockResolvedValueOnce(
      makeVerificationResponse({
        found: true,
        cancelled: false,
        details_changed: false,
        changes: null,
        confidence: 0.9,
        reasoning: "Event is still listed on the page",
      })
    );

    const report = await runReview("all");

    expect(report.events_checked).toBe(1);
    expect(report.events_confirmed).toBe(1);
    expect(report.events_updated).toBe(0);
    expect(report.events_stale).toBe(0);
    expect(report.tokens_used).toBe(400);
  });

  it("marks event as cancelled when Claude detects cancellation", async () => {
    setupDbMocks([eventWithSourceUrl]);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: () =>
          Promise.resolve("<html>FynArts Festival 2027 - CANCELLED</html>"),
      })
    );

    mockCreate.mockResolvedValueOnce(
      makeVerificationResponse({
        found: true,
        cancelled: true,
        details_changed: false,
        changes: null,
        confidence: 0.95,
        reasoning: "Page clearly states event is cancelled",
      })
    );

    const report = await runReview("all");

    expect(report.events_checked).toBe(1);
    expect(report.events_updated).toBe(1);
    // DB update should have been called to set status to cancelled
    expect(mockDbUpdate).toHaveBeenCalled();
  });

  it("lowers confidence when source URL returns 404", async () => {
    setupDbMocks([eventWithSourceUrl]);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      })
    );

    const report = await runReview("all");

    expect(report.events_checked).toBe(1);
    expect(report.events_stale).toBe(1);
    // Claude should NOT have been called (page gone, no content to verify)
    expect(mockCreate).not.toHaveBeenCalled();
    // DB should have been updated to lower confidence
    expect(mockDbUpdate).toHaveBeenCalled();
  });

  it("records fetch error without changing the event", async () => {
    setupDbMocks([eventWithSourceUrl]);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network timeout"))
    );

    const report = await runReview("all");

    expect(report.events_checked).toBe(1);
    expect(report.events_confirmed).toBe(0);
    expect(report.events_stale).toBe(0);
    expect(report.errors.length).toBeGreaterThan(0);
    expect(report.errors[0]).toContain("Network timeout");
  });

  it("handles event not found on page (source gone)", async () => {
    setupDbMocks([eventWithSourceUrl]);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("<html>No events listed</html>"),
      })
    );

    mockCreate.mockResolvedValueOnce(
      makeVerificationResponse({
        found: false,
        cancelled: false,
        details_changed: false,
        changes: null,
        confidence: 0.3,
        reasoning: "Event is no longer listed on this page",
      })
    );

    const report = await runReview("all");

    expect(report.events_checked).toBe(1);
    expect(report.events_stale).toBe(1);
    expect(mockDbUpdate).toHaveBeenCalled();
  });

  it("applies detail changes detected by Claude", async () => {
    setupDbMocks([eventWithSourceUrl]);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: () =>
          Promise.resolve(
            "<html>FynArts Festival 2027 - Now June 12-16!</html>"
          ),
      })
    );

    mockCreate.mockResolvedValueOnce(
      makeVerificationResponse({
        found: true,
        cancelled: false,
        details_changed: true,
        changes: { description: "Dates moved to June 12-16" },
        confidence: 0.85,
        reasoning: "Event found but dates changed",
      })
    );

    const report = await runReview("all");

    expect(report.events_checked).toBe(1);
    expect(report.events_updated).toBe(1);
    expect(mockDbUpdate).toHaveBeenCalled();
  });

  it("uses links.source_url as fallback when source_url is null", async () => {
    setupDbMocks([eventWithLinksSourceUrl]);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("<html>Event page</html>"),
    });
    vi.stubGlobal("fetch", mockFetch);

    mockCreate.mockResolvedValueOnce(
      makeVerificationResponse({
        found: true,
        cancelled: false,
        details_changed: false,
        changes: null,
        confidence: 0.9,
        reasoning: "Found",
      })
    );

    const report = await runReview("all");

    expect(report.events_checked).toBe(1);
    expect(report.events_confirmed).toBe(1);
    // Should have fetched the links.source_url
    expect(mockFetch).toHaveBeenCalledWith(
      "https://example.com/event",
      expect.any(Object)
    );
  });

  it("calculates cost from token usage", async () => {
    setupDbMocks([eventWithSourceUrl]);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("<html>Event</html>"),
      })
    );

    mockCreate.mockResolvedValueOnce(
      makeVerificationResponse({
        found: true,
        cancelled: false,
        details_changed: false,
        changes: null,
        confidence: 0.9,
        reasoning: "ok",
      })
    );

    const report = await runReview("all");

    expect(report.tokens_used).toBe(400);
    expect(report.cost_usd).toBeGreaterThan(0);
  });
});
