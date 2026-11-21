/**
 * Review Agent — re-verify existing events against their sources.
 *
 * Selects events to review, re-fetches source URLs, uses Claude Haiku
 * to check if events are still listed and whether details changed.
 * Updates status, confidence, and creates EventVersion records.
 */

import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import { events, eventVersions, sources } from "@/db/schema";
import { eq, and, gte, lte, or } from "drizzle-orm";
import { ulid } from "ulid";

type ReviewReport = {
  events_checked: number;
  events_confirmed: number;
  events_updated: number;
  events_stale: number;
  tokens_used: number;
  cost_usd: number;
  errors: string[];
};

type ReviewScope = "upcoming" | "low-confidence" | "all";

const REVIEW_PROMPT = `You are verifying whether an event is still listed on a webpage.

Event to verify:
Title: {title}
Date: {date_info}
Venue: {venue}

Does this page contain this event or a matching event? Consider:
1. Is the event still listed? (not removed or showing 404 content)
2. Have any details changed? (dates, venue, status)
3. Does the page indicate the event is cancelled?

Respond with ONLY valid JSON:
{
  "found": true/false,
  "cancelled": true/false,
  "details_changed": true/false,
  "changes": { "field": "new_value", ... } | null,
  "confidence": 0.0-1.0,
  "reasoning": "one sentence explanation"
}

Page content:
`;

/**
 * Run a review pass on existing events.
 */
export async function runReview(
  scope: ReviewScope = "upcoming"
): Promise<ReviewReport> {
  const report: ReviewReport = {
    events_checked: 0,
    events_confirmed: 0,
    events_updated: 0,
    events_stale: 0,
    tokens_used: 0,
    cost_usd: 0,
    errors: [],
  };

  // Select events to review based on scope
  const eventsToReview = await selectEventsForReview(scope);
  report.events_checked = eventsToReview.length;

  if (eventsToReview.length === 0) return report;

  const anthropic = new Anthropic();

  for (const event of eventsToReview) {
    try {
      const sourceUrl =
        event.source_url ?? event.links?.source_url;

      if (!sourceUrl) {
        // No source URL to check — skip
        continue;
      }

      // Fetch the source page
      let pageContent: string;
      try {
        const response = await fetch(sourceUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; HermanusEventFeed/1.0)",
          },
        });

        if (!response.ok) {
          if (response.status === 404) {
            // Source page gone — lower confidence, flag
            await handleSourceGone(event);
            report.events_stale++;
            continue;
          }
          throw new Error(`HTTP ${response.status}`);
        }

        pageContent = await response.text();
      } catch (fetchErr) {
        // Network error — don't change the event, just log
        report.errors.push(
          `Failed to fetch ${sourceUrl}: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)}`
        );
        continue;
      }

      // Truncate content
      const truncated = pageContent.slice(0, 50_000);

      // Build date info string
      const dateInfo = getDateInfo(event.temporal);

      // Ask Claude to verify
      const prompt = REVIEW_PROMPT.replace("{title}", event.title)
        .replace("{date_info}", dateInfo)
        .replace("{venue}", event.location.venue ?? "unknown");

      const result = await anthropic.messages.create({
        model: "claude-haiku-5-5",
        max_tokens: 512,
        messages: [
          {
            role: "user",
            content: prompt + truncated,
          },
        ],
      });

      report.tokens_used +=
        (result.usage?.input_tokens ?? 0) +
        (result.usage?.output_tokens ?? 0);

      // Find the text block — Haiku 5.5 may prepend thinking blocks
      const textBlock = result.content.find((b) => b.type === "text");
      const text = textBlock && "text" in textBlock ? textBlock.text : "";
      const jsonStr = text.replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim();

      try {
        const verification = JSON.parse(jsonStr);

        if (verification.cancelled) {
          await updateEventStatus(event.id, "cancelled", event.version);
          report.events_updated++;
        } else if (!verification.found) {
          await handleSourceGone(event);
          report.events_stale++;
        } else if (verification.details_changed && verification.changes) {
          await applyChanges(event, verification.changes);
          report.events_updated++;
        } else {
          // Event confirmed — bump last_verified_at
          await confirmEvent(event.id, event.version);
          report.events_confirmed++;
        }
      } catch {
        report.errors.push(`Failed to parse review result for "${event.title}"`);
      }
    } catch (err) {
      report.errors.push(
        `Review failed for "${event.title}": ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // Calculate cost
  report.cost_usd =
    (report.tokens_used * 0.1) / 1_000_000 +
    (report.tokens_used * 0.2 * 0.5) / 1_000_000;

  // Check source trust levels
  await updateSourceTrust(report);

  return report;
}

// --- Helpers ---

async function selectEventsForReview(scope: ReviewScope) {
  const now = new Date();
  const thirtyDaysFromNow = new Date(
    now.getTime() + 30 * 24 * 60 * 60 * 1000
  );

  if (scope === "low-confidence") {
    return db
      .select()
      .from(events)
      .where(
        and(eq(events.status, "active"), lte(events.confidence, 0.7))
      );
  }

  if (scope === "all") {
    return db
      .select()
      .from(events)
      .where(eq(events.status, "active"));
  }

  // "upcoming" — events happening in next 30 days
  // For simplicity, fetch all active and filter in app code
  const all = await db
    .select()
    .from(events)
    .where(eq(events.status, "active"));

  return all.filter((e) => {
    const t = e.temporal;
    if (t.type === "seasonal") return true; // Always review seasonal
    if (t.start_date) {
      const start = new Date(t.start_date);
      return start <= thirtyDaysFromNow && start >= now;
    }
    if (t.type === "recurring") return true; // Always review recurring
    return false;
  });
}

function getDateInfo(temporal: (typeof events.$inferSelect)["temporal"]): string {
  switch (temporal.type) {
    case "point":
      return temporal.start_date;
    case "range":
      return `${temporal.start_date} to ${temporal.end_date}`;
    case "recurring":
      return `recurring ${temporal.recurrence?.frequency ?? ""}`;
    case "seasonal":
      return `seasonal months ${temporal.start_month}-${temporal.end_month}`;
  }
}

async function handleSourceGone(
  event: typeof events.$inferSelect
): Promise<void> {
  const now = new Date();
  const newVersion = event.version + 1;
  const newConfidence = Math.max(event.confidence - 0.2, 0.1);
  const newStatus = newConfidence < 0.3 ? "tentative" : event.status;

  const [updated] = await db
    .update(events)
    .set({
      confidence: newConfidence,
      status: newStatus,
      updated_at: now,
      last_verified_at: now,
      version: newVersion,
    })
    .where(eq(events.id, event.id))
    .returning();

  await db.insert(eventVersions).values({
    id: ulid(),
    event_id: event.id,
    version: newVersion,
    changed_at: now,
    changed_by: "review-agent",
    diff: {
      action: "source_gone",
      confidence: { from: event.confidence, to: newConfidence },
      status: { from: event.status, to: newStatus },
    },
    snapshot: { ...updated },
  });
}

async function updateEventStatus(
  eventId: string,
  status: string,
  currentVersion: number
): Promise<void> {
  const now = new Date();
  const newVersion = currentVersion + 1;

  const [updated] = await db
    .update(events)
    .set({
      status: status as "active" | "cancelled" | "tentative" | "past",
      updated_at: now,
      last_verified_at: now,
      version: newVersion,
    })
    .where(eq(events.id, eventId))
    .returning();

  await db.insert(eventVersions).values({
    id: ulid(),
    event_id: eventId,
    version: newVersion,
    changed_at: now,
    changed_by: "review-agent",
    diff: { action: "status_changed", status },
    snapshot: { ...updated },
  });
}

async function confirmEvent(
  eventId: string,
  currentVersion: number
): Promise<void> {
  await db
    .update(events)
    .set({ last_verified_at: new Date() })
    .where(eq(events.id, eventId));
}

async function applyChanges(
  event: typeof events.$inferSelect,
  changes: Record<string, unknown>
): Promise<void> {
  const now = new Date();
  const newVersion = event.version + 1;

  const [updated] = await db
    .update(events)
    .set({
      ...changes,
      updated_at: now,
      last_verified_at: now,
      version: newVersion,
    } as Record<string, unknown>)
    .where(eq(events.id, event.id))
    .returning();

  await db.insert(eventVersions).values({
    id: ulid(),
    event_id: event.id,
    version: newVersion,
    changed_at: now,
    changed_by: "review-agent",
    diff: { action: "details_changed", changes },
    snapshot: { ...updated },
  });
}

async function updateSourceTrust(report: ReviewReport): Promise<void> {
  if (report.events_checked === 0) return;

  const staleRate = report.events_stale / report.events_checked;
  if (staleRate > 0.3) {
    // Lower trust level for sources with high stale rates
    // This is a simplified version — a full implementation would
    // track stale rates per source
    console.warn(
      `Review: ${(staleRate * 100).toFixed(0)}% stale rate detected. Consider lowering source trust levels.`
    );
  }
}
