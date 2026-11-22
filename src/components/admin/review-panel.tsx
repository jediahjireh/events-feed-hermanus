"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Play } from "lucide-react";
import { toast } from "sonner";
import { apiPost } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { InfoTip } from "@/components/ui/info-tip";

type ReviewResult = {
  events_in_scope: number;
  events_checked: number;
  events_confirmed: number;
  events_updated: number;
  events_stale: number;
  tokens_used: number;
  cost_usd: number;
  errors: string[];
};

const SCOPES = [
  { value: "upcoming", label: "Upcoming (next 30 days)" },
  { value: "low-confidence", label: "Low confidence (<0.6)" },
  { value: "all", label: "All active events" },
];

function SummaryCard({ label, value, tip }: { label: string; value: number; tip?: string }) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-3 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-deep-forest/50">
          {label}
          {tip && <InfoTip text={tip} className="ml-1" />}
        </p>
        <p className="text-xl font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

export function ReviewPanel() {
  const [scope, setScope] = useState("upcoming");
  const [result, setResult] = useState<ReviewResult | null>(null);

  const reviewMutation = useMutation({
    mutationFn: async (scope: string) => {
      const res = await apiPost<ReviewResult>("/api/review", { scope });
      if (!res.ok) throw new Error(res.errors[0]?.message ?? "Review failed");
      return res.data;
    },
    onSuccess: (data) => {
      setResult(data);
      toast.success(`Review complete: ${data.events_checked} events checked`);
    },
    onError: (error: Error) => {
      toast.error("Review failed", { description: error.message });
    },
  });

  const inputClass =
    "mt-1 block w-full rounded-md border border-soft-sage bg-white px-3 py-1.5 text-sm shadow-sm focus:border-vibrant-leaf focus:outline-none focus:ring-1 focus:ring-vibrant-leaf";

  return (
    <div className="space-y-6">
      <Card className="bg-whisper-green/50 border-vibrant-leaf/20">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <label className="text-sm font-medium">
            Scope <InfoTip text="Which events to re-verify against their source URLs. Only events with a source_url are checked — others are skipped. Uses Claude Haiku (~$0.001/event)." />
            <select value={scope} onChange={(e) => setScope(e.target.value)} className={inputClass}>
              {SCOPES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </label>
          <Button
            icon={Play}
            isLoading={reviewMutation.isPending}
            loadingText="Running..."
            onClick={() => reviewMutation.mutate(scope)}
          >
            Run Review
          </Button>
        </CardContent>
      </Card>

      {reviewMutation.isPending && (
        <div className="grid gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-3 text-center space-y-1"><Skeleton className="h-3 w-16 mx-auto" /><Skeleton className="h-7 w-10 mx-auto" /></CardContent></Card>
          ))}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {result.events_in_scope > result.events_checked && (
            <p className="text-xs text-deep-forest/50">
              {result.events_checked} of {result.events_in_scope} events have a source URL to verify against.
              {result.events_in_scope - result.events_checked} skipped (no URL).
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-4">
            <SummaryCard label="Verified" value={result.events_checked} tip="Events that have a source URL and were checked against it by Claude Haiku." />
            <SummaryCard label="Confirmed" value={result.events_confirmed} tip="Event still found at source URL with no changes detected." />
            <SummaryCard label="Updated" value={result.events_updated} tip="Event found but details changed (dates, venue, or status marked cancelled)." />
            <SummaryCard label="Stale" value={result.events_stale} tip="Source URL returned 404 or the event is no longer listed. Confidence is lowered." />
          </div>

          {(result.tokens_used > 0 || result.cost_usd > 0) && (
            <div className="flex flex-wrap gap-4 text-xs text-deep-forest/60">
              <span>Tokens: {result.tokens_used.toLocaleString()}</span>
              <span>Cost: ${result.cost_usd.toFixed(4)}</span>
            </div>
          )}

          {result.errors.length > 0 && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="p-3 space-y-1">
                <p className="text-xs font-semibold text-amber-700">
                  {result.errors.length} error{result.errors.length > 1 ? "s" : ""} during review:
                </p>
                {result.errors.map((err, i) => (
                  <p key={i} className="text-xs text-amber-600">{err}</p>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
