"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";

export type HealthData = {
  status: string;
  database: { connected: boolean };
  events: {
    total_active: number;
    by_temporal_type: Record<string, number>;
    by_confidence: Record<string, number>;
  };
  sources: Array<{
    source_id: string;
    source_name: string;
    last_completed: string | null;
    events_found: number;
  }>;
  timestamp: string;
};

export const healthKeys = {
  all: ["health"] as const,
};

export function useHealth() {
  return useQuery({
    queryKey: healthKeys.all,
    queryFn: async () => {
      const result = await apiGet<HealthData>("/api/health");
      if (!result.ok) throw new Error(result.errors[0]?.message ?? "Failed to load health");
      return result.data;
    },
    refetchInterval: 5 * 60 * 1000,
  });
}
