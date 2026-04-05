import { motion } from "framer-motion";
import { Loader2, Pause, Play } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

interface CrawlProgressProps {
  phase: "idle" | "parsing" | "crawling" | "paused" | "done" | "error";
  processed: number;
  total: number;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
}

export function CrawlProgress({ phase, processed, total, onPause, onResume, onCancel }: CrawlProgressProps) {
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
          {phase === "paused" ? (
            <Pause className="h-3 w-3 text-warning" />
          ) : (
            <Loader2 className="h-3 w-3 animate-spin" />
          )}
          {phase === "parsing" ? "Parsing sitemap…" : phase === "paused" ? `Paused — ${processed} of ${total} URLs` : `${processed} of ${total} URLs`}
        </div>
        <div className="flex items-center gap-1.5">
          {(phase === "crawling" || phase === "paused") && (
            <span className="font-mono text-[11px] text-muted-foreground">{percentage}%</span>
          )}
          {phase === "crawling" && onPause && (
            <Button size="sm" variant="outline" onClick={onPause} className="h-6 px-2 text-[10px] gap-1">
              <Pause className="h-2.5 w-2.5" /> Pause
            </Button>
          )}
          {phase === "paused" && onResume && (
            <Button size="sm" variant="default" onClick={onResume} className="h-6 px-2 text-[10px] gap-1">
              <Play className="h-2.5 w-2.5" /> Resume
            </Button>
          )}
          {(phase === "crawling" || phase === "paused") && onCancel && (
            <Button size="sm" variant="outline" onClick={onCancel} className="h-6 px-2 text-[10px]">
              Cancel
            </Button>
          )}
        </div>
      </div>
      {(phase === "crawling" || phase === "paused") && (
        <Progress value={percentage} className="h-1" />
      )}
    </motion.div>
  );
}
