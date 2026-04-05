import { useState, useMemo, useRef } from "react";
import { CrawlResult, generateCSV, downloadCSV } from "@/lib/crawl-api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Download, Copy, Check, Search, ArrowUpDown, AlertTriangle, FileWarning, Heading1, Image, Code, ClipboardCopy, Bot, Settings2 } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AdvancedSearchDialog, AdvancedFilter, createEmptyFilter, isFilterActive, applyAdvancedFilter } from "@/components/AdvancedSearchDialog";

// Helper to extract @type from parsed JSON-LD, handling @graph, arrays, and nested structures
function extractSchemaTypes(obj: unknown): string {
  if (!obj || typeof obj !== 'object') return 'Schema';
  const o = obj as Record<string, unknown>;
  if (o['@type']) {
    const t = o['@type'];
    return Array.isArray(t) ? t.join(', ') : String(t);
  }
  if (Array.isArray(o['@graph'])) {
    const types = (o['@graph'] as Record<string, unknown>[])
      .map(item => item?.['@type']).filter(Boolean)
      .map(t => Array.isArray(t) ? t.join(', ') : String(t));
    return types.length > 0 ? types.join(' + ') : 'Schema';
  }
  if (Array.isArray(obj)) {
    const types = (obj as Record<string, unknown>[])
      .map(item => item?.['@type']).filter(Boolean)
      .map(t => Array.isArray(t) ? t.join(', ') : String(t));
    return types.length > 0 ? types.join(' + ') : 'Schema';
  }
  return 'Schema';
}

type SortKey = "url" | "title" | "description" | "status";
type SortDir = "asc" | "desc";
type Filter = "all" | "errors" | "missing-title" | "missing-desc" | "title-long" | "multi-h1" | "missing-h1" | "has-robots" | "no-robots" | "noindex" | "nofollow";
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
  includeRobots: boolean;
}

// ─── Search bar with gear icon ────────────────────────────────────────────────
function SearchBarWithGear({
  search,
  setSearch,
  placeholder,
  fields,
  advancedFilter,
  setAdvancedFilter,
}: {
  search: string;
  setSearch: (v: string) => void;
  placeholder: string;
  fields: { key: string; label: string }[];
  advancedFilter: AdvancedFilter;
  setAdvancedFilter: (f: AdvancedFilter) => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const active = isFilterActive(advancedFilter);

  return (
    <>
      <div className="relative flex-1 sm:w-56">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
        <Input
          placeholder={active ? "Advanced filter active..." : placeholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={active}
          className="pl-7 pr-8 h-7 text-[11px]"
        />
        <button
          onClick={() => setDialogOpen(true)}
          className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}
          title="Advanced Search"
        >
          <Settings2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <AdvancedSearchDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        fields={fields}
        filter={advancedFilter}
        onApply={setAdvancedFilter}
        onReset={() => setAdvancedFilter(createEmptyFilter(fields[0].key))}
      />
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function ResultsTable({ results, domain, includeTitle, includeDesc, includeH1, includeH2, includeH3, includeImages, includeSchemas, includeRobots }: ResultsTableProps) {
  const [activeView, setActiveView] = useState<"meta" | "images" | "schemas">("meta");

  // Lift filter state so it persists across tab switches
  const [metaFilter, setMetaFilter] = useState<Filter>("all");
  const [metaSearch, setMetaSearch] = useState("");
  const [metaAdvancedFilter, setMetaAdvancedFilter] = useState<AdvancedFilter>(() => createEmptyFilter("url"));
  const [metaSortKey, setMetaSortKey] = useState<SortKey>("url");
  const [metaSortDir, setMetaSortDir] = useState<SortDir>("asc");

  const [imgFilter, setImgFilter] = useState<ImageFilter>("all");
  const [imgSearch, setImgSearch] = useState("");
  const [imgAdvancedFilter, setImgAdvancedFilter] = useState<AdvancedFilter>(() => createEmptyFilter("url"));

  if (results.length === 0) return null;

  const hasTabs = includeImages || includeSchemas;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
      {hasTabs ? (
        <Tabs value={activeView} onValueChange={(v) => setActiveView(v as "meta" | "images" | "schemas")}>
          <TabsList className="h-9 bg-muted p-1 rounded-lg border border-border">
            <TabsTrigger value="meta" className="text-xs gap-1.5 h-7 px-4 rounded-md font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
              <Search className="h-3 w-3" />
              SEO Metadata
            </TabsTrigger>
            {includeImages && (
              <TabsTrigger value="images" className="text-xs gap-1.5 h-7 px-4 rounded-md font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
                <Image className="h-3 w-3" />
                Image Alt Texts
              </TabsTrigger>
            )}
            {includeSchemas && (
              <TabsTrigger value="schemas" className="text-xs gap-1.5 h-7 px-4 rounded-md font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
                <Code className="h-3 w-3" />
                Schema Markup
              </TabsTrigger>
            )}
          </TabsList>
          <TabsContent value="meta" className="mt-4">
            <MetaTable results={results} domain={domain} includeTitle={includeTitle} includeDesc={includeDesc} includeH1={includeH1} includeH2={includeH2} includeH3={includeH3} includeImages={false} includeRobots={includeRobots}
              filter={metaFilter} setFilter={setMetaFilter}
              search={metaSearch} setSearch={setMetaSearch}
              advancedFilter={metaAdvancedFilter} setAdvancedFilter={setMetaAdvancedFilter}
              sortKey={metaSortKey} setSortKey={setMetaSortKey}
              sortDir={metaSortDir} setSortDir={setMetaSortDir}
            />
          </TabsContent>
          {includeImages && (
            <TabsContent value="images" className="mt-4">
              <ImagesTable results={results} domain={domain}
                imgFilter={imgFilter} setImgFilter={setImgFilter}
                search={imgSearch} setSearch={setImgSearch}
                advancedFilter={imgAdvancedFilter} setAdvancedFilter={setImgAdvancedFilter}
              />
            </TabsContent>
          )}
          {includeSchemas && (
            <TabsContent value="schemas" className="mt-4">
              <SchemasTable results={results} domain={domain} />
            </TabsContent>
          )}
        </Tabs>
      ) : (
        <MetaTable results={results} domain={domain} includeTitle={includeTitle} includeDesc={includeDesc} includeH1={includeH1} includeH2={includeH2} includeH3={includeH3} includeImages={false} includeRobots={includeRobots}
          filter={metaFilter} setFilter={setMetaFilter}
          search={metaSearch} setSearch={setMetaSearch}
          advancedFilter={metaAdvancedFilter} setAdvancedFilter={setMetaAdvancedFilter}
          sortKey={metaSortKey} setSortKey={setMetaSortKey}
          sortDir={metaSortDir} setSortDir={setMetaSortDir}
        />
      )}
    </motion.div>
  );
}

// ─── SEO Metadata table ───────────────────────────────────────────────────────
function MetaTable({
  results, domain, includeTitle, includeDesc, includeH1, includeH2, includeH3, includeRobots,
  filter, setFilter, search, setSearch, advancedFilter, setAdvancedFilter, sortKey, setSortKey, sortDir, setSortDir,
}: {
  results: CrawlResult[]; domain: string; includeTitle: boolean; includeDesc: boolean;
  includeH1: boolean; includeH2: boolean; includeH3: boolean; includeImages: boolean; includeRobots: boolean;
  filter: Filter; setFilter: (f: Filter) => void;
  search: string; setSearch: (s: string) => void;
  advancedFilter: AdvancedFilter; setAdvancedFilter: (f: AdvancedFilter) => void;
  sortKey: SortKey; setSortKey: (k: SortKey) => void;
  sortDir: SortDir; setSortDir: (d: SortDir) => void;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const parentRef = useRef<HTMLDivElement>(null);

  const metaFields = useMemo(() => {
    const f: { key: string; label: string }[] = [{ key: "url", label: "URL" }];
    if (includeTitle) f.push({ key: "title", label: "Meta Title" });
    if (includeDesc) f.push({ key: "description", label: "Meta Description" });
    if (includeH1) f.push({ key: "h1s", label: "H1 Tags" });
    if (includeH2) f.push({ key: "h2s", label: "H2 Tags" });
    if (includeH3) f.push({ key: "h3s", label: "H3 Tags" });
    if (includeRobots) f.push({ key: "robots", label: "Meta Robots" });
    f.push({ key: "status", label: "Status" });
    return f;
  }, [includeTitle, includeDesc, includeH1, includeH2, includeH3, includeRobots]);


  const getMetaFieldValue = (r: CrawlResult, field: string): string => {
    switch (field) {
      case "url": return r.url;
      case "title": return r.title;
      case "description": return r.description;
      case "h1s": return (r.h1s ?? []).join(" | ");
      case "h2s": return (r.h2s ?? []).join(" | ");
      case "h3s": return (r.h3s ?? []).join(" | ");
      case "robots": return r.robots ?? "";
      case "status": return r.status;
      default: return "";
    }
  };

  const filtered = useMemo(() => {
    let data = [...results];
    if (filter === "errors") data = data.filter((r) => r.status === "Error");
    else if (filter === "missing-title") data = data.filter((r) => !r.title);
    else if (filter === "missing-desc") data = data.filter((r) => !r.description);
    else if (filter === "title-long") data = data.filter((r) => r.title.length > 60);
    else if (filter === "multi-h1") data = data.filter((r) => (r.h1s ?? []).length > 1);
    else if (filter === "missing-h1") data = data.filter((r) => (r.h1s ?? []).length === 0);
    else if (filter === "has-robots") data = data.filter((r) => (r.robots ?? '').length > 0);
    else if (filter === "no-robots") data = data.filter((r) => !(r.robots ?? '').length);
    else if (filter === "noindex") data = data.filter((r) => (r.robots ?? '').toLowerCase().includes('noindex'));
    else if (filter === "nofollow") data = data.filter((r) => (r.robots ?? '').toLowerCase().includes('nofollow'));

    // Advanced filter
    if (isFilterActive(advancedFilter)) {
      data = applyAdvancedFilter(data, advancedFilter, getMetaFieldValue);
    } else if (search) {
      const q = search.toLowerCase();
      data = data.filter((r) =>
        r.url.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        (r.h1s ?? []).some((h) => h.toLowerCase().includes(q))
      );
    }

    data.sort((a, b) => {
      const cmp = String(a[sortKey]).localeCompare(String(b[sortKey]));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return data;
  }, [results, search, advancedFilter, sortKey, sortDir, filter]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const handleCopy = () => {
    const csv = generateCSV(filtered, includeTitle, includeDesc, includeH1, includeH2, includeH3, false, includeRobots);
    navigator.clipboard.writeText(csv);
    setCopied(true);
    toast({ title: "Copied!", description: `${filtered.length} rows copied as CSV` });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const csv = generateCSV(filtered, includeTitle, includeDesc, includeH1, includeH2, includeH3, false, includeRobots);
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
  const robotsFilters: { key: Filter; label: string }[] = [
    { key: "has-robots", label: "Has Robots" },
    { key: "no-robots", label: "No Robots" },
    { key: "noindex", label: "Noindex" },
    { key: "nofollow", label: "Nofollow" },
  ];
  const filters = [
    ...baseFilters,
    ...(includeH1 ? h1Filters : []),
    ...(includeRobots ? robotsFilters : []),
  ];

  const colTemplate = [
    '1fr',
    ...(includeTitle ? ['1fr'] : []),
    ...(includeDesc ? ['1.4fr'] : []),
    ...(includeH1 ? ['1fr'] : []),
    ...(includeH2 ? ['1fr'] : []),
    ...(includeH3 ? ['1fr'] : []),
    ...(includeRobots ? ['0.8fr'] : []),
    '80px',
  ].join(' ');
  const gridStyle = { gridTemplateColumns: colTemplate };

  return (
    <div className="space-y-3">
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
          <SearchBarWithGear
            search={search}
            setSearch={setSearch}
            placeholder="Filter..."
            fields={metaFields}
            advancedFilter={advancedFilter}
            setAdvancedFilter={setAdvancedFilter}
          />
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

      <div className="border border-border rounded-lg overflow-hidden bg-card">
        <div style={gridStyle} className="grid gap-0 border-b border-border bg-muted/30 text-[11px] font-medium text-muted-foreground">
          <button onClick={() => handleSort("url")} className="flex items-center gap-1 px-3 py-2 hover:text-foreground transition-colors text-left">
            URL <ArrowUpDown className="h-2.5 w-2.5 opacity-50" />
          </button>
          {includeTitle && (
            <button onClick={() => handleSort("title")} className="flex items-center gap-1 px-3 py-2 hover:text-foreground transition-colors text-left">
              Meta Title <ArrowUpDown className="h-2.5 w-2.5 opacity-50" />
            </button>
          )}
          {includeDesc && (
            <button onClick={() => handleSort("description")} className="flex items-center gap-1 px-3 py-2 hover:text-foreground transition-colors text-left">
              Meta Description <ArrowUpDown className="h-2.5 w-2.5 opacity-50" />
            </button>
          )}
          {includeH1 && (
            <div className="flex items-center gap-1 px-3 py-2 text-left"><Heading1 className="h-3 w-3" /> H1 Tags</div>
          )}
          {includeH2 && (
            <div className="flex items-center gap-1 px-3 py-2 text-left"><Heading1 className="h-3 w-3" /> H2 Tags</div>
          )}
          {includeH3 && (
            <div className="flex items-center gap-1 px-3 py-2 text-left"><Heading1 className="h-3 w-3" /> H3 Tags</div>
          )}
          {includeRobots && (
            <div className="flex items-center gap-1 px-3 py-2 text-left"><Bot className="h-3 w-3" /> Meta Robots</div>
          )}
          <button onClick={() => handleSort("status")} className="flex items-center gap-1 px-3 py-2 hover:text-foreground transition-colors text-left">
            Status <ArrowUpDown className="h-2.5 w-2.5 opacity-50" />
          </button>
        </div>

        <div ref={parentRef} className="overflow-auto max-h-[600px]">
          <div className="divide-y divide-border">
            {filtered.map((row, index) => {
              const h1s = row.h1s ?? [];
              const h2s = row.h2s ?? [];
              const h3s = row.h3s ?? [];
              return (
                <div key={index} style={gridStyle} className="grid gap-0 hover:bg-muted/20 transition-colors text-xs">
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
                              <span className={`text-[9px] font-semibold px-1 rounded shrink-0 mt-0.5 ${i === 0 ? "bg-warning/15 text-warning" : "bg-destructive/15 text-destructive"}`}>H1</span>
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
                  {includeRobots && (
                    <div className="px-3 py-2 text-[11px]">
                      {row.robots ? (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          row.robots.toLowerCase().includes('noindex') ? 'bg-destructive/15 text-destructive' :
                          row.robots.toLowerCase().includes('nofollow') ? 'bg-warning/15 text-warning' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {row.robots}
                        </span>
                      ) : (
                        <span className="text-muted-foreground italic">(none)</span>
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
function ImagesTable({ results, domain, imgFilter, setImgFilter, search, setSearch, advancedFilter, setAdvancedFilter }: {
  results: CrawlResult[]; domain: string;
  imgFilter: ImageFilter; setImgFilter: (f: ImageFilter) => void;
  search: string; setSearch: (s: string) => void;
  advancedFilter: AdvancedFilter; setAdvancedFilter: (f: AdvancedFilter) => void;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const imgFields = [
    { key: "url", label: "Page URL" },
    { key: "img_src", label: "Image URL" },
    { key: "img_alt", label: "Alt Text" },
  ];

  const getImgFieldValue = (r: CrawlResult, field: string): string => {
    switch (field) {
      case "url": return r.url;
      case "img_src": return (r.images ?? []).map((img) => img.src).join(" | ");
      case "img_alt": return (r.images ?? []).map((img) => img.alt ?? "").join(" | ");
      default: return "";
    }
  };

  const filteredResults = useMemo(() => {
    let data = results.filter((r) => r.status === "OK");
    if (imgFilter === "missing-alt") data = data.filter((r) => (r.images ?? []).some((img) => img.alt === null));
    else if (imgFilter === "no-images") data = data.filter((r) => (r.images ?? []).length === 0);
    else if (imgFilter === "has-images") data = data.filter((r) => (r.images ?? []).length > 0);

    if (isFilterActive(advancedFilter)) {
      data = applyAdvancedFilter(data, advancedFilter, getImgFieldValue);
    } else if (search) {
      const q = search.toLowerCase();
      data = data.filter((r) =>
        r.url.toLowerCase().includes(q) ||
        (r.images ?? []).some((img) => img.src.toLowerCase().includes(q) || (img.alt ?? "").toLowerCase().includes(q))
      );
    }
    return data;
  }, [results, imgFilter, search, advancedFilter]);

  const toggleRow = (i: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
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
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
        <div className="flex gap-1.5 flex-wrap">
          {imgFilters.map((f) => (
            <Button key={f.key} size="sm" variant={imgFilter === f.key ? "default" : "outline"} onClick={() => setImgFilter(f.key)} className="text-[11px] h-7 px-2.5">
              {f.label}
            </Button>
          ))}
        </div>
        <div className="flex gap-1.5 items-center w-full sm:w-auto">
          <SearchBarWithGear
            search={search}
            setSearch={setSearch}
            placeholder="Filter URL, src, alt..."
            fields={imgFields}
            advancedFilter={advancedFilter}
            setAdvancedFilter={setAdvancedFilter}
          />
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

      <div className="border border-border rounded-lg overflow-hidden bg-card">
        <div className="grid grid-cols-[2fr_80px_1fr] gap-0 border-b border-border bg-muted/30 text-[11px] font-medium text-muted-foreground">
          <div className="px-3 py-2">Page URL</div>
          <div className="px-3 py-2 text-center">Images</div>
          <div className="px-3 py-2">Coverage</div>
        </div>

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
                  <button className="w-full grid grid-cols-[2fr_80px_1fr] gap-0 hover:bg-muted/20 transition-colors text-left" onClick={() => toggleRow(index)}>
                    <div className="px-3 py-2 font-mono text-[11px] text-muted-foreground break-all">{row.url}</div>
                    <div className="px-3 py-2 text-center text-[11px] font-medium">
                      {images.length === 0 ? <span className="text-muted-foreground">—</span> : <span>{images.length}</span>}
                    </div>
                    <div className="px-3 py-2 text-[11px]">
                      {images.length === 0 ? (
                        <span className="text-muted-foreground italic">No images</span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          {withAlt > 0 && <span className="inline-flex items-center gap-0.5 text-success"><Check className="h-2.5 w-2.5" />{withAlt} with alt</span>}
                          {withoutAlt > 0 && <span className="inline-flex items-center gap-0.5 text-destructive"><AlertTriangle className="h-2.5 w-2.5" />{withoutAlt} missing</span>}
                          <span className="text-muted-foreground ml-auto text-[10px]">{isExpanded ? "▲" : "▼"}</span>
                        </span>
                      )}
                    </div>
                  </button>

                  {isExpanded && images.length > 0 && (
                    <div className="bg-muted/10 border-t border-border divide-y divide-border/50">
                      <div className="grid grid-cols-[2fr_1fr] gap-0 px-6 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                        <div>Image URL</div>
                        <div>Alt Text</div>
                      </div>
                      {images.map((img, imgIndex) => (
                        <div key={imgIndex} className="grid grid-cols-[2fr_1fr] gap-0 px-6 py-1.5 hover:bg-muted/20 transition-colors">
                          <div className="font-mono text-[11px] text-muted-foreground break-all pr-3 truncate" title={img.src}>{img.src}</div>
                          <div className="text-[11px] break-words">
                            {img.alt ? (
                              <span className="text-foreground">{img.alt}</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-destructive/70">
                                <AlertTriangle className="h-2.5 w-2.5 shrink-0" /> No alt text
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

  const schemaFields = [
    { key: "url", label: "Page URL" },
    { key: "schema_content", label: "Schema Content" },
    { key: "schema_type", label: "Schema Type" },
  ];
  const [advancedFilter, setAdvancedFilter] = useState<AdvancedFilter>(() => createEmptyFilter("url"));

  const getSchemaFieldValue = (r: CrawlResult, field: string): string => {
    switch (field) {
      case "url": return r.url;
      case "schema_content": return (r.schemas ?? []).join(" ");
      case "schema_type":
        return (r.schemas ?? []).map((s) => {
          try { return extractSchemaTypes(JSON.parse(s)); } catch { return "Raw"; }
        }).join(" | ");
      default: return "";
    }
  };

  const filteredResults = useMemo(() => {
    let data = results.filter((r) => r.status === "OK");
    if (schemaFilter === "has-schema") data = data.filter((r) => (r.schemas ?? []).length > 0);
    else if (schemaFilter === "no-schema") data = data.filter((r) => (r.schemas ?? []).length === 0);

    if (isFilterActive(advancedFilter)) {
      data = applyAdvancedFilter(data, advancedFilter, getSchemaFieldValue);
    } else if (search) {
      const q = search.toLowerCase();
      data = data.filter((r) =>
        r.url.toLowerCase().includes(q) ||
        (r.schemas ?? []).some((s) => s.toLowerCase().includes(q))
      );
    }
    return data;
  }, [results, schemaFilter, search, advancedFilter]);

  const toggleRow = (i: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
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
        schemas.forEach((s) => { rows.push(`${escape(r.url)},${schemas.length},${escape(s)}`); });
      }
    });
    downloadCSV(rows.join("\n"), `${domain}-schemas`);
    toast({ title: "Downloaded!", description: "Schema markup CSV saved" });
  };

  const filters: { key: "all" | "has-schema" | "no-schema"; label: string }[] = [
    { key: "all", label: "All Pages" },
    { key: "has-schema", label: "Has Schema" },
    { key: "no-schema", label: "No Schema" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
        <div className="flex gap-1.5 flex-wrap">
          {filters.map((f) => (
            <Button key={f.key} size="sm" variant={schemaFilter === f.key ? "default" : "outline"} onClick={() => setSchemaFilter(f.key)} className="text-[11px] h-7 px-2.5">
              {f.label}
            </Button>
          ))}
        </div>
        <div className="flex gap-1.5 items-center w-full sm:w-auto">
          <SearchBarWithGear
            search={search}
            setSearch={setSearch}
            placeholder="Filter URL or schema content..."
            fields={schemaFields}
            advancedFilter={advancedFilter}
            setAdvancedFilter={setAdvancedFilter}
          />
          <Button size="sm" variant="outline" onClick={handleDownload} className="h-7 gap-1 text-[11px] px-2.5">
            <Download className="h-3 w-3" /> CSV
          </Button>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">{filteredResults.length} pages</p>

      <div className="border border-border rounded-lg overflow-hidden bg-card">
        <div className="grid grid-cols-[2fr_100px_1fr] gap-0 border-b border-border bg-muted/30 text-[11px] font-medium text-muted-foreground">
          <div className="px-3 py-2">Page URL</div>
          <div className="px-3 py-2 text-center">Schemas</div>
          <div className="px-3 py-2">Type</div>
        </div>

        <div className="overflow-auto max-h-[600px] divide-y divide-border">
          {filteredResults.length === 0 ? (
            <div className="px-3 py-6 text-center text-[11px] text-muted-foreground">No results</div>
          ) : (
            filteredResults.map((row, index) => {
              const schemas = row.schemas ?? [];
              const isExpanded = expandedRows.has(index);
              const types = schemas.map((s) => {
                try { return extractSchemaTypes(JSON.parse(s)); } catch { return "Raw Schema"; }
              });

              return (
                <div key={index}>
                  <button className="w-full grid grid-cols-[2fr_100px_1fr] gap-0 hover:bg-muted/20 transition-colors text-left" onClick={() => schemas.length > 0 && toggleRow(index)}>
                    <div className="px-3 py-2 font-mono text-[11px] text-muted-foreground break-all">{row.url}</div>
                    <div className="px-3 py-2 text-center text-[11px] font-medium">
                      {schemas.length === 0 ? <span className="text-muted-foreground">—</span> : <span>{schemas.length}</span>}
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
                          <span className="text-muted-foreground ml-auto text-[10px]">{isExpanded ? "▲" : "▼"}</span>
                        </span>
                      )}
                    </div>
                  </button>

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
                                size="sm" variant="outline"
                                onClick={(e) => { e.stopPropagation(); handleCopySchema(schema, copyId); }}
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
