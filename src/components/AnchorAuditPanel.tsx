import { useMemo, useState } from "react";
import { Link2, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { auditAnchors, type AnchorIssueType } from "@/lib/seo-advanced";
import { rowsToTSV } from "@/lib/crawl-api";
import type { CrawlResult } from "@/lib/crawl-api";
import { toast } from "@/hooks/use-toast";

const TONE: Record<AnchorIssueType, string> = {
  "Empty Anchor":         "bg-destructive/15 text-destructive",
  "Image-Only Anchor":    "bg-warning/15 text-warning",
  "Generic Anchor":       "bg-warning/15 text-warning",
  "Repeated Anchor":      "bg-muted/40 text-foreground/80",
  "Over-Optimized Anchor":"bg-destructive/15 text-destructive",
  "Low Diversity":        "bg-warning/15 text-warning",
};

export function AnchorAuditPanel({ results }: { results: CrawlResult[] }) {
  const report = useMemo(() => auditAnchors(results), [results]);
  const [activeType, setActiveType] = useState<"all" | AnchorIssueType>("all");

  const rows = useMemo(() => {
    const r = activeType === "all" ? report.rows : report.rows.filter((row) => row.issueType === activeType);
    return r.slice(0, 500);
  }, [report.rows, activeType]);

  if (report.rows.length === 0) return null;

  const handleCopy = () => {
    const data = rows.map((r) => [r.sourceUrl, r.destUrl, r.anchorText, String(r.repetitionCount), r.issueType]);
    navigator.clipboard.writeText(rowsToTSV(["Source URL", "Destination URL", "Anchor Text", "Repetition", "Issue Type"], data));
    toast({ title: "Copied", description: `${rows.length} anchor issues copied as TSV.` });
  };

  const types: AnchorIssueType[] = [
    "Empty Anchor", "Generic Anchor", "Repeated Anchor",
    "Over-Optimized Anchor", "Low Diversity",
  ];

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center gap-2 flex-wrap">
        <Link2 className="h-3.5 w-3.5 text-warning" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/80">Anchor text audit</span>
        <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal">
          {report.rows.length.toLocaleString()} issues
        </Badge>
        <Button variant="ghost" size="sm" className="h-6 text-[11px] ml-auto" onClick={handleCopy}>
          <Copy className="h-3 w-3 mr-1" />
          Copy report
        </Button>
      </div>

      <div className="flex flex-wrap gap-1 p-2 border-b border-border">
        <Chip label={`All (${report.rows.length})`} active={activeType === "all"} onClick={() => setActiveType("all")} />
        {types.map((t) => report.totals[t] > 0 && (
          <Chip key={t} label={`${t} (${report.totals[t]})`} active={activeType === t} onClick={() => setActiveType(t)} />
        ))}
      </div>

      <ScrollArea className="h-[320px]">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_hsl(var(--border))]">
            <tr>
              <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Source</th>
              <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Destination</th>
              <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Anchor</th>
              <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">×</th>
              <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Issue</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-border hover:bg-muted/30">
                <td className="px-3 py-1.5 max-w-[200px] truncate font-mono">
                  <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">{r.sourceUrl}</a>
                </td>
                <td className="px-3 py-1.5 max-w-[200px] truncate font-mono text-muted-foreground">
                  <a href={r.destUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">{r.destUrl}</a>
                </td>
                <td className="px-3 py-1.5 max-w-[180px] truncate">{r.anchorText}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{r.repetitionCount}</td>
                <td className="px-3 py-1.5">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${TONE[r.issueType]}`}>{r.issueType}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>
      {report.rows.length > 500 && (
        <div className="px-3 py-2 text-[10px] text-muted-foreground border-t border-border">
          Showing 500 of {report.rows.length.toLocaleString()} issues — use copy report for full data.
        </div>
      )}
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
        active ? "bg-foreground text-background" : "bg-muted/60 text-foreground/80 hover:bg-muted"
      }`}
    >
      {label}
    </button>
  );
}
