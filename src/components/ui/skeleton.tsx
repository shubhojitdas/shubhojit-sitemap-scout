import { cn } from "@/lib/utils";

/**
 * Skeleton — GSAP-style shimmer sweep instead of a flat pulse.
 * Fully backward compatible: existing `<Skeleton className="h-4 w-32" />`
 * usages keep working; the shimmer replaces the old pulse effect.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("skeleton-shimmer rounded-md", className)}
      {...props}
    />
  );
}

export { Skeleton };
