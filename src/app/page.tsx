"use client";

import { Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEvents } from "@/hooks/use-events";
import { FilterBar } from "@/components/events/filter-bar";
import { EventCard, EventCardSkeleton } from "@/components/events/event-card";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const PER_PAGE = 20;

function EventsFeed() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const page = Number(searchParams.get("page") ?? "1");

  const buildParams = useCallback(() => {
    const params: Record<string, string> = {
      page: String(page),
      per_page: String(PER_PAGE),
    };
    for (const key of ["from", "to", "categories", "suitable_for", "source_id", "sort"]) {
      const val = searchParams.get(key);
      if (val) params[key] = val;
    }
    return params;
  }, [searchParams, page]);

  const { data, isLoading, error, refetch } = useEvents(buildParams());

  function setFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    if (key !== "page") {
      params.delete("page");
    }
    router.push(`/?${params.toString()}`);
  }

  function setPage(newPage: number) {
    setFilter("page", String(newPage));
  }

  /** Replace all filters at once (for presets). Empty object = clear all. */
  function setBatchFilters(newFilters: Record<string, string>) {
    const params = new URLSearchParams();
    for (const [key, val] of Object.entries(newFilters)) {
      if (val) params.set(key, val);
    }
    router.push(params.size > 0 ? `/?${params.toString()}` : "/");
  }

  const filters: Record<string, string> = {};
  for (const key of ["from", "to", "categories", "suitable_for", "source_id", "sort"]) {
    const val = searchParams.get(key);
    if (val) filters[key] = val;
  }

  const events = data?.ok ? data.data : [];
  const totalCount = data?.ok ? (data.meta.total_count ?? 0) : 0;
  const hasMore = data?.ok ? (data.meta.has_more ?? false) : false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold sm:text-4xl">
          What&apos;s On in Hermanus
        </h1>
        <p className="mt-1 text-deep-forest/60">
          Discover local events, festivals, and activities in Hermanus, South Africa.
        </p>
      </div>

      <FilterBar filters={filters} onChange={setFilter} onBatchChange={setBatchFilters} />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <EventCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <Card className="border-red-200">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 mb-3">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <p className="font-medium text-red-700">
              {error instanceof Error ? error.message : "Failed to load events"}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              icon={RefreshCw}
              onClick={() => refetch()}
            >
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-lg font-medium text-deep-forest/60">
              No events found
            </p>
            <p className="mt-1 text-sm text-deep-forest/40">
              Try adjusting your filters or date range.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>

          <PaginationControls
            page={page}
            perPage={PER_PAGE}
            totalCount={totalCount}
            hasMore={hasMore}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-10 w-80" />
        <Skeleton className="mt-2 h-5 w-96" />
      </div>
      <Skeleton className="h-48 w-full rounded-lg" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <EventCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<FeedSkeleton />}>
      <EventsFeed />
    </Suspense>
  );
}
