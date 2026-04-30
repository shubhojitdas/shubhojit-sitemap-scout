import { useMemo, useState } from "react";
import { Scale, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { contentLinkRatio, type ContentRatioRow } from "@/lib/seo-advanced";
import { rowsToTSV } from "@/lib/crawl-api";
import type { CrawlResult } from "@/lib/crawl-api";
import { toast } from "@/hooks/use-toast";

const TONE: Record<ContentRatioRow["status"], string> = {
  Balanced:    "bg-success/15 text-success",
  Overlinked:  "bg-destructive/15 text-destructive",
  Underlinked: "bg-warning/15 text-warning",
  Unknown:     "bg-muted/40 text-foreground/70",
};

export function ContentLinkRatioPanel({ results }: { results: CrawlResult[] }) {
  const rows = useMemo(() => contentLinkRatio(results), [results]);
  const [filter, setFilter] = useState<"all" | ContentRatioRow["status"]>("all");

  const visible = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => r.status === filter)).slice(0, 500),
    [rows, filter],
  );

  const counts = useMemo(() => {
    const c: Record<ContentRatioRow["status"], number> = { Balanced: 0, Overlinked: 0, Underlinked: 0, Unknown: 0 };
    for (const r of rows) c[r.status]++;
    return c;
  }, [rows]);

  if (rows.length === 0) return null;

  const handleCopy = () => {
    const data = visible.map((r) => [
      r.url, String(r.wordCount), String(r.internalLinks),
      Number.isFinite(r.ratio) ? r.ratio.toFixed(1) : "∞", r.status,
    ]);
    navigator.clipboard.writeText(rowsToTSV(["URL", "Word count", "Internal links", "Ratio", "Status"], data));
    toast({ title: "Copied", description: `${data.length} pages copied as TSV.` });
  };

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center gap-2 flex-wrap">
        <Scale className="h-3.5 w-3.5 text-warning" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/80">Content-to-link ratio</span>
        <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal">{rows.length} pages</Badge>
        <Button variant="ghost" size="sm" className="h-6 text-[11px] ml-auto" onClick={handleCopy}>
          <Copy className="h-3 w-3 mr-1" />
          Copy
        </Button>
      </div>

      <div className="flex flex-wrap gap-1 p-2 border-b border-border">
        {(["all", "Balanced", "Overlinked", "Underlinked", "Unknown"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
              filter === k ? "bg-foreground text-background" : "bg-muted/60 text-foreground/80 hover:bg-muted"
            }`}
          >
            {k === "all" ? `All (${rows.length})` : `${k} (${counts[k]})`}
          </button>
        ))}
      </div>

      <ScrollArea className="h-[320px]">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_hsl(var(--border))]">
            <tr>
              <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">URL</th>
              <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">Words</th>
              <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">Internal links</th>
              <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">Ratio</th>
              <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.url} className="border-t border-border hover:bg-muted/30">
                <td className="px-3 py-1.5 max-w-[260px] truncate font-mono">
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{r.url}</a>
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">{r.wordCount.toLocaleString()}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{r.internalLinks.toLocaleString()}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {Number.isFinite(r.ratio) ? r.ratio.toFixed(1) : "∞"}
                </td>
                <td className="px-3 py-1.5">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${TONE[r.status]}`}>{r.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>
    </div>
  );
}
