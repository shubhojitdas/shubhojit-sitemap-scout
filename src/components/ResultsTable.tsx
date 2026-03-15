import { useState, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { CrawlResult, generateCSV, downloadCSV } from "@/lib/crawl-api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Download, Copy, Check, Search, ArrowUpDown, AlertTriangle, FileWarning, Heading1 } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

type SortKey = "url" | "title" | "description" | "status";
type SortDir = "asc" | "desc";
type Filter = "all" | "errors" | "missing-title" | "missing-desc" | "title-long" | "multi-h1" | "missing-h1";

interface ResultsTableProps {
  results: CrawlResult[];
  domain: string;
  includeH1: boolean;
}

export function ResultsTable({ results, domain, includeH1 }: ResultsTableProps) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("url");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filter, setFilter] = useState<Filter>("all");
  const [copied, setCopied] = useState(false);
  const parentRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    let data = [...results];

    if (filter === "errors") data = data.filter((r) => r.status === "Error");
    else if (filter === "missing-title") data = data.filter((r) => !r.title);
    else if (filter === "missing-desc") data = data.filter((r) => !r.description);
    else if (filter === "title-long") data = data.filter((r) => r.title.length > 60);
    else if (filter === "multi-h1") data = data.filter((r) => (r.h1s ?? []).length > 1);
    else if (filter === "missing-h1") data = data.filter((r) => (r.h1s ?? []).length === 0);

    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (r) =>
          r.url.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          (r.h1s ?? []).some((h) => h.toLowerCase().includes(q))
      );
    }

    data.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDir === "asc" ? cmp : -cmp;
    });

    return data;
  }, [results, search, sortKey, sortDir, filter]);

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => includeH1 ? 72 : 56,
    overscan: 20,
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const handleCopy = () => {
    const csv = generateCSV(filtered, includeH1);
    navigator.clipboard.writeText(csv);
    setCopied(true);
    toast({ title: "Copied!", description: `${filtered.length} rows copied as CSV` });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const csv = generateCSV(filtered, includeH1);
    downloadCSV(csv, domain);
    toast({ title: "Downloaded!", description: `CSV file saved` });
  };

  if (results.length === 0) return null;

  const baseFilters: { key: Filter; label: string; icon?: typeof AlertTriangle }[] = [
    { key: "all", label: "All" },
    { key: "errors", label: "Errors", icon: AlertTriangle },
    { key: "missing-title", label: "Missing Title", icon: FileWarning },
    { key: "missing-desc", label: "Missing Desc" },
    { key: "title-long", label: "Title >60ch" },
  ];

  const h1Filters: { key: Filter; label: string }[] = [
    { key: "missing-h1", label: "No H1" },
    { key: "multi-h1", label: "Multiple H1s" },
  ];

  const filters = includeH1 ? [...baseFilters, ...h1Filters] : baseFilters;

  const gridCols = includeH1
    ? "grid-cols-[1fr_1fr_1.4fr_1.2fr_80px]"
    : "grid-cols-[1.2fr_1.2fr_1.6fr_80px]";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
        <div className="flex gap-1.5 flex-wrap">
          {filters.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={filter === f.key ? "default" : "outline"}
              onClick={() => setFilter(f.key)}
              className="text-[11px] h-7 px-2.5"
            >
              {f.label}
            </Button>
          ))}
        </div>
        <div className="flex gap-1.5 items-center w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              placeholder="Filter..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-7 h-7 text-[11px]"
            />
          </div>
          <Button size="sm" variant="outline" onClick={handleCopy} className="h-7 gap-1 text-[11px] px-2.5">
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            Copy
          </Button>
          <Button size="sm" variant="outline" onClick={handleDownload} className="h-7 gap-1 text-[11px] px-2.5">
            <Download className="h-3 w-3" />
            CSV
          </Button>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">{filtered.length} results</p>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden bg-card">
        {/* Header */}
        <div className={`grid ${gridCols} gap-0 border-b border-border bg-muted/30 text-[11px] font-medium text-muted-foreground`}>
          {(["url", "title", "description"] as SortKey[]).map((key) => (
            <button
              key={key}
              onClick={() => handleSort(key)}
              className="flex items-center gap-1 px-3 py-2 hover:text-foreground transition-colors text-left"
            >
              {key === "description" ? "Meta Description" : key === "title" ? "Meta Title" : "URL"}
              <ArrowUpDown className="h-2.5 w-2.5 opacity-50" />
            </button>
          ))}
          {includeH1 && (
            <div className="flex items-center gap-1 px-3 py-2 text-left">
              <Heading1 className="h-3 w-3" />
              H1 Tags
            </div>
          )}
          <button
            onClick={() => handleSort("status")}
            className="flex items-center gap-1 px-3 py-2 hover:text-foreground transition-colors text-left"
          >
            Status
            <ArrowUpDown className="h-2.5 w-2.5 opacity-50" />
          </button>
        </div>

        {/* Rows */}
        <div ref={parentRef} className="overflow-auto max-h-[600px]">
          <div className="divide-y divide-border">
            {filtered.map((row, index) => {
              const h1s = row.h1s ?? [];
              return (
                <div
                  key={index}
                  className={`grid ${gridCols} gap-0 hover:bg-muted/20 transition-colors text-xs`}
                >
                  <div className="px-3 py-2 break-all font-mono text-[11px] text-muted-foreground">
                    {row.url}
                  </div>
                  <div className="px-3 py-2 break-words text-[11px]">
                    {row.title || <span className="text-muted-foreground italic">(empty)</span>}
                  </div>
                  <div className="px-3 py-2 break-words text-[11px] text-muted-foreground">
                    {row.description || <span className="italic">(empty)</span>}
                  </div>
                  {includeH1 && (
                    <div className="px-3 py-2 space-y-0.5">
                      {h1s.length === 0 ? (
                        <span className="text-muted-foreground italic text-[11px]">(none)</span>
                      ) : (
                        h1s.map((h, i) => (
                          <div key={i} className="flex items-start gap-1 text-[11px]">
                            {h1s.length > 1 && (
                              <span className={`text-[9px] font-semibold px-1 rounded shrink-0 mt-0.5 ${
                                i === 0 ? "bg-warning/15 text-warning" : "bg-destructive/15 text-destructive"
                              }`}>
                                H1
                              </span>
                            )}
                            <span className="break-words leading-snug">{h}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                  <div className="px-3 py-2 flex items-start text-[11px]">
                    {row.status === "OK" ? (
                      <span className="text-success font-medium">OK</span>
                    ) : (
                      <span className="text-destructive font-medium">Err</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
