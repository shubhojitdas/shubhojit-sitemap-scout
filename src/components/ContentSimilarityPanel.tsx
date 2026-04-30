import { useMemo, useState } from "react";
import { Layers, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { analyzeSimilarity } from "@/lib/seo-advanced";
import { rowsToTSV } from "@/lib/crawl-api";
import type { CrawlResult } from "@/lib/crawl-api";
import { toast } from "@/hooks/use-toast";

interface Props {
  results: CrawlResult[];
  /** Cannibalization view shows only pairs with strong title/H1 overlap. */
  mode?: "similarity" | "cannibalization";
}

export function ContentSimilarityPanel({ results, mode = "similarity" }: Props) {
  const report = useMemo(() => analyzeSimilarity(results), [results]);
  const pairs = mode === "cannibalization" ? report.cannibalization : report.pairs;
  const [topN, setTopN] = useState(50);

  if (pairs.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-[11px] text-muted-foreground">
        No {mode === "cannibalization" ? "cannibalization" : "near-duplicate"} pages detected from crawl signals.
      </div>
    );
  }

  const visible = pairs.slice(0, topN);

  const handleCopy = () => {
    const data = visible.map((p) => [
      p.a, p.b, (p.similarity * 100).toFixed(0) + "%",
      (p.titleSim * 100).toFixed(0) + "%", (p.h1Sim * 100).toFixed(0) + "%",
      p.warning, p.reasons.join(", "),
    ]);
    navigator.clipboard.writeText(rowsToTSV(
      ["URL A", "URL B", "Similarity", "Title sim", "H1 sim", "Warning", "Reasons"], data,
    ));
    toast({ title: "Copied", description: `${visible.length} pairs copied as TSV.` });
  };

  const title = mode === "cannibalization" ? "Cannibalization candidates" : "Content similarity";

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center gap-2 flex-wrap">
        <Layers className="h-3.5 w-3.5 text-warning" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/80">{title}</span>
        <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal">{pairs.length} pairs</Badge>
        <Button variant="ghost" size="sm" className="h-6 text-[11px] ml-auto" onClick={handleCopy}>
          <Copy className="h-3 w-3 mr-1" />
          Copy
        </Button>
      </div>
      <ScrollArea className="h-[340px]">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_hsl(var(--border))]">
            <tr>
              <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">URL A</th>
              <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">URL B</th>
              <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">Similarity</th>
              <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Reasons</th>
              <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Warning</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((p, i) => (
              <tr key={i} className="border-t border-border hover:bg-muted/30 align-top">
                <td className="px-3 py-1.5 max-w-[220px] truncate font-mono">
                  <a href={p.a} target="_blank" rel="noopener noreferrer" className="hover:underline">{p.a}</a>
                </td>
                <td className="px-3 py-1.5 max-w-[220px] truncate font-mono">
                  <a href={p.b} target="_blank" rel="noopener noreferrer" className="hover:underline">{p.b}</a>
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums font-semibold">
                  {(p.similarity * 100).toFixed(0)}%
                </td>
                <td className="px-3 py-1.5 text-muted-foreground">
                  {p.reasons.length ? p.reasons.join(", ") : "—"}
                </td>
                <td className="px-3 py-1.5">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${
                    p.warning === "Near Duplicate" ? "bg-destructive/15 text-destructive" :
                    p.warning === "Possible Duplicate" ? "bg-warning/15 text-warning" :
                    "bg-muted/40 text-foreground/80"
                  }`}>{p.warning}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>
      {pairs.length > topN && (
        <div className="px-3 py-2 border-t border-border text-[11px] text-muted-foreground flex items-center justify-between">
          <span>Showing top {topN} of {pairs.length}.</span>
          <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => setTopN(topN + 50)}>
            Show 50 more
          </Button>
        </div>
      )}
    </div>
  );
}
