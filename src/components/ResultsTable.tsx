import { useState, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { CrawlResult, generateCSV, downloadCSV } from "@/lib/crawl-api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Download, Copy, Check, Search, ArrowUpDown, AlertTriangle, FileWarning } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

type SortKey = "url" | "title" | "description" | "status";
type SortDir = "asc" | "desc";
type Filter = "all" | "errors" | "missing-title" | "missing-desc" | "title-long";

interface ResultsTableProps {
  results: CrawlResult[];
  domain: string;
}

export function ResultsTable({ results, domain }: ResultsTableProps) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("url");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filter, setFilter] = useState<Filter>("all");
  const [copied, setCopied] = useState(false);
  const parentRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    let data = [...results];

    // Filter
    if (filter === "errors") data = data.filter((r) => r.status === "Error");
    else if (filter === "missing-title") data = data.filter((r) => !r.title);
    else if (filter === "missing-desc") data = data.filter((r) => !r.description);
    else if (filter === "title-long") data = data.filter((r) => r.title.length > 60);

    // Search
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (r) =>
          r.url.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q)
      );
    }

    // Sort
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
    estimateSize: () => 56,
    overscan: 20,
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const handleCopy = () => {
    const csv = generateCSV(filtered);
    navigator.clipboard.writeText(csv);
    setCopied(true);
    toast({ title: "Copied!", description: `${filtered.length} rows copied as CSV` });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const csv = generateCSV(filtered);
    downloadCSV(csv, domain);
    toast({ title: "Downloaded!", description: `CSV file saved` });
  };

  if (results.length === 0) return null;

  const filters: { key: Filter; label: string; icon?: typeof AlertTriangle }[] = [
    { key: "all", label: "All" },
    { key: "errors", label: "Errors", icon: AlertTriangle },
    { key: "missing-title", label: "Missing Title", icon: FileWarning },
    { key: "missing-desc", label: "Missing Desc" },
    { key: "title-long", label: "Title >60ch" },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {filters.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={filter === f.key ? "default" : "outline"}
              onClick={() => setFilter(f.key)}
              className="text-xs h-8"
            >
              {f.label}
            </Button>
          ))}
        </div>
        <div className="flex gap-2 items-center w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Filter URLs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-8 text-xs"
            />
          </div>
          <Button size="sm" variant="outline" onClick={handleCopy} className="h-8 gap-1.5 text-xs">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            Copy CSV
          </Button>
          <Button size="sm" variant="outline" onClick={handleDownload} className="h-8 gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" />
            Download
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} results shown</p>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden bg-card">
        {/* Header */}
        <div className="grid grid-cols-[1fr_1fr_1.2fr_80px] gap-0 border-b bg-muted/50 text-xs font-semibold text-muted-foreground">
          {(["url", "title", "description", "status"] as SortKey[]).map((key) => (
            <button
              key={key}
              onClick={() => handleSort(key)}
              className="flex items-center gap-1 px-3 py-2.5 hover:text-foreground transition-colors text-left capitalize"
            >
              {key === "description" ? "Meta Description" : key === "title" ? "Meta Title" : key.toUpperCase()}
              <ArrowUpDown className="h-3 w-3" />
            </button>
          ))}
        </div>

        {/* Virtual rows */}
        <div ref={parentRef} className="overflow-auto max-h-[600px]">
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = filtered[virtualRow.index];
              return (
                <div
                  key={virtualRow.key}
                  className="grid grid-cols-[1fr_1fr_1.2fr_80px] gap-0 border-b border-border/40 hover:bg-muted/30 transition-colors text-xs"
                  style={{
                    position: "absolute",
                    top: virtualRow.start,
                    height: virtualRow.size,
                    width: "100%",
                  }}
                >
                  <div className="px-3 py-2 truncate font-mono text-primary/80" title={row.url}>
                    {row.url}
                  </div>
                  <div className="px-3 py-2 truncate" title={row.title}>
                    {row.title || <span className="text-muted-foreground italic">(empty)</span>}
                  </div>
                  <div className="px-3 py-2 truncate text-muted-foreground" title={row.description}>
                    {row.description || <span className="italic">(empty)</span>}
                  </div>
                  <div className="px-3 py-2 flex items-center">
                    {row.status === "OK" ? (
                      <span className="text-success font-medium">✅ OK</span>
                    ) : (
                      <span className="text-destructive font-medium">❌ Err</span>
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
