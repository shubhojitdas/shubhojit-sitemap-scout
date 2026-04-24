import { Globe, Network, List, Upload, Settings2, Pause, Play, Trash2, RefreshCw, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { LastCrawlInput } from "@/hooks/use-crawler";

interface Props {
  lastInput: LastCrawlInput | null;
  isLoading: boolean;
  isPaused: boolean;
  onOpenConfig: () => void;
  onOpenNewCrawl: () => void;
  onPause: () => void;
  onResume: () => void;
  onClearCrawl: () => void;
  crawlStartedAt: string | null;
  crawlCompletedAt: string | null;
  lastCrawledAt: string | null;
}

const SOURCE_META = {
  sitemap: { icon: Globe, label: "Sitemap" },
  site: { icon: Network, label: "Site crawl" },
  urls: { icon: List, label: "URL list" },
};

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch { return "—"; }
}

function fmtRelative(iso: string | null): string {
  if (!iso) return "—";
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  } catch { return "—"; }
}

/**
 * Compact crawl bar shown on the results page. Shows the user what they crawled
 * (URL + method) and exposes the four primary actions: New crawl, Configure,
 * Pause/Resume (when running), and a prominent Clear.
 */
export function CrawlBar({
  lastInput, isLoading, isPaused, onOpenConfig, onOpenNewCrawl,
  onPause, onResume, onClearCrawl,
  crawlStartedAt, crawlCompletedAt, lastCrawledAt,
}: Props) {
  const Icon = lastInput ? SOURCE_META[lastInput.source].icon : Upload;
  const sourceLabel = lastInput ? SOURCE_META[lastInput.source].label : "Crawl";

  return (
    <div className="w-full flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      {/* ── Left: what was crawled + method + timestamps ── */}
      <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
        <Badge variant="outline" className="gap-1 shrink-0 text-[10px] font-medium uppercase tracking-wider">
          <Icon className="h-3 w-3" />
          {sourceLabel}
        </Badge>
        <span
          className="text-xs font-mono text-muted-foreground truncate min-w-0"
          title={lastInput?.display ?? ""}
        >
          {lastInput?.display || "—"}
        </span>

        {(crawlStartedAt || crawlCompletedAt || lastCrawledAt) && (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <Clock className="h-2.5 w-2.5" />
                  Last crawled {fmtRelative(lastCrawledAt ?? crawlCompletedAt ?? crawlStartedAt)}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="start" className="text-[11px]">
                <div className="space-y-0.5">
                  <div><span className="text-muted-foreground">Crawl started:</span> {fmtTime(crawlStartedAt)}</div>
                  <div><span className="text-muted-foreground">Crawl completed:</span> {fmtTime(crawlCompletedAt)}</div>
                  <div><span className="text-muted-foreground">Last crawled:</span> {fmtTime(lastCrawledAt ?? crawlCompletedAt ?? crawlStartedAt)}</div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* ── Right: action buttons ── */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenConfig}
          disabled={isLoading}
          className="h-8 text-xs gap-1.5"
        >
          <Settings2 className="h-3 w-3" />
          <span className="hidden sm:inline">Configure</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onOpenNewCrawl}
          disabled={isLoading}
          className="h-8 text-xs gap-1.5"
        >
          <RefreshCw className="h-3 w-3" />
          <span className="hidden sm:inline">New crawl</span>
        </Button>

        {isLoading && (
          isPaused ? (
            <Button size="sm" onClick={onResume} className="h-8 text-xs gap-1.5">
              <Play className="h-3 w-3" /> Resume
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={onPause} className="h-8 text-xs gap-1.5">
              <Pause className="h-3 w-3" /> Pause
            </Button>
          )
        )}

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              size="sm"
              className="h-8 text-xs gap-1.5"
            >
              <Trash2 className="h-3 w-3" />
              Clear crawl
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>Clear all crawl data?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes all crawled results. You'll need to re-crawl to get the data back.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={onClearCrawl}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete all data
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
