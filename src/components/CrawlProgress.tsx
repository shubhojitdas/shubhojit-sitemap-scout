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
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-xl mx-auto space-y-2"
    >
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          {phase === "parsing" ? "Parsing sitemap…" : `${processed} of ${total} URLs`}
        </div>
        {phase === "crawling" && (
          <span className="font-mono text-[11px] text-muted-foreground">{percentage}%</span>
        )}
      </div>
      {phase === "crawling" && (
        <Progress value={percentage} className="h-1" />
      )}
    </motion.div>
  );
}
