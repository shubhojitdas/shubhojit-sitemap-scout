import { useMemo, useState } from "react";
import { Copy, Files, ChevronDown, ExternalLink, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { findDuplicateGroups, FIELD_LABEL, type DupField } from "@/lib/duplicates";
import { rowsToTSV } from "@/lib/crawl-api";
import type { CrawlResult } from "@/lib/crawl-api";
import { toast } from "@/hooks/use-toast";

interface Props {
  results: CrawlResult[];
  field: DupField;
}

/**
 * Compact duplicate / near-duplicate detector for Title / Description / H1
 * sections. Sits below the SectionVisualization pie chart.
 */
export function DuplicatesPanel({ results, field }: Props) {
  const groups = useMemo(() => findDuplicateGroups(results, field), [results, field]);
  const exact = groups.filter((g) => g.kind === "exact");
  const near = groups.filter((g) => g.kind === "near");

  const totalAffected = groups.reduce((s, g) => s + g.urls.length, 0);

  if (groups.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-3 flex items-center gap-2">
        <Files className="h-4 w-4 text-success flex-shrink-0" />
        <p className="text-xs text-muted-foreground">
          No duplicate or near-duplicate {FIELD_LABEL[field]}s detected.
        </p>
      </div>
    );
  }

  const handleCopyAll = () => {
    const rows = groups.flatMap((g) =>
      g.urls.map((u) => [g.kind, FIELD_LABEL[field], g.value, u, String(g.urls.length)])
    );
    const tsv = rowsToTSV(["Type", "Field", "Value", "URL", "Group Size"], rows);
    navigator.clipboard.writeText(tsv);
    toast({ title: "Copied", description: "Duplicate report copied as TSV." });
  };

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center gap-2 flex-wrap">
        <Files className="h-3.5 w-3.5 text-warning" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/80">
          Duplicate {FIELD_LABEL[field]} detection
        </span>
        <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal">
          {exact.length} exact
        </Badge>
        <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal">
          {near.length} near
        </Badge>
        <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal">
          {totalAffected} URLs
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[11px] ml-auto"
          onClick={handleCopyAll}
        >
          <Copy className="h-3 w-3 mr-1" />
          Copy report
        </Button>
      </div>
      <div className="divide-y divide-border">
        {groups.slice(0, 50).map((g, idx) => (
          <DupRow key={`${g.kind}-${idx}`} group={g} />
        ))}
        {groups.length > 50 && (
          <div className="px-3 py-2 text-[11px] text-muted-foreground">
            Showing top 50 groups by size. Copy the report to see all {groups.length}.
          </div>
        )}
      </div>
    </div>
  );
}

function DupRow({ group }: { group: ReturnType<typeof findDuplicateGroups>[number] }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex-shrink-0 h-7 w-7 rounded-md flex items-center justify-center bg-warning/10 ring-1 ring-warning/30">
          <AlertTriangle className="h-3.5 w-3.5 text-warning" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <Badge className={`text-[10px] h-4 px-1.5 font-normal border-transparent ${
              group.kind === "exact" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"
            }`}>
              {group.kind === "exact" ? "Exact" : "Near"}
            </Badge>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {group.urls.length} URLs
            </span>
          </div>
          <p className="text-xs leading-snug font-mono truncate text-foreground/85">
            “{group.value}”
          </p>
        </div>
        <ChevronDown className={`flex-shrink-0 h-3.5 w-3.5 text-muted-foreground transition-transform mt-1 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 bg-muted/20">
          <ScrollArea className={group.urls.length > 8 ? "h-[180px]" : "max-h-none"}>
            <ul className="space-y-1">
              {group.urls.map((u) => (
                <li key={u}>
                  <a href={u} target="_blank" rel="noopener noreferrer"
                    className="group flex items-center gap-1.5 text-[11px] text-foreground/80 hover:text-foreground hover:underline truncate">
                    <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-60 group-hover:opacity-100" />
                    <span className="truncate font-mono">{u}</span>
                  </a>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
