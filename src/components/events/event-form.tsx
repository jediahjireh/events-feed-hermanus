"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUpdateEvent } from "@/hooks/use-events";
import { cn } from "@/lib/utils";
import type { Event } from "@/types/event";

const CATEGORIES = ["music", "market", "wildlife", "art", "sport", "food-wine", "family"];
const SUITABLE_FOR = ["couples", "families", "adventure", "luxury", "solo"];
const STATUSES = ["active", "cancelled", "tentative", "past"];

export function EventForm({
  event,
  onSaved,
}: {
  event: Event;
  onSaved: (updated: Event) => void;
}) {
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description ?? "");
  const [status, setStatus] = useState(event.status);
  const [categories, setCategories] = useState<string[]>(event.categories);
  const [suitableFor, setSuitableFor] = useState<string[]>(event.suitable_for);
  const [priceIndication, setPriceIndication] = useState(event.price_indication ?? "");

  const updateEvent = useUpdateEvent();

  function toggleItem(list: string[], setList: (v: string[]) => void, item: string) {
    setList(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateEvent.mutate(
      {
        id: event.id,
        data: {
          title,
          description: description || null,
          status,
          categories,
          suitable_for: suitableFor,
          price_indication: priceIndication || null,
          version: event.version,
        },
      },
      {
        onSuccess: (updated) => onSaved(updated),
      },
    );
  }

  const inputClass =
    "w-full rounded-md border border-soft-sage bg-white px-3 py-1.5 text-sm shadow-sm focus:border-vibrant-leaf focus:outline-none focus:ring-1 focus:ring-vibrant-leaf";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {updateEvent.error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {updateEvent.error.message}
        </div>
      )}

      <label className="block text-sm font-medium">
        Title
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={`mt-1 ${inputClass}`} required />
      </label>

      <label className="block text-sm font-medium">
        Description
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className={`mt-1 ${inputClass}`} />
      </label>

      <label className="block text-sm font-medium">
        Status
        <select value={status} onChange={(e) => setStatus(e.target.value as Event["status"])} className={`mt-1 ${inputClass}`}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </label>

      <label className="block text-sm font-medium">
        Price indication
        <input type="text" value={priceIndication} onChange={(e) => setPriceIndication(e.target.value)} placeholder="e.g. Free, R150, R50-R200" className={`mt-1 ${inputClass}`} />
      </label>

      <div>
        <span className="text-sm font-medium">Categories</span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => toggleItem(categories, setCategories, cat)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                categories.includes(cat)
                  ? "bg-vibrant-leaf text-white"
                  : "border border-soft-sage bg-white text-deep-forest hover:bg-whisper-green",
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="text-sm font-medium">Suitable for</span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {SUITABLE_FOR.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggleItem(suitableFor, setSuitableFor, s)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                suitableFor.includes(s)
                  ? "bg-vibrant-leaf text-white"
                  : "border border-soft-sage bg-white text-deep-forest hover:bg-whisper-green",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="submit" isLoading={updateEvent.isPending} loadingText="Saving...">
          Save Changes
        </Button>
      </div>
    </form>
  );
}
