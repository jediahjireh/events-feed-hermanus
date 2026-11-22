import { cn } from "@/lib/utils";

const DOT_STYLES: Record<string, string> = {
  healthy: "bg-vibrant-leaf",
  unhealthy: "bg-red-500",
  running: "bg-amber-500 animate-pulse",
  completed: "bg-vibrant-leaf",
  failed: "bg-red-500",
};

export function StatusIndicator({
  status,
  label,
}: {
  status: string;
  label?: string;
}) {
  const dot = DOT_STYLES[status] ?? "bg-soft-sage";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("inline-block h-2 w-2 rounded-full", dot)} />
      {label && <span className="text-xs capitalize">{label}</span>}
    </span>
  );
}
