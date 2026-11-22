"use client";

import { useEventVersions } from "@/hooks/use-events";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type EventVersion = {
  id: string;
  event_id: string;
  version: number;
  changed_at: string;
  changed_by: string;
  diff: Record<string, unknown>;
};

function formatDiffValue(val: unknown): string {
  if (val === null || val === undefined) return "null";
  if (typeof val === "object") return JSON.stringify(val, null, 1);
  return String(val);
}

export function VersionTimeline({ eventId }: { eventId: string }) {
  const { data, isLoading, error } = useEventVersions(eventId);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-10 rounded-md" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-4 w-48" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-600">{error.message}</p>;
  }

  const versions = (data ?? []) as EventVersion[];

  if (versions.length === 0) {
    return <p className="text-sm text-deep-forest/50">No version history.</p>;
  }

  return (
    <div className="space-y-3">
      {versions.map((v) => (
        <Card key={v.id}>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">v{v.version}</Badge>
              <span className="text-sm font-medium">{v.changed_by}</span>
              <span className="text-xs text-deep-forest/50">
                {new Date(v.changed_at).toLocaleString("en-ZA")}
              </span>
            </div>

            <div className="mt-2 space-y-1">
              {Object.entries(v.diff).map(([field, change]) => {
                const isFromTo =
                  change !== null &&
                  typeof change === "object" &&
                  "from" in (change as Record<string, unknown>) &&
                  "to" in (change as Record<string, unknown>);

                if (isFromTo) {
                  const { from, to } = change as { from: unknown; to: unknown };
                  return (
                    <div key={field} className="text-xs">
                      <span className="font-medium text-deep-forest/70">{field}:</span>{" "}
                      <span className="text-red-600 line-through">{formatDiffValue(from)}</span>{" "}
                      <span className="text-vibrant-leaf">{formatDiffValue(to)}</span>
                    </div>
                  );
                }

                return (
                  <div key={field} className="text-xs">
                    <span className="font-medium text-deep-forest/70">{field}:</span>{" "}
                    <span className="text-deep-forest/80">{formatDiffValue(change)}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
