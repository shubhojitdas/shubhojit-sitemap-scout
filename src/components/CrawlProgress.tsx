import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Pause } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface CrawlProgressProps {
  phase: "idle" | "parsing" | "crawling" | "paused" | "done" | "error";
  source?: "sitemap" | "site" | "urls" | null;
  processed: number;
  total: number;
}

/**
 * Crawl progress — GSAP-style easing on the fill, smooth number
 * cross-fade on updates, and a soft primary glow while active.
 * Pure presentation; no crawl logic touched.
 */
export function CrawlProgress({ phase, source, processed, total }: CrawlProgressProps) {
  if (phase === "idle" || phase === "done") return null;

  const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;
  const isActive = phase === "crawling" || phase === "paused";

  const statusLabel =
    phase === "parsing"
      ? source === "site"
        ? "Crawling website…"
        : source === "sitemap"
          ? "Parsing sitemap…"
          : "Preparing crawl…"
      : phase === "paused"
        ? `Paused — ${processed} of ${total} URLs`
        : `${processed} of ${total} URLs`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-xl mx-auto space-y-2"
    >
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          {phase === "paused" ? (
            <Pause className="h-3 w-3 text-warning" />
          ) : (
            <Loader2 className="h-3 w-3 animate-spin text-primary" />
          )}
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={statusLabel}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              {statusLabel}
            </motion.span>
          </AnimatePresence>
        </div>
        {isActive && (
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={percentage}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="font-mono text-[11px] tabular-nums text-primary/90"
            >
              {percentage}%
            </motion.span>
          </AnimatePresence>
        )}
      </div>
      {isActive && <Progress value={percentage} className="h-1.5" />}
    </motion.div>
  );
}
