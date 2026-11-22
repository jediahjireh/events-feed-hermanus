"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";

type Source = { id: string; name: string; url: string | null; trust_level: number };

export const sourceKeys = {
  all: ["sources"] as const,
  lists: () => [...sourceKeys.all, "list"] as const,
};

export function useSources() {
  return useQuery({
    queryKey: sourceKeys.lists(),
    queryFn: async () => {
      const result = await apiGet<Source[]>("/api/sources", { per_page: "50" });
      if (!result.ok) throw new Error(result.errors[0]?.message ?? "Failed to load sources");
      return result.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}
