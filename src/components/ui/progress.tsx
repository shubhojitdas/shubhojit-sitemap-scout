import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";

/**
 * Progress bar — GSAP-style smooth easing on fill, plus an ambient
 * shimmer sweep + subtle primary glow to make the indeterminate wait
 * feel alive without changing any crawl logic.
 */
const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "relative h-2 w-full overflow-hidden rounded-full bg-secondary/70 border border-border/40",
      className,
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="relative h-full w-full flex-1 overflow-hidden rounded-full bg-gradient-to-r from-primary/90 via-primary to-primary/90"
      style={{
        transform: `translateX(-${100 - (value || 0)}%)`,
        transition: "transform 700ms cubic-bezier(0.22, 1, 0.36, 1)",
        boxShadow:
          "0 0 12px hsl(var(--primary) / 0.55), 0 0 24px hsl(var(--primary) / 0.25)",
      }}
    >
      {/* Shimmer sweep over the filled portion */}
      <span
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, hsl(0 0% 100% / 0.35) 50%, transparent 100%)",
          transform: "translateX(-100%)",
          animation: "shimmer-sweep 1.6s cubic-bezier(0.22, 1, 0.36, 1) infinite",
        }}
      />
    </ProgressPrimitive.Indicator>
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
