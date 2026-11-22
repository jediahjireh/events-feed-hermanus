/**
 * Extract a JSON object from text that may contain markdown fences or preamble.
 * Finds the first `{...}` block using brace-depth matching.
 *
 * Used by ingest, review, and scraper agents to parse Claude Haiku output.
 */
export function extractJson(text: string): string {
  // Strip markdown code fences first
  const stripped = text
    .replace(/```json?\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  // Find the first { and match to its closing }
  const start = stripped.indexOf("{");
  if (start === -1) return stripped;

  let depth = 0;
  for (let i = start; i < stripped.length; i++) {
    if (stripped[i] === "{") depth++;
    if (stripped[i] === "}") depth--;
    if (depth === 0) return stripped.slice(start, i + 1);
  }

  // Fallback: return from first { to end
  return stripped.slice(start);
}
