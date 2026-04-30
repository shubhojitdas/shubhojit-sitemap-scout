import { useMemo, useState } from "react";
import { Tag, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { classifyPages, type PageType } from "@/lib/seo-advanced";
import { rowsToTSV } from "@/lib/crawl-api";
import type { CrawlResult } from "@/lib/crawl-api";
import { toast } from "@/hooks/use-toast";

const TONE: Record<PageType, string> = {
  Homepage:       "bg-success/15 text-success",
  Category:       "bg-accent text-accent-foreground",
  Product:        "bg-warning/15 text-warning",
  "Blog/Article": "bg-muted/40 text-foreground/80",
  Utility:        "bg-muted/40 text-foreground/60",
  Other:          "bg-muted/40 text-foreground/60",
};

export function PageTypePanel({ results }: { results: CrawlResult[] }) {
  const map = useMemo(() => classifyPages(results), [results]);
  const [filter, setFilter] = useState<"all" | PageType>("all");

  const counts = useMemo(() => {
    const c: Record<PageType, number> = {
      Homepage: 0, Category: 0, Product: 0, "Blog/Article": 0, Utility: 0, Other: 0,
    };
    for (const t of map.values()) c[t]++;
    return c;
  }, [map]);

  const visible = useMemo(() => {
    return results
      .map((r) => ({ url: r.url, type: map.get(r.url) ?? "Other" as PageType }))
      .filter((r) => filter === "all" || r.type === filter)
      .slice(0, 500);
  }, [results, map, filter]);

  if (results.length === 0) return null;

  const handleCopy = () => {
    const data = visible.map((r) => [r.url, r.type]);
    navigator.clipboard.writeText(rowsToTSV(["URL", "Page Type"], data));
    toast({ title: "Copied", description: `${data.length} pages copied as TSV.` });
  };

  const types: PageType[] = ["Homepage", "Category", "Product", "Blog/Article", "Utility", "Other"];

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center gap-2 flex-wrap">
        <Tag className="h-3.5 w-3.5 text-warning" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/80">Page type classification</span>
        <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal">{results.length} pages</Badge>
        <Button variant="ghost" size="sm" className="h-6 text-[11px] ml-auto" onClick={handleCopy}>
          <Copy className="h-3 w-3 mr-1" />
          Copy
        </Button>
      </div>

      <div className="flex flex-wrap gap-1 p-2 border-b border-border">
        <button
          onClick={() => setFilter("all")}
          className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
            filter === "all" ? "bg-foreground text-background" : "bg-muted/60 text-foreground/80 hover:bg-muted"
          }`}
        >
          All ({results.length})
        </button>
        {types.map((t) => counts[t] > 0 && (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
              filter === t ? "bg-foreground text-background" : "bg-muted/60 text-foreground/80 hover:bg-muted"
            }`}
          >
            {t} ({counts[t]})
          </button>
        ))}
      </div>

      <ScrollArea className="h-[300px]">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_hsl(var(--border))]">
            <tr>
              <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">URL</th>
              <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Page Type</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.url} className="border-t border-border hover:bg-muted/30">
                <td className="px-3 py-1.5 max-w-[420px] truncate font-mono">
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{r.url}</a>
                </td>
                <td className="px-3 py-1.5">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${TONE[r.type]}`}>{r.type}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>
    </div>
  );
}
