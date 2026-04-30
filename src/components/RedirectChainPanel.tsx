import { useMemo, useState } from "react";
import { ArrowRight, Copy, Repeat } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { analyzeRedirects, type RedirectWarning } from "@/lib/seo-advanced";
import { rowsToTSV } from "@/lib/crawl-api";
import type { CrawlResult } from "@/lib/crawl-api";
import { toast } from "@/hooks/use-toast";

const TONE: Record<RedirectWarning, string> = {
  "Single Redirect": "bg-muted/40 text-foreground/80",
  "Redirect Chain":  "bg-warning/15 text-warning",
  "Redirect Loop":   "bg-destructive/15 text-destructive",
};

export function RedirectChainPanel({ results }: { results: CrawlResult[] }) {
  const rows = useMemo(() => analyzeRedirects(results), [results]);
  const [filter, setFilter] = useState<"all" | RedirectWarning>("all");

  if (rows.length === 0) return null;

  const filtered = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => r.warning === filter)).slice(0, 500),
    [rows, filter]
  );

  const counts = useMemo(() => {
    const c: Record<RedirectWarning, number> = { "Single Redirect": 0, "Redirect Chain": 0, "Redirect Loop": 0 };
    for (const r of rows) c[r.warning]++;
    return c;
  }, [rows]);

  const handleCopy = () => {
    const data = filtered.map((r) => [r.originalUrl, String(r.hopCount), r.finalUrl, r.path.join(" → "), r.warning]);
    navigator.clipboard.writeText(rowsToTSV(["Original URL", "Hops", "Final URL", "Path", "Warning"], data));
    toast({ title: "Copied", description: `${filtered.length} redirect rows copied.` });
  };

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center gap-2 flex-wrap">
        <Repeat className="h-3.5 w-3.5 text-warning" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/80">Redirect chains</span>
        <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal">
          {rows.length.toLocaleString()} redirects
        </Badge>
        <Button variant="ghost" size="sm" className="h-6 text-[11px] ml-auto" onClick={handleCopy}>
          <Copy className="h-3 w-3 mr-1" />
          Copy
        </Button>
      </div>

      <div className="flex flex-wrap gap-1 p-2 border-b border-border">
        {(["all", "Single Redirect", "Redirect Chain", "Redirect Loop"] as const).map((k) => (
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
              <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Original URL</th>
              <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Path</th>
              <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">Hops</th>
              <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Final URL</th>
              <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Warning</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={i} className="border-t border-border hover:bg-muted/30 align-top">
                <td className="px-3 py-1.5 max-w-[220px] truncate font-mono">
                  <a href={r.originalUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">{r.originalUrl}</a>
                </td>
                <td className="px-3 py-1.5 max-w-[320px]">
                  <div className="flex items-center gap-1 flex-wrap text-[10px] text-muted-foreground font-mono">
                    {r.path.map((u, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1">
                        <span className="truncate max-w-[180px]" title={u}>{u}</span>
                        {idx < r.path.length - 1 && <ArrowRight className="h-3 w-3 opacity-60" />}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">{r.hopCount}</td>
                <td className="px-3 py-1.5 max-w-[220px] truncate font-mono">
                  <a href={r.finalUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">{r.finalUrl}</a>
                </td>
                <td className="px-3 py-1.5">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${TONE[r.warning]}`}>{r.warning}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>
    </div>
  );
}
