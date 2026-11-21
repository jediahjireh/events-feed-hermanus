/**
 * Relevance Agent — score events for relevance given a traveller profile.
 *
 * Simple rules first, Claude Haiku for edge cases.
 * Most relevance is rule-based to minimise cost and latency.
 */

const CATEGORY_PROFILE_MAP: Record<string, Record<string, number>> = {
  wildlife: { couples: 0.95, families: 0.9, luxury: 0.9, adventure: 0.8, solo: 0.85 },
  market: { couples: 0.8, families: 0.85, luxury: 0.6, adventure: 0.5, solo: 0.7 },
  music: { couples: 0.85, families: 0.6, luxury: 0.7, adventure: 0.6, solo: 0.8 },
  art: { couples: 0.85, families: 0.5, luxury: 0.9, adventure: 0.3, solo: 0.7 },
  sport: { couples: 0.5, families: 0.7, luxury: 0.3, adventure: 0.9, solo: 0.6 },
  "food-wine": { couples: 0.9, families: 0.5, luxury: 0.95, adventure: 0.4, solo: 0.7 },
  family: { couples: 0.6, families: 0.95, luxury: 0.5, adventure: 0.6, solo: 0.4 },
};

/**
 * Score an event's relevance for a given traveller profile.
 * Returns a score between 0 and 1.
 */
export function scoreRelevance(
  categories: string[],
  suitableFor: string[],
  profileTypes: string[]
): number {
  if (categories.length === 0 || profileTypes.length === 0) return 0.5;

  let maxScore = 0;

  for (const category of categories) {
    const profileMap = CATEGORY_PROFILE_MAP[category];
    if (!profileMap) continue;

    for (const profile of profileTypes) {
      const score = profileMap[profile] ?? 0.5;
      maxScore = Math.max(maxScore, score);
    }
  }

  // Boost if the event's suitable_for explicitly matches the profile
  const explicitMatch = profileTypes.some((p) => suitableFor.includes(p));
  if (explicitMatch) {
    maxScore = Math.min(maxScore + 0.1, 1);
  }

  return maxScore;
}
