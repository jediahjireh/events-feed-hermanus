import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Inline info icon with hover tooltip.
 * No JS state needed — pure CSS :hover.
 */
export function InfoTip({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <span className={cn("relative inline-flex items-center", className)}>
      <span className="group cursor-help">
        <Info className="h-3.5 w-3.5 text-deep-forest/40 transition-colors group-hover:text-vibrant-leaf" />
        <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 w-56 -translate-x-1/2 rounded-md bg-deep-forest px-3 py-2 text-xs leading-relaxed text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
          {text}
          <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-deep-forest" />
        </span>
      </span>
    </span>
  );
}
