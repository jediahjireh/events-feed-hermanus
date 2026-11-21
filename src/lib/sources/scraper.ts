/**
 * Generic Claude-powered scraper.
 *
 * Fetches a URL, passes the HTML to Claude Haiku for extraction,
 * and returns an array of events in the Event schema format.
 *
 * Used for sources without APIs: hermanus.co.za, ShowMe Hermanus, fynarts.co.za.
 */

import Anthropic from "@anthropic-ai/sdk";

export type ScrapedEvent = {
  title: string;
  description?: string;
  temporal: Record<string, unknown>;
  venue?: string;
  categories?: string[];
  price_indication?: string;
  source_url: string;
  confidence: number;
};

type ScrapeResult = {
  events: ScrapedEvent[];
  tokens_used: number;
};

const SCRAPER_PROMPT = `You are extracting event listings from a tourism website for Hermanus, South Africa.

Extract ALL events you can find on this page. For each event, provide:
- title
- description (if available)
- temporal classification: "point" (single date), "range" (date range), "recurring" (regular schedule), or "seasonal" (certain months, no dates)
- temporal details: dates, recurrence rules, or months as appropriate
- venue/location
- categories (from: music, market, wildlife, art, sport, food-wine, family)
- price indication (if mentioned)
- confidence (0-1, how sure you are about the extracted data)

If the page doesn't contain event listings, return an empty array.
If you're unsure about temporal classification, default to "point" with low confidence.

Respond with ONLY valid JSON matching this schema:
{
  "events": [
    {
      "title": "string",
      "description": "string | null",
      "temporal": {
        "type": "point | range | recurring | seasonal",
        "start_date": "YYYY-MM-DD | null",
        "end_date": "YYYY-MM-DD | null",
        "start_month": "1-12 | null",
        "end_month": "1-12 | null",
        "recurrence": { "frequency": "...", "day_of_week": "0-6 | null", "interval": 1, "exceptions": [] } | null,
        "dates": ["YYYY-MM-DD", ...] | null
      },
      "venue": "string | null",
      "categories": ["string"],
      "price_indication": "string | null",
      "confidence": 0.0-1.0
    }
  ]
}

Page HTML:
`;

/**
 * Scrape a URL and extract events using Claude Haiku.
 */
export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  // Fetch the page HTML
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; HermanusEventFeed/1.0; +https://github.com/events-feed-hermanus)",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${url}: ${response.status} ${response.statusText}`
    );
  }

  const html = await response.text();

  // Truncate HTML to avoid token limits (Haiku context: 200K tokens)
  // Rough estimate: 4 chars per token, limit to ~100K chars
  const truncatedHtml = html.slice(0, 100_000);

  // Extract using Claude Haiku
  const anthropic = new Anthropic();
  const result = await anthropic.messages.create({
    model: "claude-haiku-5-5",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: SCRAPER_PROMPT + truncatedHtml,
      },
    ],
  });

  const tokens =
    (result.usage?.input_tokens ?? 0) + (result.usage?.output_tokens ?? 0);

  // Find the text block — Haiku 5.5 may prepend thinking blocks
  const textBlock = result.content.find((b) => b.type === "text");
  const text = textBlock && "text" in textBlock ? textBlock.text : "";

  // Parse JSON response
  const jsonStr = text.replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    const parsed = JSON.parse(jsonStr);
    const events: ScrapedEvent[] = (parsed.events ?? []).map(
      (e: Record<string, unknown>) => ({
        title: e.title as string,
        description: e.description as string | undefined,
        temporal: e.temporal as Record<string, unknown>,
        venue: e.venue as string | undefined,
        categories: e.categories as string[] | undefined,
        price_indication: e.price_indication as string | undefined,
        source_url: url,
        confidence: typeof e.confidence === "number" ? e.confidence : 0.5,
      })
    );

    return { events, tokens_used: tokens };
  } catch {
    return { events: [], tokens_used: tokens };
  }
}
