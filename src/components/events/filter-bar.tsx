"use client";

import { useMemo } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NaturalDatePicker } from "@/components/ui/natural-date-picker";
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

/** Preset filter scenarios from DESIGN.md hand-worked cases */
const PRESETS = [
  {
    label: "Case 1: Luxury Couple Trip",
    description: "Sep 14–21 2027 · couples + luxury → 3 events expected",
    filters: { from: "2027-09-14", to: "2027-09-21", suitable_for: "couples,luxury" },
  },
  {
    label: "Case 2: Family June",
    description: "Full June 2027 · families → 2 events expected",
    filters: { from: "2027-06-01", to: "2027-06-30", suitable_for: "families" },
  },
  {
    label: "Whale Season",
    description: "Jun–Nov 2027 · wildlife → seasonal + festivals",
    filters: { from: "2027-06-01", to: "2027-11-30", categories: "wildlife" },
  },
  {
    label: "Full Year",
    description: "All 2027 events, no filters",
    filters: { from: "2027-01-01", to: "2027-12-31" },
  },
] as const;

export function FilterBar({
  filters,
  onChange,
  onBatchChange,
}: {
  filters: Record<string, string>;
  onChange: (key: string, value: string) => void;
  /** Set multiple filter values at once (for presets) */
  onBatchChange?: (filters: Record<string, string>) => void;
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

  // Parse "to" date to constrain "from" picker's max, and vice versa
  const toDate = useMemo(() => {
    if (!filters.to) return undefined;
    const [y, m, d] = filters.to.split("-").map(Number);
    return y && m && d ? new Date(y, m - 1, d, 12) : undefined;
  }, [filters.to]);

  const fromDate = useMemo(() => {
    if (!filters.from) return undefined;
    const [y, m, d] = filters.from.split("-").map(Number);
    return y && m && d ? new Date(y, m - 1, d, 12) : undefined;
  }, [filters.from]);

  const selectClass =
    "mt-1 block w-full rounded-md border border-soft-sage bg-white px-3 py-1.5 text-sm shadow-sm focus:border-vibrant-leaf focus:outline-none focus:ring-1 focus:ring-vibrant-leaf";

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        {/* Date range + selects */}
        <div className="flex flex-wrap items-end gap-3">
          <NaturalDatePicker
            label="From"
            value={filters.from ?? ""}
            onChange={(v) => onChange("from", v)}
            maxDate={toDate}
            role="start"
            placeholder='e.g. "tomorrow", "winter"'
            className="w-48"
          />
          <NaturalDatePicker
            label="To"
            value={filters.to ?? ""}
            onChange={(v) => onChange("to", v)}
            minDate={fromDate}
            role="end"
            placeholder='e.g. "spring", "dec 25"'
            className="w-48"
          />
          <label className="text-sm font-medium">
            Source
            <select
              value={filters.source_id ?? ""}
              onChange={(e) => onChange("source_id", e.target.value)}
              className={selectClass}
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
              className={selectClass}
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
                if (onBatchChange) {
                  onBatchChange({});
                } else {
                  for (const key of Object.keys(filters)) {
                    onChange(key, "");
                  }
                }
              }}
            >
              Clear
            </Button>
          )}
        </div>

        {/* Presets */}
        {onBatchChange && (
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-deep-forest/50">
              Quick presets
            </span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => onBatchChange(preset.filters)}
                  title={preset.description}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                    "border-vibrant-leaf/30 bg-fresh-mint/40 text-deep-forest hover:bg-fresh-mint",
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}

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
