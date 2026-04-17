import { motion } from "framer-motion";
import { Loader2, Pause } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface CrawlProgressProps {
  phase: "idle" | "parsing" | "crawling" | "paused" | "done" | "error";
  source?: "sitemap" | "site" | "urls" | null;
  processed: number;
  total: number;
}

export function CrawlProgress({ phase, source, processed, total }: CrawlProgressProps) {
  if (phase === "idle" || phase === "done") return null;

  const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;
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
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-xl mx-auto space-y-2"
    >
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          {phase === "paused" ? (
            <Pause className="h-3 w-3 text-warning" />
          ) : (
            <Loader2 className="h-3 w-3 animate-spin" />
          )}
          {statusLabel}
        </div>
        {(phase === "crawling" || phase === "paused") && (
          <span className="font-mono text-[11px] text-muted-foreground">{percentage}%</span>
        )}
      </div>
      {(phase === "crawling" || phase === "paused") && (
        <Progress value={percentage} className="h-1" />
      )}
    </motion.div>
  );
}
