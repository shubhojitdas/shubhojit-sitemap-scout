import { useMemo, useState } from "react";
import { Link2, Filter, Copy, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { auditLinks, type AuditedLink } from "@/lib/link-analysis";
import { rowsToTSV } from "@/lib/crawl-api";
import type { CrawlResult } from "@/lib/crawl-api";
import { toast } from "@/hooks/use-toast";

interface Props {
  results: CrawlResult[];
}

type FilterKey = "all" | "external" | "missing-rel" | "nofollow" | "sponsored" | "ugc";

const STATUS_TONE: Record<AuditedLink["status"], string> = {
  Followed:  "bg-success/10 text-success",
  Nofollow:  "bg-muted/40 text-muted-foreground",
  Sponsored: "bg-warning/10 text-warning",
  UGC:       "bg-warning/10 text-warning",
  "No rel":  "bg-muted/40 text-muted-foreground",
};

/**
 * Outbound link attribute auditor — surfaces nofollow/sponsored/ugc usage
 * and flags external links missing recommended rel attributes.
 */
export function LinkAttributesPanel({ results }: Props) {
  const all = useMemo(() => auditLinks(results), [results]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");

  const counts = useMemo(() => {
    let external = 0, missing = 0, nf = 0, sp = 0, ugc = 0;
    for (const l of all) {
      if (!l.isInternal) external++;
      if (l.missingRecommendedRel) missing++;
      if (l.nofollow) nf++;
      if (l.sponsored) sp++;
      if (l.ugc) ugc++;
    }
    return { total: all.length, external, missing, nf, sp, ugc };
  }, [all]);

  const filtered = useMemo(() => {
    let list = all;
    if (filter === "external") list = list.filter((l) => !l.isInternal);
    if (filter === "missing-rel") list = list.filter((l) => l.missingRecommendedRel);
    if (filter === "nofollow") list = list.filter((l) => l.nofollow);
    if (filter === "sponsored") list = list.filter((l) => l.sponsored);
    if (filter === "ugc") list = list.filter((l) => l.ugc);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (l) => l.href.toLowerCase().includes(q) ||
               l.anchorText.toLowerCase().includes(q) ||
               l.pageUrl.toLowerCase().includes(q)
      );
    }
    return list.slice(0, 1000);
  }, [all, filter, search]);

  const handleCopy = () => {
    const rows = filtered.map((l) => [
      l.pageUrl, l.href, l.anchorText, l.isInternal ? "Internal" : "External",
      l.status, l.rel || "—",
    ]);
    navigator.clipboard.writeText(rowsToTSV(
      ["Page URL", "Link URL", "Anchor", "Type", "Status", "Rel"],
      rows
    ));
    toast({ title: "Copied", description: `${rows.length} links copied as TSV.` });
  };

  if (all.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-3 flex items-center gap-2">
        <Link2 className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          No outbound links collected. Enable "Internal Links" extraction to use the auditor.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center gap-2 flex-wrap">
        <Link2 className="h-3.5 w-3.5 text-warning" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/80">
          Link attribute auditor
        </span>
        <Button variant="ghost" size="sm" className="h-6 text-[11px] ml-auto" onClick={handleCopy}>
          <Copy className="h-3 w-3 mr-1" />
          Copy {filtered.length}
        </Button>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 p-3">
        {[
          { k: "all" as FilterKey, label: "All", value: counts.total },
          { k: "external" as FilterKey, label: "External", value: counts.external },
          { k: "missing-rel" as FilterKey, label: "Missing rel", value: counts.missing, tone: "text-warning" },
          { k: "nofollow" as FilterKey, label: "nofollow", value: counts.nf },
          { k: "sponsored" as FilterKey, label: "sponsored", value: counts.sp },
          { k: "ugc" as FilterKey, label: "ugc", value: counts.ugc },
        ].map((s) => (
          <button
            key={s.k}
            onClick={() => setFilter(s.k)}
            className={`text-left rounded-md border p-2 transition-all ${
              filter === s.k ? "border-foreground/40 bg-card shadow-sm" : "border-border bg-card hover:border-foreground/20"
            }`}
          >
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
            <div className={`text-base font-semibold tabular-nums ${s.tone ?? ""}`}>
              {s.value.toLocaleString()}
            </div>
          </button>
        ))}
      </div>

      <div className="px-3 pb-3">
        <div className="relative">
          <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by URL, anchor, or page…"
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      <ScrollArea className="h-[320px] border-t border-border">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_hsl(var(--border))]">
            <tr>
              <th className="text-left px-3 py-1.5 font-medium text-muted-foreground bg-card">Source page</th>
              <th className="text-left px-3 py-1.5 font-medium text-muted-foreground bg-card">Link</th>
              <th className="text-left px-3 py-1.5 font-medium text-muted-foreground bg-card">Anchor</th>
              <th className="text-left px-3 py-1.5 font-medium text-muted-foreground bg-card">Type</th>
              <th className="text-left px-3 py-1.5 font-medium text-muted-foreground bg-card">Status</th>
              <th className="text-left px-3 py-1.5 font-medium text-muted-foreground bg-card">Rel</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l, i) => (
              <tr key={i} className="border-t border-border hover:bg-muted/30">
                <td className="px-3 py-1.5 max-w-[180px] truncate font-mono">
                  <a href={l.pageUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">{l.pageUrl}</a>
                </td>
                <td className="px-3 py-1.5 max-w-[180px] truncate font-mono">
                  <a href={l.href} target="_blank" rel="noopener noreferrer" className="hover:underline inline-flex items-center gap-1">
                    <ExternalLink className="h-3 w-3 opacity-60" />
                    {l.href}
                  </a>
                </td>
                <td className="px-3 py-1.5 max-w-[160px] truncate">{l.anchorText || <span className="text-muted-foreground">—</span>}</td>
                <td className="px-3 py-1.5">
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal">
                    {l.isInternal ? "Internal" : "External"}
                  </Badge>
                </td>
                <td className="px-3 py-1.5">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${STATUS_TONE[l.status]}`}>
                    {l.status}
                  </span>
                  {l.missingRecommendedRel && (
                    <span className="ml-1 inline-block px-1.5 py-0.5 rounded text-[10px] bg-warning/10 text-warning">
                      Review
                    </span>
                  )}
                </td>
                <td className="px-3 py-1.5 font-mono text-muted-foreground max-w-[120px] truncate">
                  {l.rel || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>
      {all.length > 1000 && (
        <div className="px-3 py-2 text-[10px] text-muted-foreground border-t border-border">
          Showing first 1,000 of {all.length.toLocaleString()} links — use the filters above to narrow the view.
        </div>
      )}
    </div>
  );
}
