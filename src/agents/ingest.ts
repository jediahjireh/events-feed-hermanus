/**
 * Ingest Agent — the core ingestion pipeline.
 *
 * Takes raw event data from any source, uses Claude Haiku to extract
 * and normalise into the Event schema, deduplicates against existing
 * events, and stores them in the database.
 */

import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import { events, eventVersions, ingestRuns, sources } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ulid } from "ulid";
import { CreateEventSchema, type CreateEventInput } from "@/types/event";
import { findDuplicates, type DedupCandidate } from "@/lib/dedup";
import { slugify } from "@/lib/slug";
import { extractJson } from "@/lib/extract-json";

type IngestReport = {
  run_id: string;
  source_id: string;
  events_found: number;
  events_created: number;
  events_updated: number;
  events_skipped: number;
  avg_confidence: number;
  tokens_used: number;
  cost_usd: number;
  errors: string[];
};

function buildExtractionPrompt(): string {
  const today = new Date().toISOString().slice(0, 10);
  const year = new Date().getFullYear();
  return `Extract event data from this raw listing into valid JSON matching the schema below.

Today's date is ${today}. Use this to infer the year when dates lack a year (e.g. "Dec 3" means ${year}-12-03). start_date MUST always be a valid YYYY-MM-DD string for point and range events — never null.

Classify the temporal type as one of:
- "point": single date event
- "range": event with start and end dates
- "recurring": repeats on a schedule (weekly market, monthly meetup)
- "seasonal": happens during certain months, no specific dates (whale watching season)

If the event has multiple specific dates, use "range" with a dates array.

Explain your temporal classification in one sentence in a "reasoning" field.

If you're not confident about any field, set it to null — except start_date for point/range events, which must always be a YYYY-MM-DD string. Set confidence to a number between 0 and 1 based on how complete and unambiguous the source data is.

REQUIRED FIELDS — these must NEVER be empty arrays:
- categories: pick ALL that apply from ["music", "market", "wildlife", "art", "sport", "food-wine", "family"]. At least one is required. Infer from the event title, description, and type if not explicit.
- suitable_for: pick ALL that apply from ["couples", "families", "adventure", "luxury", "solo"]. At least one is required. Infer from the event type (e.g. a wine tasting → couples, luxury; a market → families, couples, solo).

EVENT LINKS — extract any direct links to the event's own page:
- website: the event's own URL, organiser page, or ticket purchase link. Look in the raw data for fields like link, url, ticket_info, website. This is different from the source page we scraped from.

Schema:
{
  "title": "string",
  "description": "string | null",
  "location": {
    "name": "string (location name or event name if no specific location)",
    "venue": "string | null (specific venue name)",
    "town": "Hermanus",
    "region": "Overberg",
    "province": "Western Cape",
    "country": "ZA",
    "lat": "number | null",
    "lng": "number | null"
  },
  "temporal": {
    "type": "point | range | recurring | seasonal",
    "start_date": "YYYY-MM-DD | null",
    "end_date": "YYYY-MM-DD | null",
    "start_month": "1-12 | null (for seasonal)",
    "end_month": "1-12 | null (for seasonal)",
    "recurrence": {
      "frequency": "daily | weekly | monthly",
      "day_of_week": "0-6 (0=Mon, 6=Sun) | null",
      "interval": "number (default 1)",
      "exceptions": []
    } | null,
    "dates": ["YYYY-MM-DD", ...] | null
  },
  "categories": ["music", "market", "wildlife", "art", "sport", "food-wine", "family"],
  "suitable_for": ["couples", "families", "adventure", "luxury", "solo"],
  "confidence": 0.0-1.0,
  "price_indication": "string | null (e.g. 'free', 'R50-R200')",
  "website": "string | null (direct link to the event page or ticket purchase)",
  "reasoning": "string (one sentence explaining temporal classification)"
}

Respond with ONLY valid JSON. No markdown, no explanation outside the JSON.

Raw listing:
`;
}

/**
 * Run the full ingestion pipeline for a source.
 */
export async function runIngest(
  sourceId: string,
  rawEvents: Record<string, unknown>[],
  runId: string
): Promise<IngestReport> {
  const report: IngestReport = {
    run_id: runId,
    source_id: sourceId,
    events_found: rawEvents.length,
    events_created: 0,
    events_updated: 0,
    events_skipped: 0,
    avg_confidence: 0,
    tokens_used: 0,
    cost_usd: 0,
    errors: [],
  };

  if (rawEvents.length === 0) {
    await finaliseRun(runId, report);
    return report;
  }

  const anthropic = new Anthropic();
  const confidences: number[] = [];

  // Fetch existing events for dedup (only active, only fields needed)
  const existingRows = await db
    .select({
      id: events.id,
      title: events.title,
      temporal: events.temporal,
      location: events.location,
    })
    .from(events)
    .where(eq(events.status, "active"));
  const existingCandidates: DedupCandidate[] = existingRows.map((e) => ({
    id: e.id,
    title: e.title,
    temporal: e.temporal,
    location: e.location,
  }));

  for (const raw of rawEvents) {
    try {
      // Extract using Claude Haiku
      const extracted = await extractEvent(anthropic, raw, report);
      if (!extracted) continue;

      confidences.push(extracted.confidence);

      // Validate with Zod
      const input: CreateEventInput = {
        ...extracted,
        source_id: sourceId,
        source_url: extractSourceUrl(raw),
      };

      const validated = CreateEventSchema.safeParse(input);
      if (!validated.success) {
        report.errors.push(
          `Validation failed for "${extracted.title}": ${validated.error.issues.map((i) => i.message).join(", ")}`
        );
        report.events_skipped++;
        continue;
      }

      // Dedup check
      const candidate: DedupCandidate = {
        id: "new",
        title: validated.data.title,
        temporal: validated.data.temporal,
        location: validated.data.location,
      };
      const duplicates = findDuplicates(candidate, existingCandidates);

      if (duplicates.length > 0 && duplicates[0].confidence > 0.8) {
        // High-confidence duplicate — update existing
        const existing = duplicates[0].match;
        await updateExistingEvent(existing.id, validated.data, sourceId);
        report.events_updated++;
      } else if (duplicates.length > 0 && duplicates[0].confidence > 0.6) {
        // Medium-confidence duplicate — skip, flag for review
        report.events_skipped++;
      } else {
        // New event — create
        const newId = await createNewEvent(validated.data);
        existingCandidates.push({
          id: newId,
          title: validated.data.title,
          temporal: validated.data.temporal,
          location: validated.data.location,
        });
        report.events_created++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      report.errors.push(`Failed to process event: ${msg}`);
      report.events_skipped++;
    }
  }

  report.avg_confidence =
    confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0;

  // Haiku pricing: $0.10/M input, $0.50/M output
  // Approximate 80% input / 20% output split
  const inputTokens = Math.round(report.tokens_used * 0.8);
  const outputTokens = report.tokens_used - inputTokens;
  report.cost_usd =
    (inputTokens * 0.1) / 1_000_000 +
    (outputTokens * 0.5) / 1_000_000;

  await finaliseRun(runId, report);
  return report;
}

/**
 * Extract event data from a raw listing using Claude Haiku.
 */
async function extractEvent(
  anthropic: Anthropic,
  raw: Record<string, unknown>,
  report: IngestReport
): Promise<(CreateEventInput & { reasoning?: string }) | null> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-5-5",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: buildExtractionPrompt() + JSON.stringify(raw, null, 2),
        },
      ],
    });

    // Track tokens
    report.tokens_used +=
      (response.usage?.input_tokens ?? 0) +
      (response.usage?.output_tokens ?? 0);

    // Find the text block — Haiku 5.5 may prepend thinking blocks
    const textBlock = response.content.find((b) => b.type === "text");
    const text = textBlock && "text" in textBlock ? textBlock.text : "";

    // Parse JSON — handle potential markdown wrapping or preamble text
    const jsonStr = extractJson(text);
    const parsed = JSON.parse(jsonStr);

    // Fill in missing null fields for temporal
    const temporal = normaliseTemporalOutput(parsed.temporal);

    return {
      title: parsed.title,
      description: parsed.description ?? null,
      location: {
        name: parsed.location?.name ?? "Hermanus",
        venue: parsed.location?.venue ?? null,
        town: parsed.location?.town ?? "Hermanus",
        region: parsed.location?.region ?? "Overberg",
        province: parsed.location?.province ?? "Western Cape",
        country: parsed.location?.country ?? "ZA",
        lat: parsed.location?.lat ?? null,
        lng: parsed.location?.lng ?? null,
        radius_km: null,
      },
      temporal,
      categories: Array.isArray(parsed.categories) && parsed.categories.length > 0
        ? parsed.categories
        : ["family"], // Default fallback — every event is at least family-friendly
      source_id: "", // Set by caller
      source_url: null,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
      relevance_score: 0.5,
      status: "active",
      links: parsed.website ? { website: parsed.website } : null,
      images: [],
      price_indication: parsed.price_indication ?? null,
      suitable_for: Array.isArray(parsed.suitable_for) && parsed.suitable_for.length > 0
        ? parsed.suitable_for
        : ["solo"], // Default fallback — any event works for solo visitors
      reasoning: parsed.reasoning,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    report.errors.push(`Extraction failed: ${msg}`);
    return null;
  }
}

/**
 * Extract the best available source URL from raw event data.
 * Different sources store links in different fields.
 */
function extractSourceUrl(raw: Record<string, unknown>): string | null {
  // Top-level link (Eventbrite, Facebook)
  if (typeof (raw as { link?: unknown }).link === "string") {
    return (raw as { link: string }).link;
  }
  // Google Events: ticket_info[].link
  const ticketInfo = (raw as { ticket_info?: { link?: string }[] }).ticket_info;
  if (Array.isArray(ticketInfo)) {
    const ticket = ticketInfo.find((t) => typeof t.link === "string");
    if (ticket?.link) return ticket.link;
  }
  // Google Events: venue.link
  const venue = (raw as { venue?: { link?: string } }).venue;
  if (typeof venue?.link === "string") return venue.link;
  // Quicket, TripAdvisor: url field
  if (typeof (raw as { url?: unknown }).url === "string") {
    return (raw as { url: string }).url;
  }
  // Quicket: sourceUrl field (alternative)
  if (typeof (raw as { sourceUrl?: unknown }).sourceUrl === "string") {
    return (raw as { sourceUrl: string }).sourceUrl;
  }
  return null;
}

/**
 * Ensure temporal output has all required null fields for each type.
 */
function normaliseTemporalOutput(
  raw: Record<string, unknown>
): CreateEventInput["temporal"] {
  const type = raw?.type as string;
  const today = new Date().toISOString().slice(0, 10);

  switch (type) {
    case "point":
      return {
        type: "point",
        start_date: (raw.start_date as string) ?? today,
        end_date: null,
        start_month: null,
        end_month: null,
        recurrence: null,
        dates: null,
      };
    case "range":
      return {
        type: "range",
        start_date: (raw.start_date as string) ?? today,
        end_date: (raw.end_date as string) ?? (raw.start_date as string) ?? today,
        start_month: null,
        end_month: null,
        recurrence: null,
        dates: (raw.dates as string[]) ?? null,
      };
    case "recurring":
      return {
        type: "recurring",
        start_date: (raw.start_date as string) ?? null,
        end_date: (raw.end_date as string) ?? null,
        start_month: null,
        end_month: null,
        recurrence: {
          frequency: (raw.recurrence as Record<string, unknown>)
            ?.frequency as "daily" | "weekly" | "monthly",
          day_of_week:
            ((raw.recurrence as Record<string, unknown>)
              ?.day_of_week as number) ?? null,
          interval:
            ((raw.recurrence as Record<string, unknown>)
              ?.interval as number) ?? 1,
          exceptions:
            ((raw.recurrence as Record<string, unknown>)
              ?.exceptions as string[]) ?? [],
        },
        dates: null,
      };
    case "seasonal":
      return {
        type: "seasonal",
        start_date: null,
        end_date: null,
        start_month: raw.start_month as number,
        end_month: raw.end_month as number,
        recurrence: null,
        dates: null,
      };
    default:
      // Default to point if unknown
      return {
        type: "point",
        start_date: (raw.start_date as string) ?? today,
        end_date: null,
        start_month: null,
        end_month: null,
        recurrence: null,
        dates: null,
      };
  }
}

async function createNewEvent(data: CreateEventInput): Promise<string> {
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

  await db.insert(eventVersions).values({
    id: ulid(),
    event_id: id,
    version: 1,
    changed_at: now,
    changed_by: "ingest-agent",
    diff: { action: "created" },
    snapshot: { ...created },
  });

  return id;
}

async function updateExistingEvent(
  eventId: string,
  data: CreateEventInput,
  sourceId: string
): Promise<void> {
  const [current] = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!current) return;

  const now = new Date();
  const newVersion = current.version + 1;

  // Boost confidence when multiple sources agree
  const boostedConfidence = Math.min(
    Math.max(current.confidence, data.confidence) + 0.05,
    1
  );

  // Merge categories and suitable_for from new source (union, not replace)
  const currentCategories = current.categories ?? [];
  const currentSuitableFor = current.suitable_for ?? [];
  const mergedCategories = [
    ...new Set([...currentCategories, ...data.categories]),
  ];
  const mergedSuitableFor = [
    ...new Set([...currentSuitableFor, ...data.suitable_for]),
  ];

  // Merge links — keep existing, add new
  const mergedLinks =
    current.links || data.links
      ? { ...(current.links as Record<string, string> | null), ...(data.links as Record<string, string> | null) }
      : null;

  const [updated] = await db
    .update(events)
    .set({
      description: data.description ?? current.description,
      source_url: current.source_url ?? data.source_url,
      categories: mergedCategories,
      suitable_for: mergedSuitableFor,
      links: mergedLinks,
      confidence: boostedConfidence,
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
    changed_by: "ingest-agent",
    diff: {
      action: "updated_from_source",
      source_id: sourceId,
      confidence_boost: boostedConfidence - current.confidence,
      categories_added: mergedCategories.filter(
        (c) => !currentCategories.includes(c)
      ),
      suitable_for_added: mergedSuitableFor.filter(
        (s) => !currentSuitableFor.includes(s)
      ),
    },
    snapshot: { ...updated },
  });
}

async function finaliseRun(
  runId: string,
  report: IngestReport
): Promise<void> {
  await db
    .update(ingestRuns)
    .set({
      completed_at: new Date(),
      status:
        report.errors.length > 0 &&
        report.events_created === 0 &&
        report.events_updated === 0
          ? report.events_found === 0
            ? "failed"       // Pipeline error — nothing fetched
            : "completed"    // Events found but all skipped/invalid
          : "completed",
      events_found: report.events_found,
      events_created: report.events_created,
      events_updated: report.events_updated,
      events_skipped: report.events_skipped,
      avg_confidence: report.avg_confidence,
      tokens_used: report.tokens_used,
      cost_usd: report.cost_usd,
      error: report.errors.length > 0 ? report.errors.join("; ") : null,
    })
    .where(eq(ingestRuns.id, runId));

  // Update source last_scraped timestamp
  await db
    .update(sources)
    .set({ last_scraped: new Date() })
    .where(eq(sources.id, report.source_id));
}
