"use client";

import { useState } from "react";
import { MapPin, Shield, ExternalLink, Ticket } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TemporalBadge } from "@/components/ui/temporal-badge";
import { ConfidenceMeter } from "@/components/ui/confidence-meter";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { Event } from "@/types/event";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function TemporalInfo({ temporal }: { temporal: Event["temporal"] }) {
  switch (temporal.type) {
    case "point":
      return <p>{formatDate(temporal.start_date)}</p>;
    case "range":
      return (
        <p>
          {formatDate(temporal.start_date)} &ndash; {formatDate(temporal.end_date)}
        </p>
      );
    case "recurring": {
      const days = [
        "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
      ];
      const day =
        temporal.recurrence.day_of_week !== null
          ? days[temporal.recurrence.day_of_week]
          : null;
      return (
        <div>
          <p>
            Every{day ? ` ${day}` : ""} ({temporal.recurrence.frequency}
            {temporal.recurrence.interval > 1 ? `, every ${temporal.recurrence.interval}` : ""})
          </p>
          {temporal.start_date && (
            <p className="text-sm text-deep-forest/50">
              From {formatDate(temporal.start_date)}
              {temporal.end_date ? ` to ${formatDate(temporal.end_date)}` : ""}
            </p>
          )}
        </div>
      );
    }
    case "seasonal":
      return (
        <p>
          {MONTH_NAMES[temporal.start_month - 1]} &ndash; {MONTH_NAMES[temporal.end_month - 1]} (every year)
        </p>
      );
  }
}

function HeroImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <div className="relative w-full overflow-hidden rounded-xl bg-soft-sage/30">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onError={() => setFailed(true)}
        className="w-full max-h-80 object-cover"
      />
    </div>
  );
}

const STATUS_VARIANTS: Record<string, "success" | "destructive" | "warning" | "muted"> = {
  active: "success",
  cancelled: "destructive",
  tentative: "warning",
  past: "muted",
};

export function EventDetail({ event }: { event: Event }) {
  const heroImage = event.images?.[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold">{event.title}</h1>
        <Badge variant={STATUS_VARIANTS[event.status] ?? "muted"}>{event.status}</Badge>
      </div>

      {heroImage && <HeroImage src={heroImage} alt={event.title} />}

      <Card className="bg-whisper-green/50 border-vibrant-leaf/20">
        <CardContent className="flex items-start gap-3 p-4">
          <TemporalBadge type={event.temporal.type} />
          <div className="text-sm">
            <TemporalInfo temporal={event.temporal} />
          </div>
        </CardContent>
      </Card>

      {event.description && (
        <Card>
          <CardHeader><CardTitle>Description</CardTitle></CardHeader>
          <CardContent>
            <p className="whitespace-pre-line text-deep-forest/80">{event.description}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
            <MapPin className="h-4 w-4 text-vibrant-leaf" />
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-deep-forest/50">Location</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{event.location.name}</p>
            {event.location.venue && <p className="text-sm text-deep-forest/60">{event.location.venue}</p>}
            <p className="text-sm text-deep-forest/60">{event.location.town}, {event.location.region}</p>
            {event.location.lat !== null && event.location.lng !== null && (
              <p className="mt-1 text-xs text-deep-forest/40">{event.location.lat.toFixed(4)}, {event.location.lng.toFixed(4)}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
            <Shield className="h-4 w-4 text-vibrant-leaf" />
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-deep-forest/50">Data Quality</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">Confidence</span>
              <ConfidenceMeter value={event.confidence} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Relevance</span>
              <ConfidenceMeter value={event.relevance_score} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Source</span>
              <Badge variant="outline">{event.source_id}</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Version</span>
              <span className="font-medium tabular-nums">v{event.version}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-6">
        {event.categories.length > 0 && (
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-deep-forest/50">Categories</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {event.categories.map((cat) => <Badge key={cat} variant="secondary">{cat}</Badge>)}
            </div>
          </div>
        )}
        {event.suitable_for.length > 0 && (
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-deep-forest/50">Suitable for</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {event.suitable_for.map((s) => <Badge key={s} variant="outline">{s}</Badge>)}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {event.price_indication && (
          <Card className="px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-deep-forest/50">Price</span>
            <p className="mt-0.5 font-medium">{event.price_indication}</p>
          </Card>
        )}
        <div className="ml-auto flex flex-wrap gap-3">
          {(event.links?.website || event.source_url) && (
            <a href={event.links?.website || event.source_url!} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" icon={ExternalLink}>Website</Button>
            </a>
          )}
          {event.links?.tickets && (
            <a href={event.links.tickets} target="_blank" rel="noopener noreferrer">
              <Button icon={Ticket}>Get Tickets</Button>
            </a>
          )}
        </div>
      </div>

      <div className="border-t border-soft-sage pt-4 text-xs text-deep-forest/40">
        Created: {new Date(event.created_at).toLocaleString("en-ZA")} |
        Updated: {new Date(event.updated_at).toLocaleString("en-ZA")}
        {event.last_verified_at && (
          <> | Verified: {new Date(event.last_verified_at).toLocaleString("en-ZA")}</>
        )}
      </div>
    </div>
  );
}

export function EventDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-6 w-16 rounded-md" />
      </div>
      <Skeleton className="h-20 w-full rounded-lg" />
      <Card>
        <CardHeader><Skeleton className="h-5 w-24" /></CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </CardContent>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card><CardContent className="p-5 space-y-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-5 w-40" /><Skeleton className="h-4 w-32" /></CardContent></Card>
        <Card><CardContent className="p-5 space-y-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-full" /></CardContent></Card>
      </div>
    </div>
  );
}
