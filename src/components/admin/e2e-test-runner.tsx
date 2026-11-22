"use client";

import { useState } from "react";
import { Play, CheckCircle2, XCircle, Loader2, Circle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TestResult = {
  name: string;
  status: "pass" | "fail" | "running" | "pending";
  detail?: string;
};

type TestCheck = {
  name: string;
  run: () => Promise<{ pass: boolean; detail: string }>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchJson(url: string, init?: RequestInit): Promise<{ status: number; body: any }> {
  const res = await fetch(url, init);
  try {
    return { status: res.status, body: await res.json() };
  } catch {
    return { status: res.status, body: { error: `Non-JSON response (HTTP ${res.status})` } };
  }
}

function buildChecks(): TestCheck[] {
  return [
    {
      name: "1. Health: status healthy, 5+ events, 7 sources",
      run: async () => {
        const { body } = await fetchJson("/api/health");
        const ok =
          body.data?.status === "healthy" &&
          body.data?.events?.total_active >= 5 &&
          body.data?.sources?.length === 7;
        return {
          pass: ok,
          detail: `status=${body.data?.status}, active=${body.data?.events?.total_active}, sources=${body.data?.sources?.length}`,
        };
      },
    },
    {
      name: "2. Schema: OpenAPI 3.1.0, 10 paths",
      run: async () => {
        const { body } = await fetchJson("/api/schema");
        const pathCount = Object.keys(body.paths ?? {}).length;
        const ok = body.openapi === "3.1.0" && pathCount >= 10;
        return { pass: ok, detail: `openapi=${body.openapi}, paths=${pathCount}` };
      },
    },
    {
      name: "3. Sources: 7 sources, pagination works",
      run: async () => {
        const { body } = await fetchJson("/api/sources?per_page=2");
        const ok =
          body.meta?.total_count === 7 &&
          body.data?.length === 2 &&
          body.meta?.has_more === true;
        return {
          pass: ok,
          detail: `total=${body.meta?.total_count}, page_size=${body.data?.length}, has_more=${body.meta?.has_more}`,
        };
      },
    },
    {
      name: "4. Events: 5+ events, data/meta/errors shape",
      run: async () => {
        const { body } = await fetchJson("/api/events");
        const ok =
          Array.isArray(body.data) &&
          body.data.length >= 5 &&
          "meta" in body &&
          "errors" in body;
        return {
          pass: ok,
          detail: `count=${body.data?.length}, has_meta=${"meta" in body}`,
        };
      },
    },
    {
      name: "5. Category filter: ?categories=wildlife",
      run: async () => {
        const { body } = await fetchJson("/api/events?categories=wildlife");
        const allWildlife = body.data?.every((e: { categories: string[] }) =>
          e.categories.includes("wildlife")
        );
        return {
          pass: allWildlife && body.data?.length > 0,
          detail: `count=${body.data?.length}, all_wildlife=${allWildlife}`,
        };
      },
    },
    {
      name: "6. Confidence: default excludes <0.6",
      run: async () => {
        const { body: defaults } = await fetchJson("/api/events");
        const { body: all } = await fetchJson("/api/events?min_confidence=0");
        const defaultAllAbove = defaults.data?.every(
          (e: { confidence: number }) => e.confidence >= 0.6
        );
        return {
          pass: defaultAllAbove,
          detail: `default_count=${defaults.data?.length}, all_count=${all.data?.length}, all_above_0.6=${defaultAllAbove}`,
        };
      },
    },
    {
      name: "7. Cancelled: default excludes, ?status=cancelled shows",
      run: async () => {
        const { body: active } = await fetchJson("/api/events");
        const { body: cancelled } = await fetchJson(
          "/api/events?status=cancelled"
        );
        const noActiveCancelled = active.data?.every(
          (e: { status: string }) => e.status !== "cancelled"
        );
        const hasCancelled = cancelled.data?.some(
          (e: { status: string }) => e.status === "cancelled"
        );
        return {
          pass: noActiveCancelled && hasCancelled,
          detail: `active_has_cancelled=${!noActiveCancelled}, cancelled_count=${cancelled.data?.length}`,
        };
      },
    },
    {
      name: "8. Case 1: Sep 14-21, couples+luxury -> 3 events",
      run: async () => {
        const { body } = await fetchJson(
          "/api/events?from=2027-09-14&to=2027-09-21&suitable_for=couples,luxury"
        );
        const titles = body.data?.map((e: { title: string }) => e.title) ?? [];
        const ok = titles.length === 3;
        return { pass: ok, detail: `count=${titles.length}: ${titles.join(", ")}` };
      },
    },
    {
      name: "9. Case 2: Jun, families -> 2 events",
      run: async () => {
        const { body } = await fetchJson(
          "/api/events?from=2027-06-01&to=2027-06-30&suitable_for=families"
        );
        const titles = body.data?.map((e: { title: string }) => e.title) ?? [];
        const ok = titles.length === 2;
        return { pass: ok, detail: `count=${titles.length}: ${titles.join(", ")}` };
      },
    },
    {
      name: "10. Case 4: Cancelled Beach Concert in cancelled list",
      run: async () => {
        const { body } = await fetchJson("/api/events?status=cancelled");
        const found = body.data?.some((e: { title: string }) =>
          e.title.toLowerCase().includes("beach concert")
        );
        return { pass: found, detail: `found=${found}` };
      },
    },
    {
      name: "11. Pagination: per_page=2 pages through",
      run: async () => {
        const { body } = await fetchJson("/api/events?per_page=2");
        const ok =
          body.data?.length === 2 &&
          body.meta?.has_more === true &&
          body.meta?.total_count > 2;
        return {
          pass: ok,
          detail: `page_size=${body.data?.length}, total=${body.meta?.total_count}, has_more=${body.meta?.has_more}`,
        };
      },
    },
    {
      name: "12. Sorting: date, confidence, relevance",
      run: async () => {
        const [d, c, r] = await Promise.all([
          fetchJson("/api/events?sort=date"),
          fetchJson("/api/events?sort=confidence"),
          fetchJson("/api/events?sort=relevance"),
        ]);
        const ok =
          d.body.data?.length > 0 &&
          c.body.data?.length > 0 &&
          r.body.data?.length > 0;
        return {
          pass: ok,
          detail: `date=${d.body.data?.length}, confidence=${c.body.data?.length}, relevance=${r.body.data?.length}`,
        };
      },
    },
    {
      name: "13. Relevance: luxury + relevance -> Wine Tasting in top 3",
      run: async () => {
        const { body } = await fetchJson(
          "/api/events?suitable_for=luxury&sort=relevance"
        );
        const titles = body.data?.map((e: { title: string }) => e.title) ?? [];
        const wineIdx = titles.findIndex((t: string) =>
          t.toLowerCase().includes("wine")
        );
        return {
          pass: wineIdx >= 0 && wineIdx <= 2,
          detail: `wine_rank=${wineIdx + 1}, order=${titles.slice(0, 3).join(", ")}`,
        };
      },
    },
    {
      name: "14. Error handling: 404, 422, 400",
      run: async () => {
        const [not_found, bad_body, bad_dates] = await Promise.all([
          fetchJson("/api/events/nonexistent-id-12345"),
          fetchJson("/api/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
          }),
          fetchJson("/api/events?from=2027-12-31&to=2027-01-01"),
        ]);
        const ok =
          not_found.status === 404 &&
          bad_body.status === 422 &&
          bad_dates.status === 400;
        return {
          pass: ok,
          detail: `404=${not_found.status}, 422=${bad_body.status}, 400=${bad_dates.status}`,
        };
      },
    },
    {
      name: "15. Cron auth: GET /api/cron without header -> 401",
      run: async () => {
        const { status } = await fetchJson("/api/cron");
        return { pass: status === 401, detail: `status=${status}` };
      },
    },
    {
      name: "16. Ingest runs: has data with run stats",
      run: async () => {
        const { body } = await fetchJson("/api/ingest/runs");
        const ok = Array.isArray(body.data) && "meta" in body;
        return { pass: ok, detail: `runs=${body.data?.length}` };
      },
    },
    {
      name: "17. Review agent: POST /api/review -> events_checked",
      run: async () => {
        const { body } = await fetchJson("/api/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const ok = typeof body.data?.events_checked === "number";
        return {
          pass: ok,
          detail: `events_checked=${body.data?.events_checked}`,
        };
      },
    },
    {
      name: "18. CRUD lifecycle: create, read, update, conflict, versions, delete",
      run: async () => {
        const steps: string[] = [];

        // Create
        const { body: created } = await fetchJson("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "E2E Test Event",
            source_id: "manual",
            location: {
              name: "Hermanus",
              town: "Hermanus",
              region: "Overberg",
              province: "Western Cape",
              country: "ZA",
              venue: null,
              lat: null,
              lng: null,
              radius_km: null,
            },
            temporal: { type: "point", start_date: "2099-12-31" },
            categories: ["art"],
            suitable_for: ["solo"],
            confidence: 0.9,
          }),
        });
        const id = created.data?.id;
        if (!id) return { pass: false, detail: "Create failed" };
        steps.push("create:ok");

        // Read
        const { body: read } = await fetchJson(`/api/events/${id}`);
        if (read.data?.title !== "E2E Test Event")
          return { pass: false, detail: `Read failed: ${read.data?.title}` };
        steps.push("read:ok");

        // Update
        const { body: updated } = await fetchJson(`/api/events/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "E2E Updated", version: 1 }),
        });
        if (updated.data?.title !== "E2E Updated")
          return { pass: false, detail: "Update failed" };
        steps.push("update:ok");

        // Version conflict
        const { status: conflictStatus } = await fetchJson(
          `/api/events/${id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: "Conflict", version: 1 }),
          }
        );
        if (conflictStatus !== 409)
          return {
            pass: false,
            detail: `Conflict expected 409, got ${conflictStatus}`,
          };
        steps.push("conflict:ok");

        // Versions
        const { body: versions } = await fetchJson(
          `/api/events/${id}/versions`
        );
        if (!versions.data?.length)
          return { pass: false, detail: "No versions found" };
        steps.push("versions:ok");

        // Delete
        const { body: deleted } = await fetchJson(`/api/events/${id}`, {
          method: "DELETE",
        });
        if (deleted.data?.status !== "cancelled")
          return { pass: false, detail: "Delete didn't cancel" };
        steps.push("delete:ok");

        return { pass: true, detail: steps.join(", ") };
      },
    },
    {
      name: "19. Manual submission: create, verify source, clean up",
      run: async () => {
        // Create a manual event
        const { status, body: created } = await fetchJson("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Claude Manual Test Event",
            description: "Submitted via E2E runner to test manual submission.",
            source_id: "manual",
            location: {
              name: "Hermanus",
              town: "Hermanus",
              region: "Overberg",
              province: "Western Cape",
              country: "ZA",
              venue: null,
              lat: null,
              lng: null,
              radius_km: null,
            },
            temporal: { type: "point", start_date: "2099-01-15" },
            categories: ["art"],
            suitable_for: ["solo"],
            confidence: 0.7,
          }),
        });

        if (status !== 201 || !created.data?.id)
          return { pass: false, detail: `Create failed: status=${status}` };

        const id = created.data.id;

        // Verify source_id is manual
        const { body: read } = await fetchJson(`/api/events/${id}`);
        if (read.data?.source_id !== "manual")
          return { pass: false, detail: `source_id=${read.data?.source_id}, expected manual` };

        // Clean up
        await fetchJson(`/api/events/${id}`, { method: "DELETE" });

        return { pass: true, detail: `created=${id}, source_id=manual, cleaned up` };
      },
    },
  ];
}

const STATUS_ICON = {
  pass: CheckCircle2,
  fail: XCircle,
  running: Loader2,
  pending: Circle,
} as const;

export function E2ETestRunner() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(false);

  async function runAll() {
    const checks = buildChecks();
    setRunning(true);
    setResults(checks.map((c) => ({ name: c.name, status: "pending" })));

    for (let i = 0; i < checks.length; i++) {
      setResults((prev) =>
        prev.map((r, j) => (j === i ? { ...r, status: "running" } : r))
      );

      try {
        const { pass, detail } = await checks[i].run();
        setResults((prev) =>
          prev.map((r, j) =>
            j === i
              ? { ...r, status: pass ? "pass" : "fail", detail }
              : r
          )
        );
      } catch (err) {
        setResults((prev) =>
          prev.map((r, j) =>
            j === i
              ? {
                  ...r,
                  status: "fail",
                  detail: err instanceof Error ? err.message : "Unknown error",
                }
              : r
          )
        );
      }
    }

    setRunning(false);
  }

  const passCount = results.filter((r) => r.status === "pass").length;
  const failCount = results.filter((r) => r.status === "fail").length;
  const total = results.length;

  return (
    <div className="space-y-4">
      <Card className="bg-whisper-green/50 border-vibrant-leaf/20">
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          <Button
            icon={Play}
            isLoading={running}
            loadingText="Running..."
            onClick={runAll}
          >
            Run All 19 Checks
          </Button>
          {total > 0 && (
            <div className="flex items-center gap-3">
              <Badge variant="success">{passCount} pass</Badge>
              {failCount > 0 && (
                <Badge variant="destructive">{failCount} fail</Badge>
              )}
              <span className="text-xs text-deep-forest/50">
                {passCount + failCount} / {total} complete
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {results.length > 0 && (
        <div className="space-y-1.5">
          {results.map((r) => {
            const Icon = STATUS_ICON[r.status];
            return (
              <Card
                key={r.name}
                className={cn(
                  "transition-colors",
                  r.status === "pass" && "border-vibrant-leaf/30 bg-fresh-mint/30",
                  r.status === "fail" && "border-red-200 bg-red-50",
                  r.status === "running" && "border-amber-200 bg-amber-50",
                )}
              >
                <CardContent className="flex items-start gap-3 p-3">
                  <Icon
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0",
                      r.status === "pass" && "text-vibrant-leaf",
                      r.status === "fail" && "text-red-500",
                      r.status === "running" && "animate-spin text-amber-500",
                      r.status === "pending" && "text-soft-sage",
                    )}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{r.name}</p>
                    {r.detail && (
                      <p className="mt-0.5 break-all text-xs text-deep-forest/50">
                        {r.detail}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
