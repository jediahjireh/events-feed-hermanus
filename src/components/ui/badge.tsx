import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-vibrant-leaf text-white",
        secondary:
          "border-transparent bg-fresh-mint text-deep-forest",
        destructive:
          "border-transparent bg-red-600 text-white",
        success:
          "border-transparent bg-vibrant-leaf text-white",
        warning:
          "border-transparent bg-amber-500 text-white",
        info:
          "border-transparent bg-blue-600 text-white",
        outline:
          "border-soft-sage text-deep-forest",
        muted:
          "border-transparent bg-soft-sage/30 text-deep-forest/70",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.ComponentProps<"span">,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
