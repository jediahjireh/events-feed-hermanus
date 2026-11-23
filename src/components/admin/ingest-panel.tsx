"use client";

import { useState } from "react";
import { Play, XCircle, RotateCw } from "lucide-react";
import { useSources } from "@/hooks/use-sources";
import { useIngestRuns, useTriggerIngest, useCancelRun } from "@/hooks/use-ingest";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { InfoTip } from "@/components/ui/info-tip";

function RunTableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="grid grid-cols-7 items-center gap-4 py-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 w-full" />
        </div>
      ))}
    </div>
  );
}

export function IngestPanel() {
  const [selectedSource, setSelectedSource] = useState("all");
  const { data: sources = [], isLoading: loadingSources } = useSources();
  const { data: runs = [], isLoading: loadingRuns } = useIngestRuns(true);
  const triggerIngest = useTriggerIngest();
  const cancelRun = useCancelRun();

  const inputClass =
    "mt-1 block w-full rounded-md border border-soft-sage bg-white px-3 py-1.5 text-sm shadow-sm focus:border-vibrant-leaf focus:outline-none focus:ring-1 focus:ring-vibrant-leaf";

  // Detect stuck runs (>10 minutes, likely Vercel timeout)
  const isStuck = (run: typeof runs[number]) => {
    if (run.status !== "running") return false;
    const elapsed = Date.now() - new Date(run.started_at).getTime();
    return elapsed > 10 * 60 * 1000; // 10 minutes
  };

  if (loadingSources) {
    return (
      <div className="space-y-6">
        <Card className="bg-whisper-green/50 border-vibrant-leaf/20">
          <CardContent className="flex flex-wrap items-end gap-3 p-4">
            <div className="space-y-1">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-9 w-48" />
            </div>
            <Skeleton className="h-9 w-32" />
          </CardContent>
        </Card>
        <RunTableSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-whisper-green/50 border-vibrant-leaf/20">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <label className="text-sm font-medium">
            Source <InfoTip text="Pick a source to fetch new events from. 'All sources' triggers every adapter (SerpAPI, Apify, scraper). Each run costs ~$0.01 in API calls." />
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className={inputClass}
            >
              <option value="all">All sources</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.id})</option>
              ))}
            </select>
          </label>
          <Button
            icon={Play}
            isLoading={triggerIngest.isPending}
            loadingText="Triggering..."
            onClick={() => triggerIngest.mutate(selectedSource)}
          >
            Trigger Ingest
          </Button>
        </CardContent>
      </Card>

      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-deep-forest/50">
          Recent Runs
        </h3>
        {loadingRuns ? (
          <RunTableSkeleton />
        ) : runs.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-sm text-deep-forest/50">No ingest runs yet.</CardContent></Card>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wide text-deep-forest/50">
                  <th className="pb-2 pr-4">Source</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Started</th>
                  <th className="pb-2 pr-4">Found <InfoTip text="Raw events returned by the source adapter before dedup or validation." /></th>
                  <th className="pb-2 pr-4">Created <InfoTip text="New events added to the database (passed dedup + validation)." /></th>
                  <th className="pb-2 pr-4">Updated <InfoTip text="Existing events that matched a duplicate and had their confidence boosted." /></th>
                  <th className="pb-2 pr-4">Error</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-b border-soft-sage/50 transition-colors hover:bg-whisper-green/30 last:border-0">
                    <td className="py-2.5 pr-4"><Badge variant="outline">{run.source_id}</Badge></td>
                    <td className="py-2.5 pr-4">
                      <StatusIndicator
                        status={run.status === "completed" ? "healthy" : run.status === "running" ? "running" : "failed"}
                        label={run.status}
                      />
                    </td>
                    <td className="py-2.5 pr-4 text-xs text-deep-forest/60">{new Date(run.started_at).toLocaleString("en-ZA")}</td>
                    <td className="py-2.5 pr-4 tabular-nums">{run.events_found}</td>
                    <td className="py-2.5 pr-4 tabular-nums">{run.events_created}</td>
                    <td className="py-2.5 pr-4 tabular-nums">{run.events_updated}</td>
                    <td className="py-2.5 pr-4 max-w-xs truncate text-xs text-red-600">{run.error_message}</td>
                    <td className="py-2.5">
                      {run.status === "running" && isStuck(run) ? (
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={XCircle}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => cancelRun.mutate(run.id)}
                            disabled={cancelRun.isPending}
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={RotateCw}
                            className="text-vibrant-leaf hover:text-vibrant-leaf/80 hover:bg-whisper-green"
                            onClick={() => {
                              // Cancel the stuck run, then trigger new one
                              cancelRun.mutate(run.id, {
                                onSuccess: () => triggerIngest.mutate(run.source_id),
                              });
                            }}
                            disabled={cancelRun.isPending || triggerIngest.isPending}
                          >
                            Re-trigger
                          </Button>
                        </div>
                      ) : run.status === "running" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={XCircle}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => cancelRun.mutate(run.id)}
                          disabled={cancelRun.isPending}
                        >
                          Cancel
                        </Button>
                      ) : (run.status === "failed" || run.status === "cancelled") ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={RotateCw}
                          className="text-vibrant-leaf hover:text-vibrant-leaf/80 hover:bg-whisper-green"
                          onClick={() => triggerIngest.mutate(run.source_id)}
                          disabled={triggerIngest.isPending}
                        >
                          Retry
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
