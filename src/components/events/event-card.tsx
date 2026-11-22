"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPin, Clock, ImageOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TemporalBadge } from "@/components/ui/temporal-badge";
import { ConfidenceMeter } from "@/components/ui/confidence-meter";
import { Skeleton } from "@/components/ui/skeleton";
import type { Event } from "@/types/event";

function formatTemporal(t: Event["temporal"]): string {
  switch (t.type) {
    case "point":
      return new Date(t.start_date + "T00:00:00").toLocaleDateString("en-ZA", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    case "range":
      return `${new Date(t.start_date + "T00:00:00").toLocaleDateString("en-ZA", { day: "numeric", month: "short" })} \u2013 ${new Date(t.end_date + "T00:00:00").toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}`;
    case "recurring": {
      const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const day =
        t.recurrence.day_of_week !== null
          ? days[t.recurrence.day_of_week]
          : null;
      const freq = t.recurrence.frequency;
      return day ? `Every ${day} (${freq})` : `Recurring (${freq})`;
    }
    case "seasonal": {
      const months = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
      ];
      return `${months[t.start_month - 1]} \u2013 ${months[t.end_month - 1]}`;
    }
  }
}

function ImagePlaceholder() {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-t-lg bg-soft-sage/20">
      <div className="flex h-full items-center justify-center">
        <ImageOff className="h-8 w-8 text-deep-forest/15" />
      </div>
    </div>
  );
}

function EventImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <ImagePlaceholder />;
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-t-lg bg-soft-sage/30">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onError={() => setFailed(true)}
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
      />
    </div>
  );
}

export function EventCard({ event }: { event: Event }) {
  const heroImage = event.images?.[0];

  return (
    <Link href={`/events/${event.id}`} className="group block">
      <Card className="h-full overflow-hidden transition-all duration-200 hover:shadow-md hover:border-vibrant-leaf/40">
        {heroImage ? <EventImage src={heroImage} alt={event.title} /> : <ImagePlaceholder />}
        <CardContent className="p-5 pt-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-lg font-bold leading-tight group-hover:text-vibrant-leaf transition-colors">
              {event.title}
            </h3>
            <TemporalBadge type={event.temporal.type} />
          </div>

          <div className="mt-2 flex items-center gap-1.5 text-sm text-deep-forest/60">
            <Clock className="h-3.5 w-3.5" />
            {formatTemporal(event.temporal)}
          </div>

          {event.location.venue && (
            <div className="mt-1 flex items-center gap-1.5 text-sm text-deep-forest/50">
              <MapPin className="h-3.5 w-3.5" />
              {event.location.venue}
            </div>
          )}

          {event.description && (
            <p className="mt-3 line-clamp-2 text-sm text-deep-forest/70">
              {event.description}
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-1.5">
            {event.categories.map((cat) => (
              <Badge key={cat} variant="secondary">
                {cat}
              </Badge>
            ))}
            {event.suitable_for.map((s) => (
              <Badge key={s} variant="outline">
                {s}
              </Badge>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-soft-sage/50 pt-3">
            <ConfidenceMeter value={event.confidence} />
            {event.price_indication && (
              <span className="text-xs font-semibold text-deep-forest/70">
                {event.price_indication}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function EventCardSkeleton() {
  return (
    <Card className="h-full overflow-hidden">
      <Skeleton className="aspect-video w-full rounded-none" />
      <CardContent className="p-5 pt-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-5 w-16 rounded-md" />
        </div>
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-32" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="flex gap-1.5">
          <Skeleton className="h-5 w-14 rounded-md" />
          <Skeleton className="h-5 w-14 rounded-md" />
        </div>
        <div className="flex items-center justify-between border-t border-soft-sage/50 pt-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-12" />
        </div>
      </CardContent>
    </Card>
  );
}
