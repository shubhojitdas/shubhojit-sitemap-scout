import { useMemo, useState } from "react";
import { Trophy, AlertTriangle, ChevronUp, ChevronDown, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { computeLinkEquity, type PageEquity } from "@/lib/link-analysis";
import { rowsToTSV } from "@/lib/crawl-api";
import type { CrawlResult } from "@/lib/crawl-api";
import { toast } from "@/hooks/use-toast";

interface Props {
  results: CrawlResult[];
}

type SortKey = "score" | "incoming" | "outgoing" | "diversity";

const STRENGTH_TONE: Record<PageEquity["strength"], string> = {
  strong:  "bg-success/15 text-success",
  average: "bg-muted/40 text-foreground/80",
  weak:    "bg-warning/15 text-warning",
  orphan:  "bg-destructive/15 text-destructive",
};

export function LinkEquityPanel({ results }: Props) {
  const report = useMemo(() => computeLinkEquity(results), [results]);
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const summary = useMemo(() => {
    const strong = report.pages.filter((p) => p.strength === "strong").length;
    const weak = report.pages.filter((p) => p.strength === "weak").length;
    const orphan = report.pages.filter((p) => p.strength === "orphan").length;
    const overlinked = report.pages.filter((p) => p.overlinked).length;
    const lowDiversity = report.pages.filter((p) => p.incoming >= 5 && p.anchorDiversity < 0.3).length;
    return { strong, weak, orphan, overlinked, lowDiversity };
  }, [report]);

  const sorted = useMemo(() => {
    const arr = [...report.pages];
    arr.sort((a, b) => {
      let v = 0;
      switch (sortKey) {
        case "score":     v = a.score - b.score; break;
        case "incoming":  v = a.incoming - b.incoming; break;
        case "outgoing":  v = a.outgoing - b.outgoing; break;
        case "diversity": v = a.anchorDiversity - b.anchorDiversity; break;
      }
      return sortDir === "desc" ? -v : v;
    });
    return arr.slice(0, 500);
  }, [report.pages, sortKey, sortDir]);

  const handleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(k); setSortDir("desc"); }
  };

  const handleCopy = () => {
    const rows = sorted.map((p) => [
      p.url, String(p.incoming), String(p.outgoing), String(p.uniqueAnchors),
      (p.anchorDiversity * 100).toFixed(0) + "%", String(p.score), p.strength,
      p.topAnchor ?? "—",
    ]);
    navigator.clipboard.writeText(rowsToTSV(
      ["URL", "Incoming", "Outgoing", "Unique Anchors", "Anchor Diversity", "Score", "Strength", "Top Anchor"],
      rows
    ));
    toast({ title: "Copied", description: `${rows.length} pages copied as TSV.` });
  };

  if (report.pages.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center gap-2 flex-wrap">
        <Trophy className="h-3.5 w-3.5 text-warning" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/80">
          Internal link equity
        </span>
        <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal">
          {report.pages.length} pages
        </Badge>
        <Button variant="ghost" size="sm" className="h-6 text-[11px] ml-auto" onClick={handleCopy}>
          <Copy className="h-3 w-3 mr-1" />
          Copy report
        </Button>
      </div>

      {/* Insight strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3">
        <Stat label="Strong pages" value={summary.strong} tone="text-success" />
        <Stat label="Weak pages" value={summary.weak} tone="text-warning" />
        <Stat label="Orphans" value={summary.orphan} tone="text-destructive" />
        <Stat label="Overlinked (>100)" value={summary.overlinked} tone="text-warning" />
        <Stat label="Low anchor diversity" value={summary.lowDiversity} tone="text-warning" />
      </div>

      <ScrollArea className="h-[340px] border-t border-border">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_hsl(var(--border))]">
            <tr>
              <th className="text-left px-3 py-1.5 font-medium text-muted-foreground bg-card">URL</th>
              <SortHead label="In" k="incoming" sortKey={sortKey} sortDir={sortDir} onClick={handleSort} />
              <SortHead label="Out" k="outgoing" sortKey={sortKey} sortDir={sortDir} onClick={handleSort} />
              <SortHead label="Diversity" k="diversity" sortKey={sortKey} sortDir={sortDir} onClick={handleSort} />
              <SortHead label="Score" k="score" sortKey={sortKey} sortDir={sortDir} onClick={handleSort} />
              <th className="text-left px-3 py-1.5 font-medium text-muted-foreground bg-card">Strength</th>
              <th className="text-left px-3 py-1.5 font-medium text-muted-foreground bg-card">Top anchor</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.url} className="border-t border-border hover:bg-muted/30">
                <td className="px-3 py-1.5 max-w-[260px] truncate font-mono">
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{p.url}</a>
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">{p.incoming}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {p.outgoing}
                  {p.overlinked && (
                    <AlertTriangle className="inline h-3 w-3 ml-1 text-warning" />
                  )}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {p.incoming > 0 ? (p.anchorDiversity * 100).toFixed(0) + "%" : "—"}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{p.score}</td>
                <td className="px-3 py-1.5">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${STRENGTH_TONE[p.strength]}`}>
                    {p.strength}
                  </span>
                </td>
                <td className="px-3 py-1.5 max-w-[160px] truncate text-muted-foreground">
                  {p.topAnchor ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>
      {report.pages.length > 500 && (
        <div className="px-3 py-2 text-[10px] text-muted-foreground border-t border-border">
          Showing top 500 of {report.pages.length.toLocaleString()} pages — use copy report for the full dataset.
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-md border border-border p-2">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold tabular-nums ${tone ?? ""}`}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function SortHead({
  label, k, sortKey, sortDir, onClick,
}: { label: string; k: SortKey; sortKey: SortKey; sortDir: "asc" | "desc"; onClick: (k: SortKey) => void }) {
  const active = sortKey === k;
  return (
    <th className="px-3 py-1.5 text-right bg-card">
      <button
        onClick={() => onClick(k)}
        className={`inline-flex items-center gap-0.5 text-[10px] font-medium uppercase tracking-wider ${active ? "text-foreground" : "text-muted-foreground"} hover:text-foreground`}
      >
        {label}
        {active && (sortDir === "desc" ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />)}
      </button>
    </th>
  );
}
