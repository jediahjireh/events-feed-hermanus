/**
 * Shared Apify utility — common fetch/poll pattern for all Apify actors.
 *
 * All event source adapters that use Apify actors share the same logic:
 * 1. Try fetching the latest dataset from the actor's last run (cheapest).
 * 2. If no previous run exists (404), trigger a new run and poll for results.
 *
 * Individual adapters define their own types, actor IDs, input params, and filters.
 */

const APIFY_BASE = "https://api.apify.com/v2";

/**
 * Normalize an Apify actor ID for use in REST API URLs.
 * Apify displays actors as "username/actor-name" on the website,
 * but the REST API requires "username~actor-name" in URL paths.
 */
function normalizeActorId(actorId: string): string {
  return actorId.replace("/", "~");
}

/**
 * Get the Apify API key from the environment.
 * Throws if not set.
 */
export function getApifyKey(): string {
  const apiKey = process.env.APIFY_API_KEY;
  if (!apiKey) {
    throw new Error("APIFY_API_KEY environment variable is not set");
  }
  return apiKey;
}

/**
 * Fetch the latest dataset from an actor's most recent run.
 * Returns null if no previous run exists (404).
 */
export async function fetchLatestDataset<T>(
  actorId: string,
  apiKey: string
): Promise<T[] | null> {
  const id = normalizeActorId(actorId);
  const url = `${APIFY_BASE}/actors/${id}/runs/last/dataset/items?token=${apiKey}&format=json&clean=true`;
  const response = await fetch(url);

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(
      `Apify dataset fetch failed for ${actorId}: ${response.status} ${response.statusText}`
    );
  }

  return (await response.json()) as T[];
}

/**
 * Trigger a new actor run with the given input, then poll until the dataset is ready.
 * Times out after maxWaitMs (default 120 seconds).
 */
export async function triggerAndFetchRun<T>(
  actorId: string,
  apiKey: string,
  input: Record<string, unknown>,
  maxWaitMs = 120_000
): Promise<T[]> {
  const id = normalizeActorId(actorId);
  const runResponse = await fetch(
    `${APIFY_BASE}/actors/${id}/runs?token=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }
  );

  if (!runResponse.ok) {
    throw new Error(
      `Apify run trigger failed for ${actorId}: ${runResponse.status} ${runResponse.statusText}`
    );
  }

  const runData = (await runResponse.json()) as {
    data?: { id?: string; defaultDatasetId?: string };
  };
  const runId = runData.data?.id;
  const datasetId = runData.data?.defaultDatasetId;

  if (!datasetId || !runId) {
    throw new Error(`Apify run for ${actorId} did not return a dataset ID`);
  }

  // Poll for completion — check both run status and dataset
  const pollInterval = 5_000;
  let elapsed = 0;

  while (elapsed < maxWaitMs) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
    elapsed += pollInterval;

    // Check run status first
    const statusResponse = await fetch(
      `${APIFY_BASE}/actor-runs/${runId}?token=${apiKey}`
    );
    if (statusResponse.ok) {
      const statusData = (await statusResponse.json()) as {
        data?: { status?: string };
      };
      const status = statusData.data?.status;

      // Terminal states: check dataset and return whatever we have
      if (
        status === "SUCCEEDED" ||
        status === "FAILED" ||
        status === "ABORTED" ||
        status === "TIMED-OUT"
      ) {
        const datasetUrl = `${APIFY_BASE}/datasets/${datasetId}/items?token=${apiKey}&format=json&clean=true`;
        const datasetResponse = await fetch(datasetUrl);
        if (datasetResponse.ok) {
          return (await datasetResponse.json()) as T[];
        }
        // Run finished but dataset fetch failed — return empty
        return [];
      }
    }

    // Run still in progress — check dataset optimistically
    const datasetUrl = `${APIFY_BASE}/datasets/${datasetId}/items?token=${apiKey}&format=json&clean=true`;
    const datasetResponse = await fetch(datasetUrl);
    if (datasetResponse.ok) {
      const items = (await datasetResponse.json()) as T[];
      if (items.length > 0) return items;
    }
  }

  throw new Error(
    `Apify run for ${actorId} timed out waiting for dataset (${maxWaitMs / 1000}s)`
  );
}

/**
 * Fetch data from an Apify actor: try latest dataset first, fall back to triggering a new run.
 * Optionally filter results after fetching.
 */
export async function fetchApifyActor<T>(
  actorId: string,
  input: Record<string, unknown>,
  filter?: (item: T) => boolean
): Promise<T[]> {
  const apiKey = getApifyKey();

  // Try latest dataset first (cheapest path)
  const latest = await fetchLatestDataset<T>(actorId, apiKey);
  let items = latest ?? (await triggerAndFetchRun<T>(actorId, apiKey, input));

  if (filter) {
    items = items.filter(filter);
  }

  return items;
}
