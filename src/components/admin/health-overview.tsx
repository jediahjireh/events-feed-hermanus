"use client";

import { Activity, Database, Calendar, BarChart3, RefreshCw } from "lucide-react";
import { useHealth } from "@/hooks/use-health";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { InfoTip } from "@/components/ui/info-tip";

function StatCard({ label, value, icon: Icon, tip }: { label: string; value: number; icon?: React.ElementType; tip?: string }) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-deep-forest/60">
          {label}
          {tip && <InfoTip text={tip} className="ml-1" />}
        </CardTitle>
        {Icon && <Icon className="h-4 w-4 text-vibrant-leaf" />}
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function HealthSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <Skeleton className="h-6 w-6 rounded-full" />
          <div className="space-y-1">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </CardHeader>
            <CardContent><Skeleton className="h-8 w-16" /></CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4 space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-48" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function HealthOverview() {
  const { data: health, isLoading, error, refetch } = useHealth();

  if (isLoading) return <HealthSkeleton />;

  if (error) {
    return (
      <Card className="border-red-200">
        <CardContent className="flex flex-col items-center py-8">
          <p className="text-sm text-red-600">{error.message}</p>
          <Button variant="outline" size="sm" icon={RefreshCw} className="mt-3" onClick={() => refetch()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!health) return null;

  return (
    <div className="space-y-6">
      <Card className={health.status === "healthy" ? "border-vibrant-leaf/30 bg-whisper-green/50" : "border-red-200 bg-red-50"}>
        <CardContent className="flex items-center gap-3 p-4">
          <StatusIndicator status={health.status === "healthy" ? "healthy" : "failed"} />
          <div>
            <p className="text-lg font-bold">
              System {health.status === "healthy" ? "Healthy" : "Unhealthy"}
            </p>
            <p className="text-xs text-deep-forest/50">
              DB: {health.database.connected ? "Connected" : "Disconnected"} | {new Date(health.timestamp).toLocaleTimeString("en-ZA")}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active Events" value={health.events.total_active} icon={Calendar} />
        {Object.entries(health.events.by_temporal_type).map(([type, count]) => {
          const tips: Record<string, string> = {
            point: "Single-date events (e.g. a concert on Dec 3)",
            range: "Multi-day events with start and end dates (e.g. a 5-day festival)",
            recurring: "Repeating events (e.g. every Saturday market)",
            seasonal: "Events spanning certain months without fixed dates (e.g. whale season Jun\u2013Nov)",
          };
          return <StatCard key={type} label={type} value={count} icon={Activity} tip={tips[type]} />;
        })}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-deep-forest/50">
          Confidence Distribution
          <InfoTip text="How confident the system is in each event's data. Events below 0.6 are hidden from default API results. Low confidence = unverified or incomplete data." className="ml-1" />
        </h3>
        <div className="grid gap-2 sm:grid-cols-4">
          {Object.entries(health.events.by_confidence).map(([range, count]) => (
            <Card key={range}>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-deep-forest/50">{range}</p>
                <p className="text-xl font-bold tabular-nums">{count}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-deep-forest/50">
          Sources
          <InfoTip text="Data sources that feed events into the system. Each source is an API or scraper (SerpAPI, Apify actors, or manual entry). 'Last run' shows when that source was last ingested." className="ml-1" />
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {health.sources.map((s) => (
            <Card key={s.source_id} className="transition-shadow hover:shadow-md">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{s.source_name}</p>
                  <Badge variant="outline">{s.source_id}</Badge>
                </div>
                {s.last_completed ? (
                  <p className="mt-1.5 text-xs text-deep-forest/60">
                    Last run: {new Date(s.last_completed).toLocaleString("en-ZA")} | {s.events_found} events
                  </p>
                ) : (
                  <p className="mt-1.5 text-xs text-deep-forest/40">No completed runs</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
