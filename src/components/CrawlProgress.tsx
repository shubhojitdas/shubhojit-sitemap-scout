import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface CrawlProgressProps {
  phase: "idle" | "parsing" | "crawling" | "done" | "error";
  processed: number;
  total: number;
}

export function CrawlProgress({ phase, processed, total }: CrawlProgressProps) {
  if (phase === "idle" || phase === "done") return null;

  const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-2xl mx-auto space-y-3"
    >
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          {phase === "parsing" ? "Parsing sitemap..." : `Processing ${processed} of ${total} URLs`}
        </div>
        {phase === "crawling" && (
          <span className="text-primary font-mono text-xs font-semibold">{percentage}%</span>
        )}
      </div>
      {phase === "crawling" && (
        <Progress value={percentage} className="h-2" />
      )}
    </motion.div>
  );
}
