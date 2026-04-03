import { useState, useMemo, useRef } from "react";
import { CrawlResult, generateCSV, downloadCSV } from "@/lib/crawl-api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Download, Copy, Check, Search, ArrowUpDown, AlertTriangle, FileWarning, Heading1, Image, Code, ClipboardCopy, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// ─── Types ────────────────────────────────────────────────────────────────────
type SortKey = "url" | "title" | "description" | "status";
type SortDir = "asc" | "desc";
type Filter = "all" | "errors" | "missing-title" | "missing-desc" | "title-long" | "multi-h1" | "missing-h1";
type ImageFilter = "all" | "missing-alt" | "no-images" | "has-images";

interface ResultsTableProps {
  results: CrawlResult[];
  domain: string;
  includeTitle: boolean;
  includeDesc: boolean;
  includeH1: boolean;
  includeH2: boolean;
  includeH3: boolean;
  includeImages: boolean;
  includeSchemas: boolean;
}

// ─── Main component ───────────────────────────────────────────────────────────
export function ResultsTable({ results, domain, includeTitle, includeDesc, includeH1, includeH2, includeH3, includeImages, includeSchemas }: ResultsTableProps) {
  const { toast } = useToast();
  const [activeView, setActiveView] = useState<"meta" | "images" | "schemas">("meta");

  if (results.length === 0) return null;

  const hasTabs = includeImages || includeSchemas;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
      {hasTabs ? (
        <Tabs value={activeView} onValueChange={(v) => setActiveView(v as "meta" | "images" | "schemas")}>
          <TabsList className="h-8 bg-muted/50">
            <TabsTrigger value="meta" className="text-xs gap-1.5 h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Search className="h-3 w-3" />
              SEO Metadata
            </TabsTrigger>
            {includeImages && (
              <TabsTrigger value="images" className="text-xs gap-1.5 h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Image className="h-3 w-3" />
                Image Alt Texts
              </TabsTrigger>
            )}
            {includeSchemas && (
              <TabsTrigger value="schemas" className="text-xs gap-1.5 h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Code className="h-3 w-3" />
                Schema Markup
              </TabsTrigger>
            )}
          </TabsList>
          <TabsContent value="meta" className="mt-3">
            <MetaTable results={results} domain={domain} includeTitle={includeTitle} includeDesc={includeDesc} includeH1={includeH1} includeH2={includeH2} includeH3={includeH3} includeImages={false} />
          </TabsContent>
          {includeImages && (
            <TabsContent value="images" className="mt-3">
              <ImagesTable results={results} domain={domain} />
            </TabsContent>
          )}
          {includeSchemas && (
            <TabsContent value="schemas" className="mt-3">
              <SchemasTable results={results} domain={domain} />
            </TabsContent>
          )}
        </Tabs>
      ) : (
        <MetaTable results={results} domain={domain} includeTitle={includeTitle} includeDesc={includeDesc} includeH1={includeH1} includeH2={includeH2} includeH3={includeH3} includeImages={false} />
      )}
    </motion.div>
  );
}

// ─── SEO Metadata table ───────────────────────────────────────────────────────
function MetaTable({
  results,
  domain,
  includeTitle,
  includeDesc,
  includeH1,
  includeH2,
  includeH3,
}: {
  results: CrawlResult[];
  domain: string;
  includeTitle: boolean;
  includeDesc: boolean;
  includeH1: boolean;
  includeH2: boolean;
  includeH3: boolean;
  includeImages: boolean;
}) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [searchMode, setSearchMode] = useState<"includes" | "excludes">("includes");
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
      const matchFn = (r: CrawlResult) =>
        r.url.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        (r.h1s ?? []).some((h) => h.toLowerCase().includes(q));
      data = searchMode === "includes" ? data.filter(matchFn) : data.filter((r) => !matchFn(r));
    }
    data.sort((a, b) => {
      const cmp = String(a[sortKey]).localeCompare(String(b[sortKey]));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return data;
  }, [results, search, searchMode, sortKey, sortDir, filter]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const handleCopy = () => {
    const csv = generateCSV(filtered, includeTitle, includeDesc, includeH1, includeH2, includeH3, false);
    navigator.clipboard.writeText(csv);
    setCopied(true);
    toast({ title: "Copied!", description: `${filtered.length} rows copied as CSV` });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const csv = generateCSV(filtered, includeTitle, includeDesc, includeH1, includeH2, includeH3, false);
    downloadCSV(csv, domain);
    toast({ title: "Downloaded!", description: `CSV file saved` });
  };

  const baseFilters: { key: Filter; label: string; icon?: typeof AlertTriangle }[] = [
    { key: "all", label: "All" },
    { key: "errors", label: "Errors", icon: AlertTriangle },
    ...(includeTitle ? [{ key: "missing-title" as Filter, label: "Missing Title", icon: FileWarning }] : []),
    ...(includeDesc ? [{ key: "missing-desc" as Filter, label: "Missing Desc" }] : []),
    ...(includeTitle ? [{ key: "title-long" as Filter, label: "Title >60ch" }] : []),
  ];
  const h1Filters: { key: Filter; label: string }[] = [
    { key: "missing-h1", label: "No H1" },
    { key: "multi-h1", label: "Multiple H1s" },
  ];
  const filters = [
    ...baseFilters,
    ...(includeH1 ? h1Filters : []),
  ];

  // Build dynamic grid template
  const colTemplate = [
    '1fr',
    ...(includeTitle ? ['1fr'] : []),
    ...(includeDesc ? ['1.4fr'] : []),
    ...(includeH1 ? ['1fr'] : []),
    ...(includeH2 ? ['1fr'] : []),
    ...(includeH3 ? ['1fr'] : []),
    '80px',
  ].join(' ');
  const gridStyle = { gridTemplateColumns: colTemplate };

  return (
    <div className="space-y-3">
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
          <Select value={searchMode} onValueChange={(v) => setSearchMode(v as "includes" | "excludes")}>
            <SelectTrigger className="h-7 w-[110px] text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="includes" className="text-[11px]">Includes</SelectItem>
              <SelectItem value="excludes" className="text-[11px]">Does not include</SelectItem>
            </SelectContent>
          </Select>
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
        <div style={gridStyle} className="grid gap-0 border-b border-border bg-muted/30 text-[11px] font-medium text-muted-foreground">
          <button
            onClick={() => handleSort("url")}
            className="flex items-center gap-1 px-3 py-2 hover:text-foreground transition-colors text-left"
          >
            URL
            <ArrowUpDown className="h-2.5 w-2.5 opacity-50" />
          </button>
          {includeTitle && (
            <button
              onClick={() => handleSort("title")}
              className="flex items-center gap-1 px-3 py-2 hover:text-foreground transition-colors text-left"
            >
              Meta Title
              <ArrowUpDown className="h-2.5 w-2.5 opacity-50" />
            </button>
          )}
          {includeDesc && (
            <button
              onClick={() => handleSort("description")}
              className="flex items-center gap-1 px-3 py-2 hover:text-foreground transition-colors text-left"
            >
              Meta Description
              <ArrowUpDown className="h-2.5 w-2.5 opacity-50" />
            </button>
          )}
          {includeH1 && (
            <div className="flex items-center gap-1 px-3 py-2 text-left">
              <Heading1 className="h-3 w-3" />
              H1 Tags
            </div>
          )}
          {includeH2 && (
            <div className="flex items-center gap-1 px-3 py-2 text-left">
              <Heading1 className="h-3 w-3" />
              H2 Tags
            </div>
          )}
          {includeH3 && (
            <div className="flex items-center gap-1 px-3 py-2 text-left">
              <Heading1 className="h-3 w-3" />
              H3 Tags
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
              const h2s = row.h2s ?? [];
              const h3s = row.h3s ?? [];
              return (
                <div
                  key={index}
                  style={gridStyle}
                  className="grid gap-0 hover:bg-muted/20 transition-colors text-xs"
                >
                  <div className="px-3 py-2 break-all font-mono text-[11px] text-muted-foreground">{row.url}</div>
                  {includeTitle && (
                    <div className="px-3 py-2 break-words text-[11px]">
                      {row.title || <span className="text-muted-foreground italic">(empty)</span>}
                    </div>
                  )}
                  {includeDesc && (
                    <div className="px-3 py-2 break-words text-[11px] text-muted-foreground">
                      {row.description || <span className="italic">(empty)</span>}
                    </div>
                  )}
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
                              }`}>H1</span>
                            )}
                            <span className="break-words leading-snug">{h}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                  {includeH2 && (
                    <div className="px-3 py-2 space-y-0.5">
                      {h2s.length === 0 ? (
                        <span className="text-muted-foreground italic text-[11px]">(none)</span>
                      ) : (
                        h2s.map((h, i) => (
                          <div key={i} className="flex items-start gap-1 text-[11px]">
                            <span className="text-[9px] font-semibold px-1 rounded shrink-0 mt-0.5 bg-muted text-muted-foreground">H2</span>
                            <span className="break-words leading-snug">{h}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                  {includeH3 && (
                    <div className="px-3 py-2 space-y-0.5">
                      {h3s.length === 0 ? (
                        <span className="text-muted-foreground italic text-[11px]">(none)</span>
                      ) : (
                        h3s.map((h, i) => (
                          <div key={i} className="flex items-start gap-1 text-[11px]">
                            <span className="text-[9px] font-semibold px-1 rounded shrink-0 mt-0.5 bg-muted text-muted-foreground">H3</span>
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
    </div>
  );
}

// ─── Image Alt Texts table ────────────────────────────────────────────────────
function ImagesTable({ results, domain }: { results: CrawlResult[]; domain: string }) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [searchMode, setSearchMode] = useState<"includes" | "excludes">("includes");
  const [imgFilter, setImgFilter] = useState<ImageFilter>("all");
  const [copied, setCopied] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const filteredResults = useMemo(() => {
    let data = results.filter((r) => r.status === "OK");
    if (imgFilter === "missing-alt") data = data.filter((r) => (r.images ?? []).some((img) => img.alt === null));
    else if (imgFilter === "no-images") data = data.filter((r) => (r.images ?? []).length === 0);
    else if (imgFilter === "has-images") data = data.filter((r) => (r.images ?? []).length > 0);
    if (search) {
      const q = search.toLowerCase();
      const matchFn = (r: CrawlResult) =>
        r.url.toLowerCase().includes(q) ||
        (r.images ?? []).some(
          (img) => img.src.toLowerCase().includes(q) || (img.alt ?? "").toLowerCase().includes(q)
        );
      data = searchMode === "includes" ? data.filter(matchFn) : data.filter((r) => !matchFn(r));
    }
    return data;
  }, [results, imgFilter, search, searchMode]);

  const toggleRow = (i: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const handleCopy = () => {
    const csv = generateCSV(results, false, false, false, false, false, true);
    navigator.clipboard.writeText(csv);
    setCopied(true);
    toast({ title: "Copied!", description: "Image alt text data copied as CSV" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const csv = generateCSV(results, false, false, false, false, false, true);
    downloadCSV(csv, `${domain}-images`);
    toast({ title: "Downloaded!", description: "Image alt text CSV saved" });
  };

  const imgFilters: { key: ImageFilter; label: string }[] = [
    { key: "all", label: "All Pages" },
    { key: "has-images", label: "Has Images" },
    { key: "missing-alt", label: "Missing Alt" },
    { key: "no-images", label: "No Images" },
  ];

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
        <div className="flex gap-1.5 flex-wrap">
          {imgFilters.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={imgFilter === f.key ? "default" : "outline"}
              onClick={() => setImgFilter(f.key)}
              className="text-[11px] h-7 px-2.5"
            >
              {f.label}
            </Button>
          ))}
        </div>
        <div className="flex gap-1.5 items-center w-full sm:w-auto">
          <Select value={searchMode} onValueChange={(v) => setSearchMode(v as "includes" | "excludes")}>
            <SelectTrigger className="h-7 w-[110px] text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="includes" className="text-[11px]">Includes</SelectItem>
              <SelectItem value="excludes" className="text-[11px]">Does not include</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative flex-1 sm:w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              placeholder="Filter URL, src, alt..."
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

      <p className="text-[11px] text-muted-foreground">{filteredResults.length} pages</p>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden bg-card">
        {/* Header */}
        <div className="grid grid-cols-[2fr_80px_1fr] gap-0 border-b border-border bg-muted/30 text-[11px] font-medium text-muted-foreground">
          <div className="px-3 py-2">Page URL</div>
          <div className="px-3 py-2 text-center">Images</div>
          <div className="px-3 py-2">Coverage</div>
        </div>

        {/* Rows */}
        <div className="overflow-auto max-h-[600px] divide-y divide-border">
          {filteredResults.length === 0 ? (
            <div className="px-3 py-6 text-center text-[11px] text-muted-foreground">No results</div>
          ) : (
            filteredResults.map((row, index) => {
              const images = row.images ?? [];
              const withAlt = images.filter((img) => img.alt !== null).length;
              const withoutAlt = images.length - withAlt;
              const isExpanded = expandedRows.has(index);

              return (
                <div key={index}>
                  {/* Summary row — click to expand */}
                  <button
                    className="w-full grid grid-cols-[2fr_80px_1fr] gap-0 hover:bg-muted/20 transition-colors text-left"
                    onClick={() => toggleRow(index)}
                  >
                    <div className="px-3 py-2 font-mono text-[11px] text-muted-foreground break-all">{row.url}</div>
                    <div className="px-3 py-2 text-center text-[11px] font-medium">
                      {images.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span>{images.length}</span>
                      )}
                    </div>
                    <div className="px-3 py-2 text-[11px]">
                      {images.length === 0 ? (
                        <span className="text-muted-foreground italic">No images</span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          {withAlt > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-success">
                              <Check className="h-2.5 w-2.5" />
                              {withAlt} with alt
                            </span>
                          )}
                          {withoutAlt > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-destructive">
                              <AlertTriangle className="h-2.5 w-2.5" />
                              {withoutAlt} missing
                            </span>
                          )}
                          <span className="text-muted-foreground ml-auto text-[10px]">
                            {isExpanded ? "▲" : "▼"}
                          </span>
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Expanded image list */}
                  {isExpanded && images.length > 0 && (
                    <div className="bg-muted/10 border-t border-border divide-y divide-border/50">
                      {/* Sub-header */}
                      <div className="grid grid-cols-[2fr_1fr] gap-0 px-6 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                        <div>Image URL</div>
                        <div>Alt Text</div>
                      </div>
                      {images.map((img, imgIndex) => (
                        <div
                          key={imgIndex}
                          className="grid grid-cols-[2fr_1fr] gap-0 px-6 py-1.5 hover:bg-muted/20 transition-colors"
                        >
                          <div className="font-mono text-[11px] text-muted-foreground break-all pr-3 truncate" title={img.src}>
                            {img.src}
                          </div>
                          <div className="text-[11px] break-words">
                            {img.alt ? (
                              <span className="text-foreground">{img.alt}</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-destructive/70">
                                <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
                                No alt text
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Schema Markup table ──────────────────────────────────────────────────────
function SchemasTable({ results, domain }: { results: CrawlResult[]; domain: string }) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [schemaFilter, setSchemaFilter] = useState<"all" | "has-schema" | "no-schema">("all");
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredResults = useMemo(() => {
    let data = results.filter((r) => r.status === "OK");
    if (schemaFilter === "has-schema") data = data.filter((r) => (r.schemas ?? []).length > 0);
    else if (schemaFilter === "no-schema") data = data.filter((r) => (r.schemas ?? []).length === 0);
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (r) =>
          r.url.toLowerCase().includes(q) ||
          (r.schemas ?? []).some((s) => s.toLowerCase().includes(q))
      );
    }
    return data;
  }, [results, schemaFilter, search]);

  const toggleRow = (i: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const handleCopySchema = (schema: string, id: string) => {
    navigator.clipboard.writeText(schema);
    setCopiedId(id);
    toast({ title: "Copied!", description: "JSON-LD schema copied to clipboard" });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownload = () => {
    const rows: string[] = ["Page URL,Schema Count,JSON-LD"];
    const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
    results.forEach((r) => {
      const schemas = r.schemas ?? [];
      if (schemas.length === 0) {
        rows.push(`${escape(r.url)},0,${escape("No schema found")}`);
      } else {
        schemas.forEach((s) => {
          rows.push(`${escape(r.url)},${schemas.length},${escape(s)}`);
        });
      }
    });
    const csv = rows.join("\n");
    downloadCSV(csv, `${domain}-schemas`);
    toast({ title: "Downloaded!", description: "Schema markup CSV saved" });
  };

  const filters: { key: "all" | "has-schema" | "no-schema"; label: string }[] = [
    { key: "all", label: "All Pages" },
    { key: "has-schema", label: "Has Schema" },
    { key: "no-schema", label: "No Schema" },
  ];

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
        <div className="flex gap-1.5 flex-wrap">
          {filters.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={schemaFilter === f.key ? "default" : "outline"}
              onClick={() => setSchemaFilter(f.key)}
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
              placeholder="Filter URL or schema content..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-7 h-7 text-[11px]"
            />
          </div>
          <Button size="sm" variant="outline" onClick={handleDownload} className="h-7 gap-1 text-[11px] px-2.5">
            <Download className="h-3 w-3" />
            CSV
          </Button>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">{filteredResults.length} pages</p>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden bg-card">
        {/* Header */}
        <div className="grid grid-cols-[2fr_100px_1fr] gap-0 border-b border-border bg-muted/30 text-[11px] font-medium text-muted-foreground">
          <div className="px-3 py-2">Page URL</div>
          <div className="px-3 py-2 text-center">Schemas</div>
          <div className="px-3 py-2">Type</div>
        </div>

        {/* Rows */}
        <div className="overflow-auto max-h-[600px] divide-y divide-border">
          {filteredResults.length === 0 ? (
            <div className="px-3 py-6 text-center text-[11px] text-muted-foreground">No results</div>
          ) : (
            filteredResults.map((row, index) => {
              const schemas = row.schemas ?? [];
              const isExpanded = expandedRows.has(index);

              // Try to extract @type from each schema
              const types = schemas.map((s) => {
                try {
                  const parsed = JSON.parse(s);
                  return parsed["@type"] || "Unknown";
                } catch {
                  return "Invalid JSON";
                }
              });

              return (
                <div key={index}>
                  <button
                    className="w-full grid grid-cols-[2fr_100px_1fr] gap-0 hover:bg-muted/20 transition-colors text-left"
                    onClick={() => schemas.length > 0 && toggleRow(index)}
                  >
                    <div className="px-3 py-2 font-mono text-[11px] text-muted-foreground break-all">{row.url}</div>
                    <div className="px-3 py-2 text-center text-[11px] font-medium">
                      {schemas.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span>{schemas.length}</span>
                      )}
                    </div>
                    <div className="px-3 py-2 text-[11px]">
                      {schemas.length === 0 ? (
                        <span className="text-muted-foreground italic">No schema markup</span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <span className="flex gap-1 flex-wrap">
                            {types.map((t, i) => (
                              <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium">
                                {Array.isArray(t) ? t.join(", ") : t}
                              </span>
                            ))}
                          </span>
                          <span className="text-muted-foreground ml-auto text-[10px]">
                            {isExpanded ? "▲" : "▼"}
                          </span>
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Expanded schema list */}
                  {isExpanded && schemas.length > 0 && (
                    <div className="bg-muted/10 border-t border-border divide-y divide-border/50">
                      {schemas.map((schema, sIdx) => {
                        const copyId = `${index}-${sIdx}`;
                        const isCopied = copiedId === copyId;
                        return (
                          <div key={sIdx} className="px-6 py-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                                JSON-LD #{sIdx + 1} — {types[sIdx]}
                              </span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopySchema(schema, copyId);
                                }}
                                className="h-6 gap-1 text-[10px] px-2"
                              >
                                {isCopied ? <Check className="h-2.5 w-2.5" /> : <ClipboardCopy className="h-2.5 w-2.5" />}
                                {isCopied ? "Copied" : "Copy JSON"}
                              </Button>
                            </div>
                            <pre className="text-[11px] font-mono bg-muted/30 border border-border rounded-md p-3 overflow-x-auto max-h-64 overflow-y-auto whitespace-pre text-foreground/80 leading-relaxed">
                              {schema}
                            </pre>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
