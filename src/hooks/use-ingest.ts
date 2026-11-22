"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch } from "@/lib/api-client";
import { toast } from "sonner";

export type IngestRun = {
  id: string;
  source_id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  events_found: number;
  events_created: number;
  events_updated: number;
  events_skipped: number;
  error_message: string | null;
};

export const ingestKeys = {
  all: ["ingest"] as const,
  runs: () => [...ingestKeys.all, "runs"] as const,
};

export function useIngestRuns(refetchWhileRunning = false) {
  return useQuery({
    queryKey: ingestKeys.runs(),
    queryFn: async () => {
      const result = await apiGet<IngestRun[]>("/api/ingest/runs", { per_page: "20" });
      if (!result.ok) throw new Error(result.errors[0]?.message ?? "Failed to load runs");
      return result.data;
    },
    refetchInterval: (query) => {
      if (!refetchWhileRunning) return false;
      const data = query.state.data;
      const hasRunning = data?.some((r: IngestRun) => r.status === "running");
      return hasRunning ? 5000 : false;
    },
  });
}

export function useTriggerIngest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sourceId: string) => {
      const result = await apiPost("/api/ingest", { source_id: sourceId });
      if (!result.ok) throw new Error(result.errors[0]?.message ?? "Failed to trigger ingest");
    },
    onSuccess: () => {
      toast.success("Ingest triggered");
      queryClient.invalidateQueries({ queryKey: ingestKeys.runs() });
    },
    onError: (error: Error) => {
      toast.error("Ingest failed", { description: error.message });
    },
  });
}

export function useCancelRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (runId: string) => {
      const result = await apiPatch(`/api/ingest/runs/${runId}`);
      if (!result.ok) throw new Error(result.errors[0]?.message ?? "Failed to cancel run");
    },
    onSuccess: () => {
      toast.success("Run cancelled");
      queryClient.invalidateQueries({ queryKey: ingestKeys.runs() });
    },
    onError: (error: Error) => {
      toast.error("Cancel failed", { description: error.message });
    },
  });
}
