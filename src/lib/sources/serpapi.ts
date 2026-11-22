/**
 * Shared SerpAPI utility — common fetch pattern for SerpAPI engines.
 *
 * SerpAPI provides structured search APIs for Google Events, Eventbrite,
 * TripAdvisor, and more. Each engine has its own parameters but shares
 * the same base URL and authentication pattern.
 *
 * Used for sources where Apify actors return sparse results for Hermanus.
 * SerpAPI's Google Events and Eventbrite engines are confirmed to return
 * Hermanus events reliably.
 *
 * Free tier: 250 searches/month. Daily cron for 2 engines ≈ 60/month.
 */

const SERPAPI_BASE = "https://serpapi.com/search.json";

/**
 * Get the SerpAPI key from the environment.
 * Throws if not set.
 */
export function getSerpApiKey(): string {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) {
    throw new Error("SERPAPI_API_KEY environment variable is not set");
  }
  return apiKey;
}

/**
 * Fetch results from a SerpAPI engine.
 * Builds the query string from the engine name and params, appends the API key.
 * Optionally filters and transforms results.
 */
export async function fetchSerpApi<TRaw, TOut = TRaw>(
  engine: string,
  params: Record<string, string>,
  extract: (body: Record<string, unknown>) => TRaw[],
  transform?: (item: TRaw) => TOut,
  filter?: (item: TOut) => boolean,
): Promise<TOut[]> {
  const apiKey = getSerpApiKey();

  const url = new URL(SERPAPI_BASE);
  url.searchParams.set("engine", engine);
  url.searchParams.set("api_key", apiKey);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(
      `SerpAPI ${engine} fetch failed: ${response.status} ${response.statusText}`
    );
  }

  const body = (await response.json()) as Record<string, unknown>;
  const rawItems = extract(body);

  let items: TOut[] = transform
    ? rawItems.map(transform)
    : (rawItems as unknown as TOut[]);

  if (filter) {
    items = items.filter(filter);
  }

  return items;
}
