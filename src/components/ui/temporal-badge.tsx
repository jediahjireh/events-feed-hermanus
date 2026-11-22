import { Badge } from "@/components/ui/badge";

const STYLES: Record<string, { variant: "warning" | "info" | "secondary" | "muted"; label: string }> = {
  point: { variant: "warning", label: "One-day" },
  range: { variant: "info", label: "Multi-day" },
  recurring: { variant: "secondary", label: "Recurring" },
  seasonal: { variant: "muted", label: "Seasonal" },
};

export function TemporalBadge({ type }: { type: string }) {
  const style = STYLES[type] ?? STYLES.point;
  return <Badge variant={style.variant}>{style.label}</Badge>;
}
