import { cn } from "@/lib/utils";

function barColor(value: number): string {
  if (value >= 0.8) return "bg-vibrant-leaf";
  if (value >= 0.6) return "bg-vibrant-leaf/70";
  if (value >= 0.3) return "bg-amber-500";
  return "bg-red-500";
}

export function ConfidenceMeter({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-soft-sage/40">
        <div
          className={cn("h-full rounded-full transition-all", barColor(value))}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-deep-forest/60">{pct}%</span>
    </div>
  );
}
