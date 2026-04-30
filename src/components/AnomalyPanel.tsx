import { useMemo, useState } from "react";
import { ShieldAlert, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { detectAnomalies, type AnomalySeverity } from "@/lib/seo-advanced";
import { rowsToTSV } from "@/lib/crawl-api";
import type { CrawlResult } from "@/lib/crawl-api";
import { toast } from "@/hooks/use-toast";

const TONE: Record<AnomalySeverity, string> = {
  high:   "bg-destructive/15 text-destructive",
  medium: "bg-warning/15 text-warning",
  low:    "bg-muted/40 text-foreground/70",
};

export function AnomalyPanel({ results }: { results: CrawlResult[] }) {
  const rows = useMemo(() => detectAnomalies(results), [results]);
  const [filter, setFilter] = useState<"all" | AnomalySeverity>("all");

  if (rows.length === 0) return null;

  const visible = (filter === "all" ? rows : rows.filter((r) => r.severity === filter)).slice(0, 500);

  const counts = useMemo(() => {
    const c: Record<AnomalySeverity, number> = { high: 0, medium: 0, low: 0 };
    for (const r of rows) c[r.severity]++;
    return c;
  }, [rows]);

  const handleCopy = () => {
    const data = visible.map((r) => [r.url, r.type, r.severity]);
    navigator.clipboard.writeText(rowsToTSV(["URL", "Anomaly", "Severity"], data));
    toast({ title: "Copied", description: `${data.length} anomalies copied as TSV.` });
  };

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center gap-2 flex-wrap">
        <ShieldAlert className="h-3.5 w-3.5 text-warning" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/80">Unusual page behavior</span>
        <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal">{rows.length}</Badge>
        <Button variant="ghost" size="sm" className="h-6 text-[11px] ml-auto" onClick={handleCopy}>
          <Copy className="h-3 w-3 mr-1" />
          Copy
        </Button>
      </div>

      <div className="flex flex-wrap gap-1 p-2 border-b border-border">
        {(["all", "high", "medium", "low"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
              filter === k ? "bg-foreground text-background" : "bg-muted/60 text-foreground/80 hover:bg-muted"
            }`}
          >
            {k === "all" ? `All (${rows.length})` : `${k.charAt(0).toUpperCase() + k.slice(1)} (${counts[k]})`}
          </button>
        ))}
      </div>

      <ScrollArea className="h-[300px]">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_hsl(var(--border))]">
            <tr>
              <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">URL</th>
              <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Anomaly</th>
              <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Severity</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => (
              <tr key={i} className="border-t border-border hover:bg-muted/30">
                <td className="px-3 py-1.5 max-w-[320px] truncate font-mono">
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{r.url}</a>
                </td>
                <td className="px-3 py-1.5">{r.type}</td>
                <td className="px-3 py-1.5">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${TONE[r.severity]}`}>{r.severity}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>
    </div>
  );
}
