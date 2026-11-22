"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSources } from "@/hooks/use-sources";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  "music", "market", "wildlife", "art", "sport", "food-wine", "family",
];

const SUITABLE_FOR = ["couples", "families", "adventure", "luxury", "solo"];

const SORT_OPTIONS = [
  { value: "relevance", label: "Relevance" },
  { value: "date", label: "Date" },
  { value: "confidence", label: "Confidence" },
];

export function FilterBar({
  filters,
  onChange,
}: {
  filters: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  const { data: sources = [] } = useSources();

  const activeCategories = (filters.categories ?? "").split(",").filter(Boolean);
  const activeSuitableFor = (filters.suitable_for ?? "").split(",").filter(Boolean);

  function toggleChip(key: "categories" | "suitable_for", value: string) {
    const current = key === "categories" ? activeCategories : activeSuitableFor;
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onChange(key, next.join(","));
  }

  const hasFilters = Object.values(filters).some((v) => v);

  const inputClass =
    "mt-1 block w-full rounded-md border border-soft-sage bg-white px-3 py-1.5 text-sm shadow-sm focus:border-vibrant-leaf focus:outline-none focus:ring-1 focus:ring-vibrant-leaf";

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        {/* Date range + selects */}
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm font-medium">
            From
            <input
              type="date"
              value={filters.from ?? ""}
              onChange={(e) => onChange("from", e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="text-sm font-medium">
            To
            <input
              type="date"
              value={filters.to ?? ""}
              onChange={(e) => onChange("to", e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="text-sm font-medium">
            Source
            <select
              value={filters.source_id ?? ""}
              onChange={(e) => onChange("source_id", e.target.value)}
              className={inputClass}
            >
              <option value="">All sources</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Sort
            <select
              value={filters.sort ?? "relevance"}
              onChange={(e) => onChange("sort", e.target.value)}
              className={inputClass}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              icon={X}
              onClick={() => {
                for (const key of Object.keys(filters)) {
                  onChange(key, "");
                }
              }}
            >
              Clear
            </Button>
          )}
        </div>

        {/* Categories */}
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-deep-forest/50">
            Categories
          </span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => toggleChip("categories", cat)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  activeCategories.includes(cat)
                    ? "bg-vibrant-leaf text-white"
                    : "border border-soft-sage bg-white text-deep-forest hover:bg-whisper-green",
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Suitable for */}
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-deep-forest/50">
            Suitable for
          </span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {SUITABLE_FOR.map((s) => (
              <button
                key={s}
                onClick={() => toggleChip("suitable_for", s)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  activeSuitableFor.includes(s)
                    ? "bg-vibrant-leaf text-white"
                    : "border border-soft-sage bg-white text-deep-forest hover:bg-whisper-green",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
