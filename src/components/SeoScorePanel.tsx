import { useMemo } from "react";
import { Gauge, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { scorePages } from "@/lib/seo-advanced";
import { rowsToTSV } from "@/lib/crawl-api";
import type { CrawlResult } from "@/lib/crawl-api";
import { toast } from "@/hooks/use-toast";

function tone(score: number): string {
  if (score >= 80) return "bg-success/15 text-success";
  if (score >= 60) return "bg-warning/15 text-warning";
  return "bg-destructive/15 text-destructive";
}

export function SeoScorePanel({ results }: { results: CrawlResult[] }) {
  const scored = useMemo(() => scorePages(results).sort((a, b) => a.score - b.score), [results]);
  if (scored.length === 0) return null;

  const avg = Math.round(scored.reduce((s, p) => s + p.score, 0) / scored.length);
  const dist = { strong: 0, ok: 0, weak: 0 };
  for (const p of scored) {
    if (p.score >= 80) dist.strong++;
    else if (p.score >= 60) dist.ok++;
    else dist.weak++;
  }

  const handleCopy = () => {
    const data = scored.slice(0, 500).map((p) => [
      p.url, String(p.score), p.issues.join(", "), p.priorityFixes.join(" | "),
    ]);
    navigator.clipboard.writeText(rowsToTSV(["URL", "Score", "Issues", "Priority Fixes"], data));
    toast({ title: "Copied", description: `${data.length} pages copied as TSV.` });
  };

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center gap-2 flex-wrap">
        <Gauge className="h-3.5 w-3.5 text-warning" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/80">SEO opportunity score</span>
        <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal">avg {avg}/100</Badge>
        <Button variant="ghost" size="sm" className="h-6 text-[11px] ml-auto" onClick={handleCopy}>
          <Copy className="h-3 w-3 mr-1" />
          Copy
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2 p-3">
        <Stat label="Strong (80+)" value={dist.strong} tone="text-success" />
        <Stat label="Needs work (60–79)" value={dist.ok} tone="text-warning" />
        <Stat label="Weak (<60)" value={dist.weak} tone="text-destructive" />
      </div>

      <ScrollArea className="h-[340px] border-t border-border">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_hsl(var(--border))]">
            <tr>
              <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">URL</th>
              <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">Score</th>
              <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Issues</th>
              <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Top fix</th>
            </tr>
          </thead>
          <tbody>
            {scored.slice(0, 500).map((p) => (
              <tr key={p.url} className="border-t border-border hover:bg-muted/30 align-top">
                <td className="px-3 py-1.5 max-w-[260px] truncate font-mono">
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{p.url}</a>
                </td>
                <td className="px-3 py-1.5 text-right">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] tabular-nums font-semibold ${tone(p.score)}`}>
                    {p.score}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-muted-foreground">
                  {p.issues.length ? p.issues.join(" · ") : <span className="text-success">None</span>}
                </td>
                <td className="px-3 py-1.5 text-muted-foreground">
                  {p.priorityFixes[0] ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-md border border-border p-2">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold tabular-nums ${tone ?? ""}`}>{value.toLocaleString()}</div>
    </div>
  );
}
