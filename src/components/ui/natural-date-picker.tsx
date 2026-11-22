"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import * as chrono from "chrono-node";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { trySeasonParse, getSeasonLabel } from "@/lib/season-dates";
import { cn } from "@/lib/utils";

/** Format a Date to "Mon DD, YYYY" using native Intl */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

/** Format a Date to YYYY-MM-DD for API params */
function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parse a YYYY-MM-DD string to a local Date (noon to avoid timezone edge cases) */
function parseISODate(value: string): Date | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  const date = new Date(y, m - 1, d, 12, 0, 0);
  if (isNaN(date.getTime())) return undefined;
  return date;
}

interface NaturalDatePickerProps {
  /** Current value as YYYY-MM-DD string (matches API param format) */
  value: string;
  /** Called with YYYY-MM-DD string when date changes, or "" when cleared */
  onChange: (isoDate: string) => void;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Label text shown above the picker */
  label?: string;
  /** Minimum selectable date */
  minDate?: Date;
  /** Maximum selectable date */
  maxDate?: Date;
  /** Whether this picker is the start or end of a range (affects season resolution) */
  role?: "start" | "end";
  /** Additional className for the wrapper */
  className?: string;
}

export function NaturalDatePicker({
  value,
  onChange,
  placeholder = 'e.g. "tomorrow", "next friday", "dec 25"',
  label,
  minDate,
  maxDate,
  role = "start",
  className,
}: NaturalDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const [displayMonth, setDisplayMonth] = useState<Date>(new Date());
  const inputRef = useRef<HTMLInputElement>(null);

  // Derive selected date from the controlled value prop
  const selectedDate = parseISODate(value);

  // Sync input text when value changes externally (e.g. URL params, clear)
  useEffect(() => {
    if (selectedDate) {
      setInputText(formatDate(selectedDate));
      setDisplayMonth(selectedDate);
    } else {
      setInputText("");
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // Parse natural language input: try seasons first, then chrono-node.
  // Seasons receive the notBefore constraint so "spring" in a To picker
  // after "winter" in From correctly resolves to the right year.
  const parseText = useCallback(
    (text: string): Date | null => {
      const trimmed = text.trim();
      if (!trimmed) return null;

      // Try season aliases first (chrono-node doesn't understand these)
      const season = trySeasonParse(trimmed, role, undefined, minDate);
      if (season) return season;

      // Fall back to chrono-node for calendar-relative phrases
      return chrono.parseDate(trimmed, new Date(), { forwardDate: true });
    },
    [role, minDate],
  );

  const handleInputChange = useCallback(
    (text: string) => {
      setInputText(text);

      if (!text.trim()) {
        onChange("");
        return;
      }

      const parsed = parseText(text);
      if (parsed) {
        // Validate against min/max constraints
        if (minDate && parsed < minDate) return;
        if (maxDate && parsed > maxDate) return;

        onChange(toISODate(parsed));
        setDisplayMonth(parsed);
      }
      // If not parseable yet, leave the current date untouched — user may still be typing
    },
    [onChange, minDate, maxDate, parseText],
  );

  // Handle calendar day selection
  const handleCalendarSelect = useCallback(
    (date: Date | undefined) => {
      if (date) {
        onChange(toISODate(date));
        setInputText(formatDate(date));
        setDisplayMonth(date);
      } else {
        onChange("");
        setInputText("");
      }
      setOpen(false);
    },
    [onChange],
  );

  // Handle Enter key to confirm and close
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        // Try parsing one more time on Enter
        const parsed = parseText(inputText);
        if (parsed) {
          if (minDate && parsed < minDate) return;
          if (maxDate && parsed > maxDate) return;
          onChange(toISODate(parsed));
          setInputText(formatDate(parsed));
          setDisplayMonth(parsed);
        }
        setOpen(false);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    },
    [inputText, onChange, minDate, maxDate, parseText],
  );

  // Clear the date
  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange("");
      setInputText("");
      setOpen(false);
    },
    [onChange],
  );

  // Build disabled matcher for the calendar
  const disabledMatcher = buildDisabledMatcher(minDate, maxDate);

  return (
    <div className={cn("flex flex-col", className)}>
      {label && (
        <span className="mb-1 text-sm font-medium text-deep-forest">
          {label}
        </span>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex h-9 w-full items-center gap-2 rounded-md border border-soft-sage bg-white px-3 text-left text-sm shadow-sm transition-colors",
              "hover:border-vibrant-leaf focus:border-vibrant-leaf focus:outline-none focus:ring-1 focus:ring-vibrant-leaf",
              !selectedDate && "text-deep-forest/40",
            )}
            aria-label={label ? `${label}: ${selectedDate ? formatDate(selectedDate) : "not set"}` : undefined}
          >
            <CalendarIcon className="h-4 w-4 shrink-0 text-deep-forest/40" />
            <span className="flex-1 truncate">
              {selectedDate ? formatDate(selectedDate) : placeholder}
            </span>
            {selectedDate && (
              <span
                role="button"
                tabIndex={0}
                onClick={handleClear}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") handleClear(e as unknown as React.MouseEvent);
                }}
                className="shrink-0 rounded p-0.5 text-deep-forest/40 hover:bg-whisper-green hover:text-deep-forest"
                aria-label="Clear date"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            // Focus the text input when popover opens
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
        >
          <div className="flex flex-col">
            {/* Natural language input */}
            <div className="border-b border-soft-sage p-3">
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className={cn(
                  "w-full rounded-md border border-soft-sage bg-whisper-green/50 px-3 py-1.5 text-sm",
                  "placeholder:text-deep-forest/30",
                  "focus:border-vibrant-leaf focus:outline-none focus:ring-1 focus:ring-vibrant-leaf",
                )}
                aria-label="Type a date in natural language"
              />
              {inputText && !selectedDate && !getSeasonLabel(inputText) && (
                <p className="mt-1 text-xs text-deep-forest/40">
                  Try: &quot;tomorrow&quot;, &quot;next friday&quot;, &quot;winter&quot;, &quot;whale season&quot;
                </p>
              )}
              {getSeasonLabel(inputText) && selectedDate && (
                <p className="mt-1 text-xs text-vibrant-leaf">
                  {getSeasonLabel(inputText)} — {role === "start" ? "start" : "end"}
                </p>
              )}
            </div>
            {/* Calendar */}
            <div className="p-2">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleCalendarSelect}
                month={displayMonth}
                onMonthChange={setDisplayMonth}
                disabled={disabledMatcher}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** Build a disabled day matcher from optional min/max dates */
function buildDisabledMatcher(
  minDate?: Date,
  maxDate?: Date,
): Array<{ before: Date } | { after: Date }> | undefined {
  const matchers: Array<{ before: Date } | { after: Date }> = [];
  if (minDate) matchers.push({ before: minDate });
  if (maxDate) matchers.push({ after: maxDate });
  return matchers.length > 0 ? matchers : undefined;
}
