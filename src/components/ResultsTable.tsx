import { useState, useMemo, useRef } from "react";
import { CrawlResult, generateCSV, generateTSV, rowsToTSV, downloadCSV } from "@/lib/crawl-api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Download, Copy, Check, Search, ArrowUpDown, AlertTriangle, FileWarning, Heading1, Heading2, Heading3, Image, Code, ClipboardCopy, Bot, Settings2, Link2, Languages, LinkIcon, ExternalLink, ChevronRight, Share2 } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AdvancedSearchDialog, AdvancedFilter, createEmptyFilter, isFilterActive, applyAdvancedFilter } from "@/components/AdvancedSearchDialog";
import { SocialTagsTable } from "@/components/SocialTagsTable";

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
type Filter = "all" | "errors" | "missing-title" | "missing-desc" | "title-long" | "multi-h1" | "missing-h1" | "has-robots" | "no-robots" | "noindex" | "nofollow" | "2xx" | "3xx" | "4xx" | "5xx";
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
  includeCanonical: boolean;
  includeHreflangs: boolean;
  includeInternalLinks: boolean;
  includeSocialTags: boolean;
  /** When set, forces the table to ONLY show this single sub-view and hides
   *  the tab switcher. Used by the sidebar to make each section self-contained. */
  forceTab?: "meta" | "images" | "schemas" | "canonical" | "hreflangs" | "internalLinks" | "social";
}

type SearchField = { key: string; label: string };

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
  fields: SearchField[];
  advancedFilter: AdvancedFilter;
  setAdvancedFilter: (f: AdvancedFilter) => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const scopedAdvancedFilter = useMemo(() => getScopedAdvancedFilter(advancedFilter, fields), [advancedFilter, fields]);
  const active = isFilterActive(scopedAdvancedFilter);

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
        filter={scopedAdvancedFilter}
        onApply={setAdvancedFilter}
        onReset={() => setAdvancedFilter(createEmptyFilter(fields[0].key))}
      />
    </>
  );
}

function getScopedAdvancedFilter(filter: AdvancedFilter, fields: SearchField[]): AdvancedFilter {
  const allowedFields = new Set(fields.map((field) => field.key));
  const groups = filter.groups
    .map((group) => ({
      ...group,
      conditions: group.conditions.filter((condition) => allowedFields.has(condition.field)),
    }))
    .filter((group) => group.conditions.length > 0);

  return groups.length > 0 ? { ...filter, groups } : createEmptyFilter(fields[0]?.key ?? "url");
}

function matchesFieldSearch<T>(
  item: T,
  fields: SearchField[],
  getFieldValue: (item: T, field: string) => string,
  query: string,
) {
  const normalizedQuery = query.toLowerCase();
  return fields.some((field) => getFieldValue(item, field.key).toLowerCase().includes(normalizedQuery));
}

// ─── Main component ───────────────────────────────────────────────────────────
export function ResultsTable({ results, domain, includeTitle, includeDesc, includeH1, includeH2, includeH3, includeImages, includeSchemas, includeRobots, includeCanonical, includeHreflangs, includeInternalLinks, includeSocialTags, forceTab }: ResultsTableProps) {
  const [activeView, setActiveView] = useState<"meta" | "images" | "schemas" | "canonical" | "hreflangs" | "internalLinks" | "social">(forceTab ?? "meta");

  // Universal filter state shared across all tabs
  const [metaFilter, setMetaFilter] = useState<Filter>("all");
  const [metaSortKey, setMetaSortKey] = useState<SortKey>("url");
  const [metaSortDir, setMetaSortDir] = useState<SortDir>("asc");
  const [imgFilter, setImgFilter] = useState<ImageFilter>("all");
  const [schemaFilter, setSchemaFilter] = useState<"all" | "has-schema" | "no-schema">("all");
  const [canonicalFilter, setCanonicalFilter] = useState<"all" | "self-referencing" | "canonicalised" | "missing">("all");
  const [hreflangFilter, setHreflangFilter] = useState<"all" | "has-hreflang" | "no-hreflang" | "has-x-default">("all");
  const [internalLinksFilter, setInternalLinksFilter] = useState<"all" | "has-internal" | "has-external" | "no-links">("all");

  // Shared search & advanced filter across all tabs
  const [universalSearch, setUniversalSearch] = useState("");
  const [universalAdvancedFilter, setUniversalAdvancedFilter] = useState<AdvancedFilter>(() => createEmptyFilter("url"));

  if (results.length === 0) return null;

  // When the parent forces a single tab (sidebar-driven), render ONLY that
  // sub-table and skip the tab switcher entirely — no more accidental "showing
  // metadata under the OG tab".
  if (forceTab) {
    switch (forceTab) {
      case "images":
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <ImagesTable results={results} domain={domain}
              imgFilter={imgFilter} setImgFilter={setImgFilter}
              search={universalSearch} setSearch={setUniversalSearch}
              advancedFilter={universalAdvancedFilter} setAdvancedFilter={setUniversalAdvancedFilter} />
          </motion.div>
        );
      case "schemas":
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <SchemasTable results={results} domain={domain}
              schemaFilter={schemaFilter} setSchemaFilter={setSchemaFilter}
              search={universalSearch} setSearch={setUniversalSearch}
              advancedFilter={universalAdvancedFilter} setAdvancedFilter={setUniversalAdvancedFilter} />
          </motion.div>
        );
      case "canonical":
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <CanonicalTable results={results} domain={domain}
              canonicalFilter={canonicalFilter} setCanonicalFilter={setCanonicalFilter}
              search={universalSearch} setSearch={setUniversalSearch}
              advancedFilter={universalAdvancedFilter} setAdvancedFilter={setUniversalAdvancedFilter} />
          </motion.div>
        );
      case "hreflangs":
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <HreflangTable results={results} domain={domain}
              hreflangFilter={hreflangFilter} setHreflangFilter={setHreflangFilter}
              search={universalSearch} setSearch={setUniversalSearch}
              advancedFilter={universalAdvancedFilter} setAdvancedFilter={setUniversalAdvancedFilter} />
          </motion.div>
        );
      case "internalLinks":
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <InternalLinksTable results={results} domain={domain}
              linkFilter={internalLinksFilter} setLinkFilter={setInternalLinksFilter}
              search={universalSearch} setSearch={setUniversalSearch}
              advancedFilter={universalAdvancedFilter} setAdvancedFilter={setUniversalAdvancedFilter} />
          </motion.div>
        );
      case "social":
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <SocialTagsTable results={results} />
          </motion.div>
        );
      case "meta":
      default:
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <MetaTable results={results} domain={domain} includeTitle={includeTitle} includeDesc={includeDesc} includeH1={includeH1} includeH2={includeH2} includeH3={includeH3} includeImages={false} includeRobots={includeRobots}
              filter={metaFilter} setFilter={setMetaFilter}
              search={universalSearch} setSearch={setUniversalSearch}
              advancedFilter={universalAdvancedFilter} setAdvancedFilter={setUniversalAdvancedFilter}
              sortKey={metaSortKey} setSortKey={setMetaSortKey}
              sortDir={metaSortDir} setSortDir={setMetaSortDir}
            />
          </motion.div>
        );
    }
  }

  const hasTabs = includeImages || includeSchemas || includeCanonical || includeHreflangs || includeInternalLinks || includeSocialTags;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
      {hasTabs ? (
        <Tabs value={activeView} onValueChange={(v) => setActiveView(v as "meta" | "images" | "schemas" | "canonical" | "hreflangs" | "internalLinks" | "social")}>
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
            {includeCanonical && (
              <TabsTrigger value="canonical" className="text-xs gap-1.5 h-7 px-4 rounded-md font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
                <Link2 className="h-3 w-3" />
                Canonical
              </TabsTrigger>
            )}
            {includeHreflangs && (
              <TabsTrigger value="hreflangs" className="text-xs gap-1.5 h-7 px-4 rounded-md font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
                <Languages className="h-3 w-3" />
                Hreflang
              </TabsTrigger>
            )}
            {includeInternalLinks && (
              <TabsTrigger value="internalLinks" className="text-xs gap-1.5 h-7 px-4 rounded-md font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
                <LinkIcon className="h-3 w-3" />
                Internal Links
              </TabsTrigger>
            )}
            {includeSocialTags && (
              <TabsTrigger value="social" className="text-xs gap-1.5 h-7 px-4 rounded-md font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
                <Share2 className="h-3 w-3" />
                OG &amp; Twitter
              </TabsTrigger>
            )}
          </TabsList>
          <TabsContent value="meta" className="mt-4">
            <MetaTable results={results} domain={domain} includeTitle={includeTitle} includeDesc={includeDesc} includeH1={includeH1} includeH2={includeH2} includeH3={includeH3} includeImages={false} includeRobots={includeRobots}
              filter={metaFilter} setFilter={setMetaFilter}
              search={universalSearch} setSearch={setUniversalSearch}
              advancedFilter={universalAdvancedFilter} setAdvancedFilter={setUniversalAdvancedFilter}
              sortKey={metaSortKey} setSortKey={setMetaSortKey}
              sortDir={metaSortDir} setSortDir={setMetaSortDir}
            />
          </TabsContent>
          {includeImages && (
            <TabsContent value="images" className="mt-4">
              <ImagesTable results={results} domain={domain}
                imgFilter={imgFilter} setImgFilter={setImgFilter}
                search={universalSearch} setSearch={setUniversalSearch}
                advancedFilter={universalAdvancedFilter} setAdvancedFilter={setUniversalAdvancedFilter}
              />
            </TabsContent>
          )}
          {includeSchemas && (
            <TabsContent value="schemas" className="mt-4">
              <SchemasTable results={results} domain={domain}
                schemaFilter={schemaFilter} setSchemaFilter={setSchemaFilter}
                search={universalSearch} setSearch={setUniversalSearch}
                advancedFilter={universalAdvancedFilter} setAdvancedFilter={setUniversalAdvancedFilter}
              />
            </TabsContent>
          )}
          {includeCanonical && (
            <TabsContent value="canonical" className="mt-4">
              <CanonicalTable results={results} domain={domain}
                canonicalFilter={canonicalFilter} setCanonicalFilter={setCanonicalFilter}
                search={universalSearch} setSearch={setUniversalSearch}
                advancedFilter={universalAdvancedFilter} setAdvancedFilter={setUniversalAdvancedFilter}
              />
            </TabsContent>
          )}
          {includeHreflangs && (
            <TabsContent value="hreflangs" className="mt-4">
              <HreflangTable results={results} domain={domain}
                hreflangFilter={hreflangFilter} setHreflangFilter={setHreflangFilter}
                search={universalSearch} setSearch={setUniversalSearch}
                advancedFilter={universalAdvancedFilter} setAdvancedFilter={setUniversalAdvancedFilter}
              />
            </TabsContent>
          )}
          {includeInternalLinks && (
            <TabsContent value="internalLinks" className="mt-4">
              <InternalLinksTable results={results} domain={domain}
                linkFilter={internalLinksFilter} setLinkFilter={setInternalLinksFilter}
                search={universalSearch} setSearch={setUniversalSearch}
                advancedFilter={universalAdvancedFilter} setAdvancedFilter={setUniversalAdvancedFilter}
              />
            </TabsContent>
          )}
          {includeSocialTags && (
            <TabsContent value="social" className="mt-4">
              <SocialTagsTable results={results} />
            </TabsContent>
          )}
        </Tabs>
      ) : (
        <MetaTable results={results} domain={domain} includeTitle={includeTitle} includeDesc={includeDesc} includeH1={includeH1} includeH2={includeH2} includeH3={includeH3} includeImages={false} includeRobots={includeRobots}
          filter={metaFilter} setFilter={setMetaFilter}
          search={universalSearch} setSearch={setUniversalSearch}
          advancedFilter={universalAdvancedFilter} setAdvancedFilter={setUniversalAdvancedFilter}
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
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const parentRef = useRef<HTMLDivElement>(null);

  const toggleExpanded = (i: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const metaFields = useMemo(() => {
    const f: SearchField[] = [{ key: "url", label: "URL" }];
    if (includeTitle) f.push({ key: "title", label: "Meta Title" });
    if (includeDesc) f.push({ key: "description", label: "Meta Description" });
    if (includeH1) f.push({ key: "h1s", label: "H1 Tags" });
    if (includeH2) f.push({ key: "h2s", label: "H2 Tags" });
    if (includeH3) f.push({ key: "h3s", label: "H3 Tags" });
    if (includeRobots) f.push({ key: "robots", label: "Meta Robots" });
    f.push(
      { key: "status", label: "Crawl Status" },
      { key: "statusCode", label: "Status Code" },
      { key: "finalUrl", label: "Final URL" },
      { key: "redirectedUrl", label: "Redirected URL" },
      { key: "redirectType", label: "Redirect Type" },
      { key: "redirectChain", label: "Redirect Chain" },
      { key: "hopCount", label: "Hop Count" },
      { key: "fetchTime", label: "Fetch Time" },
    );
    return f;
  }, [includeTitle, includeDesc, includeH1, includeH2, includeH3, includeRobots]);

  const scopedAdvancedFilter = useMemo(
    () => getScopedAdvancedFilter(advancedFilter, metaFields),
    [advancedFilter, metaFields],
  );


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
      case "statusCode": return String(r.statusCode ?? "");
      case "redirectedUrl": return r.redirectedUrl ?? r.finalUrl ?? "";
      case "finalUrl": return r.finalUrl ?? r.redirectedUrl ?? r.url;
      case "redirectType": return r.redirectType ?? "none";
      case "redirectChain": return (r.redirectChain ?? []).map((h) => `${h.url} (${h.status} ${h.type})`).join(" → ");
      case "hopCount": return String(r.hopCount ?? (r.redirectChain?.length ?? 0));
      case "fetchTime": return r.fetchTime;
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
    else if (filter === "2xx") data = data.filter((r) => r.statusCode >= 200 && r.statusCode < 300);
    else if (filter === "3xx") data = data.filter((r) => (r.statusCode >= 300 && r.statusCode < 400) || !!r.redirectStatusCode || r.redirectType === 'meta-refresh' || r.redirectType === 'javascript' || r.redirectType === 'mixed');
    else if (filter === "4xx") data = data.filter((r) => r.statusCode >= 400 && r.statusCode < 500);
    else if (filter === "5xx") data = data.filter((r) => r.statusCode >= 500 && r.statusCode < 600);

    // Advanced filter
    if (isFilterActive(scopedAdvancedFilter)) {
      data = applyAdvancedFilter(data, scopedAdvancedFilter, getMetaFieldValue);
    } else if (search) {
      data = data.filter((r) => matchesFieldSearch(r, metaFields, getMetaFieldValue, search));
    }

    data.sort((a, b) => {
      const cmp = String(a[sortKey]).localeCompare(String(b[sortKey]));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return data;
  }, [results, search, scopedAdvancedFilter, sortKey, sortDir, filter, metaFields]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const handleCopy = () => {
    // TSV pastes cleanly into Excel/Sheets (one column per cell).
    const tsv = generateTSV(filtered, includeTitle, includeDesc, includeH1, includeH2, includeH3, false, includeRobots);
    navigator.clipboard.writeText(tsv);
    setCopied(true);
    toast({ title: "Copied!", description: `${filtered.length} rows copied — paste into Excel or Sheets` });
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
    { key: "2xx", label: "2xx" },
    { key: "3xx", label: "3xx" },
    { key: "4xx", label: "4xx" },
    { key: "5xx", label: "5xx" },
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
    '24px', // expand toggle
    '1.2fr', // Initial URL
    ...(includeTitle ? ['1fr'] : []),
    ...(includeDesc ? ['1.4fr'] : []),
    ...(includeH1 ? ['1fr'] : []),
    ...(includeH2 ? ['1fr'] : []),
    ...(includeH3 ? ['1fr'] : []),
    ...(includeRobots ? ['0.8fr'] : []),
    '1fr', // Final URL
    '110px', // Redirect Type badge
    '90px', // Status
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
          <div className="px-1 py-2" />
          <button onClick={() => handleSort("url")} className="flex items-center gap-1 px-3 py-2 hover:text-foreground transition-colors text-left">
            Initial URL <ArrowUpDown className="h-2.5 w-2.5 opacity-50" />
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
            <div className="flex items-center gap-1 px-3 py-2 text-left"><Heading2 className="h-3 w-3" /> H2 Tags</div>
          )}
          {includeH3 && (
            <div className="flex items-center gap-1 px-3 py-2 text-left"><Heading3 className="h-3 w-3" /> H3 Tags</div>
          )}
          {includeRobots && (
            <div className="flex items-center gap-1 px-3 py-2 text-left"><Bot className="h-3 w-3" /> Meta Robots</div>
          )}
          <div className="flex items-center gap-1 px-3 py-2 text-left">Final URL</div>
          <div className="flex items-center gap-1 px-3 py-2 text-left">Redirect</div>
          <button onClick={() => handleSort("status")} className="flex items-center gap-1 px-3 py-2 hover:text-foreground transition-colors text-left">
            Status <ArrowUpDown className="h-2.5 w-2.5 opacity-50" />
          </button>
        </div>

        <div ref={parentRef} className="overflow-auto max-h-[600px]">
          <div>
            {filtered.map((row, index) => {
              const h1s = row.h1s ?? [];
              const h2s = row.h2s ?? [];
              const h3s = row.h3s ?? [];
              const initial = row.initialUrl ?? row.url;
              const final = row.finalUrl ?? row.redirectedUrl ?? initial;
              const chain = row.redirectChain ?? [];
              const rType = row.redirectType ?? 'none';
              const hasRedirect = rType !== 'none' && chain.length > 0;
              const isOpen = expandedRows.has(index);

              const typeBadgeClass =
                rType === 'http' ? 'bg-primary/15 text-primary border-primary/30' :
                rType === 'meta-refresh' ? 'bg-warning/15 text-warning border-warning/30' :
                rType === 'javascript' ? 'bg-destructive/15 text-destructive border-destructive/30' :
                rType === 'mixed' ? 'bg-accent/30 text-accent-foreground border-border' :
                'bg-muted text-muted-foreground border-border';

              return (
                <div key={index} className="border-b border-border last:border-b-0">
                  <div style={gridStyle} className="grid gap-0 hover:bg-muted/20 transition-colors text-xs">
                    <button
                      type="button"
                      onClick={() => hasRedirect && toggleExpanded(index)}
                      disabled={!hasRedirect}
                      className={`flex items-center justify-center py-2 ${hasRedirect ? 'text-muted-foreground hover:text-foreground cursor-pointer' : 'text-transparent cursor-default'}`}
                      aria-label={hasRedirect ? (isOpen ? 'Collapse redirect chain' : 'Expand redirect chain') : undefined}
                    >
                      <ChevronRight className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                    </button>
                    <div className="px-3 py-2 break-all font-mono text-[11px] text-muted-foreground">{initial}</div>
                    {includeTitle && (
                      <div className="px-3 py-2 break-words text-[11px] space-y-1">
                        {row.title ? (
                          <>
                            <div>{row.title}</div>
                            <CharCountBadge len={row.title.length} ideal={[50, 60]} />
                          </>
                        ) : (
                          <span className="text-muted-foreground italic">(empty)</span>
                        )}
                      </div>
                    )}
                    {includeDesc && (
                      <div className="px-3 py-2 break-words text-[11px] text-muted-foreground space-y-1">
                        {row.description ? (
                          <>
                            <div>{row.description}</div>
                            <CharCountBadge len={row.description.length} ideal={[120, 160]} />
                          </>
                        ) : (
                          <span className="italic">(empty)</span>
                        )}
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
                    {/* Final URL */}
                    <div className="px-3 py-2 break-all font-mono text-[11px]">
                      {hasRedirect ? (
                        <span className="text-warning">{final}</span>
                      ) : (
                        <span className="text-muted-foreground/60 italic">—</span>
                      )}
                    </div>
                    {/* Redirect Type badge */}
                    <div className="px-3 py-2 flex items-start">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium ${typeBadgeClass}`}>
                        {rType}
                        {chain.length > 1 && (
                          <span className="opacity-70">· {chain.length}</span>
                        )}
                      </span>
                    </div>
                    {/* Status */}
                    <div className="px-3 py-2 text-[11px]">
                      <span className={`font-medium ${
                        row.statusCode >= 200 && row.statusCode < 300 ? 'text-success' :
                        row.statusCode >= 300 && row.statusCode < 400 ? 'text-warning' :
                        row.statusCode >= 400 ? 'text-destructive' :
                        row.status === 'Error' ? 'text-destructive' : 'text-muted-foreground'
                      }`}>
                        {row.statusCode > 0 ? row.statusCode : 'Err'}
                      </span>
                    </div>
                  </div>
                  {hasRedirect && isOpen && (
                    <div className="bg-muted/30 border-t border-border px-4 py-3 text-[11px] space-y-1.5">
                      <div className="font-medium text-foreground/80 mb-1">Redirect chain ({chain.length} hop{chain.length === 1 ? '' : 's'})</div>
                      <ol className="space-y-1">
                        {chain.map((hop, hi) => (
                          <li key={hi} className="flex items-start gap-2 font-mono">
                            <span className="text-muted-foreground shrink-0 w-5 text-right">{hi + 1}.</span>
                            <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              hop.status === -1 ? 'bg-destructive/15 text-destructive' :
                              hop.type === 'meta-refresh' ? 'bg-warning/15 text-warning' :
                              hop.type === 'javascript' ? 'bg-destructive/15 text-destructive' :
                              hop.status >= 300 && hop.status < 400 ? 'bg-primary/15 text-primary' :
                              hop.status >= 400 ? 'bg-destructive/15 text-destructive' :
                              'bg-success/15 text-success'
                            }`}>
                              {hop.status === -1 ? '!' : hop.status}
                            </span>
                            <span className="shrink-0 text-[10px] text-muted-foreground uppercase tracking-wide">
                              {hop.type === 'meta-refresh' ? 'meta' : hop.type === 'javascript' ? 'js' : 'http'}
                            </span>
                            <span className="break-all text-foreground/90">{hop.url}</span>
                            {hop.statusText && (
                              <span className="text-destructive text-[10px] italic ml-1">({hop.statusText})</span>
                            )}
                          </li>
                        ))}
                        <li className="flex items-start gap-2 font-mono pt-1 border-t border-border/50">
                          <span className="text-muted-foreground shrink-0 w-5 text-right">→</span>
                          <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-success/15 text-success">final</span>
                          <span className="break-all text-foreground">{final}</span>
                        </li>
                      </ol>
                      {chain.some((h) => h.type === 'javascript') && (
                        <p className="text-[10px] text-muted-foreground italic pt-2 border-t border-border/50 mt-2">
                          JS hops detected via inline script pattern matching. May not catch redirects from external JS files or SPA routing.
                        </p>
                      )}
                    </div>
                  )}
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

  const scopedAdvancedFilter = useMemo(
    () => getScopedAdvancedFilter(advancedFilter, imgFields),
    [advancedFilter, imgFields],
  );

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

    if (isFilterActive(scopedAdvancedFilter)) {
      data = applyAdvancedFilter(data, scopedAdvancedFilter, getImgFieldValue);
    } else if (search) {
      data = data.filter((r) => matchesFieldSearch(r, imgFields, getImgFieldValue, search));
    }
    return data;
  }, [results, imgFilter, search, scopedAdvancedFilter, imgFields]);

  const toggleRow = (i: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const handleCopy = () => {
    const tsv = generateTSV(results, false, false, false, false, false, true);
    navigator.clipboard.writeText(tsv);
    setCopied(true);
    toast({ title: "Copied!", description: "Image alt text data copied — paste into Excel or Sheets" });
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
function SchemasTable({ results, domain, schemaFilter, setSchemaFilter, search, setSearch, advancedFilter, setAdvancedFilter }: {
  results: CrawlResult[]; domain: string;
  schemaFilter: "all" | "has-schema" | "no-schema"; setSchemaFilter: (f: "all" | "has-schema" | "no-schema") => void;
  search: string; setSearch: (s: string) => void;
  advancedFilter: AdvancedFilter; setAdvancedFilter: (f: AdvancedFilter) => void;
}) {
  const { toast } = useToast();
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const schemaFields = [
    { key: "url", label: "Page URL" },
    { key: "schema_content", label: "Schema Content" },
    { key: "schema_type", label: "Schema Type" },
  ];

  const scopedAdvancedFilter = useMemo(
    () => getScopedAdvancedFilter(advancedFilter, schemaFields),
    [advancedFilter, schemaFields],
  );

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

    if (isFilterActive(scopedAdvancedFilter)) {
      data = applyAdvancedFilter(data, scopedAdvancedFilter, getSchemaFieldValue);
    } else if (search) {
      data = data.filter((r) => matchesFieldSearch(r, schemaFields, getSchemaFieldValue, search));
    }
    return data;
  }, [results, schemaFilter, search, scopedAdvancedFilter, schemaFields]);

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

// ─── Canonical URL table ──────────────────────────────────────────────────────
function CanonicalTable({ results, domain, canonicalFilter, setCanonicalFilter, search, setSearch, advancedFilter, setAdvancedFilter }: {
  results: CrawlResult[]; domain: string;
  canonicalFilter: "all" | "self-referencing" | "canonicalised" | "missing"; setCanonicalFilter: (f: "all" | "self-referencing" | "canonicalised" | "missing") => void;
  search: string; setSearch: (s: string) => void;
  advancedFilter: AdvancedFilter; setAdvancedFilter: (f: AdvancedFilter) => void;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const canonicalFields = [
    { key: "url", label: "Page URL" },
    { key: "canonical", label: "Canonical URL" },
    { key: "canonicalStatus", label: "Status" },
  ];

  const scopedAdvancedFilter = useMemo(
    () => getScopedAdvancedFilter(advancedFilter, canonicalFields),
    [advancedFilter, canonicalFields],
  );

  const getCanonicalFieldValue = (r: CrawlResult, field: string): string => {
    switch (field) {
      case "url": return r.url;
      case "canonical": return r.canonical ?? "";
      case "canonicalStatus": return r.canonicalStatus ?? "Missing";
      default: return "";
    }
  };

  const filteredResults = useMemo(() => {
    let data = results.filter((r) => r.status === "OK");
    if (canonicalFilter === "self-referencing") data = data.filter((r) => r.canonicalStatus === "Self Referencing");
    else if (canonicalFilter === "canonicalised") data = data.filter((r) => r.canonicalStatus === "Canonicalised");
    else if (canonicalFilter === "missing") data = data.filter((r) => r.canonicalStatus === "Missing" || !r.canonical);

    if (isFilterActive(scopedAdvancedFilter)) {
      data = applyAdvancedFilter(data, scopedAdvancedFilter, getCanonicalFieldValue);
    } else if (search) {
      data = data.filter((r) => matchesFieldSearch(r, canonicalFields, getCanonicalFieldValue, search));
    }
    return data;
  }, [results, canonicalFilter, search, scopedAdvancedFilter, canonicalFields]);

  const handleCopy = () => {
    const rows = filteredResults.map((r) => [r.url, r.canonical ?? "", r.canonicalStatus ?? "Missing"]);
    navigator.clipboard.writeText(rowsToTSV(["Page URL", "Canonical URL", "Status"], rows));
    setCopied(true);
    toast({ title: "Copied!", description: `${filteredResults.length} rows copied — paste into Excel or Sheets` });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const rows = ["Page URL,Canonical URL,Status"];
    const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
    results.filter((r) => r.status === "OK").forEach((r) => {
      rows.push(`${escape(r.url)},${escape(r.canonical ?? "")},${escape(r.canonicalStatus ?? "Missing")}`);
    });
    downloadCSV(rows.join("\n"), `${domain}-canonical`);
    toast({ title: "Downloaded!", description: "Canonical URL CSV saved" });
  };

  const filters: { key: "all" | "self-referencing" | "canonicalised" | "missing"; label: string }[] = [
    { key: "all", label: "All" },
    { key: "self-referencing", label: "Self Referencing" },
    { key: "canonicalised", label: "Canonicalised" },
    { key: "missing", label: "Missing" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
        <div className="flex gap-1.5 flex-wrap">
          {filters.map((f) => (
            <Button key={f.key} size="sm" variant={canonicalFilter === f.key ? "default" : "outline"} onClick={() => setCanonicalFilter(f.key)} className="text-[11px] h-7 px-2.5">
              {f.label}
            </Button>
          ))}
        </div>
        <div className="flex gap-1.5 items-center w-full sm:w-auto">
          <SearchBarWithGear
            search={search}
            setSearch={setSearch}
            placeholder="Filter URL or canonical..."
            fields={canonicalFields}
            advancedFilter={advancedFilter}
            setAdvancedFilter={setAdvancedFilter}
          />
          <Button size="sm" variant="outline" onClick={handleCopy} className="h-7 gap-1 text-[11px] px-2.5">
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            Copy
          </Button>
          <Button size="sm" variant="outline" onClick={handleDownload} className="h-7 gap-1 text-[11px] px-2.5">
            <Download className="h-3 w-3" /> CSV
          </Button>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">{filteredResults.length} pages</p>

      <div className="border border-border rounded-lg overflow-hidden bg-card">
        <div className="grid grid-cols-[1.5fr_1.5fr_120px] gap-0 border-b border-border bg-muted/30 text-[11px] font-medium text-muted-foreground">
          <div className="px-3 py-2">Page URL</div>
          <div className="px-3 py-2">Canonical URL</div>
          <div className="px-3 py-2">Status</div>
        </div>

        <div className="overflow-auto max-h-[600px] divide-y divide-border">
          {filteredResults.length === 0 ? (
            <div className="px-3 py-6 text-center text-[11px] text-muted-foreground">No results</div>
          ) : (
            filteredResults.map((row, index) => (
              <div key={index} className="grid grid-cols-[1.5fr_1.5fr_120px] gap-0 hover:bg-muted/20 transition-colors text-xs">
                <div className="px-3 py-2 break-all font-mono text-[11px] text-muted-foreground">{row.url}</div>
                <div className="px-3 py-2 break-all font-mono text-[11px]">
                  {row.canonical ? (
                    <span className="text-foreground">{row.canonical}</span>
                  ) : (
                    <span className="text-muted-foreground italic">(none)</span>
                  )}
                </div>
                <div className="px-3 py-2 text-[11px]">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    row.canonicalStatus === 'Self Referencing' ? 'bg-success/15 text-success' :
                    row.canonicalStatus === 'Canonicalised' ? 'bg-warning/15 text-warning' :
                    'bg-destructive/15 text-destructive'
                  }`}>
                    {row.canonicalStatus ?? 'Missing'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Hreflang table ───────────────────────────────────────────────────────────
function HreflangTable({ results, domain, hreflangFilter, setHreflangFilter, search, setSearch, advancedFilter, setAdvancedFilter }: {
  results: CrawlResult[]; domain: string;
  hreflangFilter: "all" | "has-hreflang" | "no-hreflang" | "has-x-default"; setHreflangFilter: (f: "all" | "has-hreflang" | "no-hreflang" | "has-x-default") => void;
  search: string; setSearch: (s: string) => void;
  advancedFilter: AdvancedFilter; setAdvancedFilter: (f: AdvancedFilter) => void;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const hreflangFields = [
    { key: "url", label: "Page URL" },
    { key: "hreflang_count", label: "Hreflang Count" },
    { key: "languages", label: "Languages" },
  ];

  const scopedAdvancedFilter = useMemo(
    () => getScopedAdvancedFilter(advancedFilter, hreflangFields),
    [advancedFilter, hreflangFields],
  );

  const getHreflangFieldValue = (r: CrawlResult, field: string): string => {
    switch (field) {
      case "url": return r.url;
      case "hreflang_count": return String((r.hreflangs ?? []).length);
      case "languages": return (r.hreflangs ?? []).map(h => h.hreflang).join(", ");
      default: return "";
    }
  };

  const filteredResults = useMemo(() => {
    let data = results.filter((r) => r.status === "OK");
    if (hreflangFilter === "has-hreflang") data = data.filter((r) => (r.hreflangs ?? []).length > 0);
    else if (hreflangFilter === "no-hreflang") data = data.filter((r) => (r.hreflangs ?? []).length === 0);
    else if (hreflangFilter === "has-x-default") data = data.filter((r) => (r.hreflangs ?? []).some(h => h.hreflang === "x-default"));

    if (isFilterActive(scopedAdvancedFilter)) {
      data = applyAdvancedFilter(data, scopedAdvancedFilter, getHreflangFieldValue);
    } else if (search) {
      data = data.filter((r) => matchesFieldSearch(r, hreflangFields, getHreflangFieldValue, search));
    }
    return data;
  }, [results, hreflangFilter, search, scopedAdvancedFilter, hreflangFields]);

  const toggleRow = (i: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const handleCopy = () => {
    const rows: string[][] = [];
    filteredResults.forEach((r) => {
      const hreflangs = r.hreflangs ?? [];
      if (hreflangs.length === 0) {
        rows.push([r.url, "", "No hreflang tags"]);
      } else {
        hreflangs.forEach((h) => rows.push([r.url, h.hreflang, h.href]));
      }
    });
    navigator.clipboard.writeText(rowsToTSV(["Page URL", "Hreflang", "Alternate URL"], rows));
    setCopied(true);
    toast({ title: "Copied!", description: `${filteredResults.length} pages copied — paste into Excel or Sheets` });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const rows = ["Page URL,Hreflang,Alternate URL"];
    const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
    results.filter((r) => r.status === "OK").forEach((r) => {
      const hreflangs = r.hreflangs ?? [];
      if (hreflangs.length === 0) {
        rows.push(`${escape(r.url)},,No hreflang tags`);
      } else {
        hreflangs.forEach((h) => {
          rows.push(`${escape(r.url)},${escape(h.hreflang)},${escape(h.href)}`);
        });
      }
    });
    downloadCSV(rows.join("\n"), `${domain}-hreflang`);
    toast({ title: "Downloaded!", description: "Hreflang CSV saved" });
  };

  const filters: { key: "all" | "has-hreflang" | "no-hreflang" | "has-x-default"; label: string }[] = [
    { key: "all", label: "All Pages" },
    { key: "has-hreflang", label: "Has Hreflang" },
    { key: "no-hreflang", label: "No Hreflang" },
    { key: "has-x-default", label: "Has x-default" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
        <div className="flex gap-1.5 flex-wrap">
          {filters.map((f) => (
            <Button key={f.key} size="sm" variant={hreflangFilter === f.key ? "default" : "outline"} onClick={() => setHreflangFilter(f.key)} className="text-[11px] h-7 px-2.5">
              {f.label}
            </Button>
          ))}
        </div>
        <div className="flex gap-1.5 items-center w-full sm:w-auto">
          <SearchBarWithGear
            search={search}
            setSearch={setSearch}
            placeholder="Filter URL or language..."
            fields={hreflangFields}
            advancedFilter={advancedFilter}
            setAdvancedFilter={setAdvancedFilter}
          />
          <Button size="sm" variant="outline" onClick={handleCopy} className="h-7 gap-1 text-[11px] px-2.5">
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            Copy
          </Button>
          <Button size="sm" variant="outline" onClick={handleDownload} className="h-7 gap-1 text-[11px] px-2.5">
            <Download className="h-3 w-3" /> CSV
          </Button>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">{filteredResults.length} pages</p>

      <div className="border border-border rounded-lg overflow-hidden bg-card">
        <div className="grid grid-cols-[1.5fr_100px_1fr] gap-0 border-b border-border bg-muted/30 text-[11px] font-medium text-muted-foreground">
          <div className="px-3 py-2">Page URL</div>
          <div className="px-3 py-2 text-center">Tags</div>
          <div className="px-3 py-2">Languages</div>
        </div>

        <div className="overflow-auto max-h-[600px] divide-y divide-border">
          {filteredResults.length === 0 ? (
            <div className="px-3 py-6 text-center text-[11px] text-muted-foreground">No results</div>
          ) : (
            filteredResults.map((row, index) => {
              const hreflangs = row.hreflangs ?? [];
              const isExpanded = expandedRows.has(index);
              const hasXDefault = hreflangs.some(h => h.hreflang === "x-default");

              return (
                <div key={index}>
                  <button className="w-full grid grid-cols-[1.5fr_100px_1fr] gap-0 hover:bg-muted/20 transition-colors text-left" onClick={() => hreflangs.length > 0 && toggleRow(index)}>
                    <div className="px-3 py-2 font-mono text-[11px] text-muted-foreground break-all">{row.url}</div>
                    <div className="px-3 py-2 text-center text-[11px] font-medium">
                      {hreflangs.length === 0 ? <span className="text-muted-foreground">—</span> : <span>{hreflangs.length}</span>}
                    </div>
                    <div className="px-3 py-2 text-[11px]">
                      {hreflangs.length === 0 ? (
                        <span className="text-muted-foreground italic">No hreflang tags</span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <span className="flex gap-1 flex-wrap">
                            {hreflangs.map((h, i) => (
                              <span key={i} className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                h.hreflang === "x-default" ? "bg-warning/15 text-warning" : "bg-primary/10 text-primary"
                              }`}>
                                {h.hreflang}
                              </span>
                            ))}
                          </span>
                          <span className="text-muted-foreground ml-auto text-[10px]">{isExpanded ? "▲" : "▼"}</span>
                        </span>
                      )}
                    </div>
                  </button>

                  {isExpanded && hreflangs.length > 0 && (
                    <div className="bg-muted/10 border-t border-border">
                      <div className="px-6 py-2">
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="text-muted-foreground">
                              <th className="text-left py-1 font-medium w-24">Language</th>
                              <th className="text-left py-1 font-medium">Alternate URL</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/30">
                            {hreflangs.map((h, hIdx) => (
                              <tr key={hIdx}>
                                <td className="py-1.5">
                                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                    h.hreflang === "x-default" ? "bg-warning/15 text-warning" : "bg-primary/10 text-primary"
                                  }`}>
                                    {h.hreflang}
                                  </span>
                                </td>
                                <td className="py-1.5 font-mono text-muted-foreground break-all">{h.href}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
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

// ─── Internal Links table ─────────────────────────────────────────────────────
type InternalLinksFilterType = "all" | "has-internal" | "has-external" | "no-links";

function InternalLinksTable({ results, domain, linkFilter, setLinkFilter, search, setSearch, advancedFilter, setAdvancedFilter }: {
  results: CrawlResult[]; domain: string;
  linkFilter: InternalLinksFilterType; setLinkFilter: (f: InternalLinksFilterType) => void;
  search: string; setSearch: (s: string) => void;
  advancedFilter: AdvancedFilter; setAdvancedFilter: (f: AdvancedFilter) => void;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const linkFields = [
    { key: "url", label: "Page URL" },
    { key: "anchor_text", label: "Anchor Text" },
    { key: "link_href", label: "Link URL" },
  ];

  const scopedAdvancedFilter = useMemo(
    () => getScopedAdvancedFilter(advancedFilter, linkFields),
    [advancedFilter, linkFields],
  );

  const getLinkFieldValue = (r: CrawlResult, field: string): string => {
    switch (field) {
      case "url": return r.url;
      case "anchor_text": return (r.internalLinks ?? []).map((l) => l.anchorText).join(" | ");
      case "link_href": return (r.internalLinks ?? []).map((l) => l.href).join(" | ");
      default: return "";
    }
  };

  const filteredResults = useMemo(() => {
    let data = results.filter((r) => r.status === "OK");
    const getLinks = (r: CrawlResult) => r.internalLinks ?? [];

    if (linkFilter === "has-internal") data = data.filter((r) => getLinks(r).some((l) => l.isInternal));
    else if (linkFilter === "has-external") data = data.filter((r) => getLinks(r).some((l) => !l.isInternal));
    else if (linkFilter === "no-links") data = data.filter((r) => getLinks(r).length === 0);

    if (isFilterActive(scopedAdvancedFilter)) {
      data = applyAdvancedFilter(data, scopedAdvancedFilter, getLinkFieldValue);
    } else if (search) {
      data = data.filter((r) => matchesFieldSearch(r, linkFields, getLinkFieldValue, search));
    }
    return data;
  }, [results, linkFilter, search, scopedAdvancedFilter, linkFields]);

  const toggleRow = (i: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const handleCopy = () => {
    const rows: string[][] = [];
    filteredResults.forEach((r) => {
      const links = r.internalLinks ?? [];
      if (links.length === 0) {
        rows.push([r.url, "", "", "No links found"]);
      } else {
        links.forEach((l) => rows.push([r.url, l.anchorText, l.href, l.isInternal ? "Internal" : "External"]));
      }
    });
    navigator.clipboard.writeText(rowsToTSV(["Page URL", "Anchor Text", "Link URL", "Type"], rows));
    setCopied(true);
    toast({ title: "Copied!", description: `${filteredResults.length} pages copied — paste into Excel or Sheets` });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const rows = ["Page URL,Anchor Text,Link URL,Type"];
    const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
    results.filter((r) => r.status === "OK").forEach((r) => {
      const links = r.internalLinks ?? [];
      if (links.length === 0) {
        rows.push(`${escape(r.url)},,,"No links found"`);
      } else {
        links.forEach((l) => {
          rows.push(`${escape(r.url)},${escape(l.anchorText)},${escape(l.href)},${l.isInternal ? "Internal" : "External"}`);
        });
      }
    });
    downloadCSV(rows.join("\n"), `${domain}-internal-links`);
    toast({ title: "Downloaded!", description: "Internal links CSV saved" });
  };

  const filters: { key: InternalLinksFilterType; label: string }[] = [
    { key: "all", label: "All Pages" },
    { key: "has-internal", label: "Has Internal Links" },
    { key: "has-external", label: "Has External Links" },
    { key: "no-links", label: "No Links" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
        <div className="flex gap-1.5 flex-wrap">
          {filters.map((f) => (
            <Button key={f.key} size="sm" variant={linkFilter === f.key ? "default" : "outline"} onClick={() => setLinkFilter(f.key)} className="text-[11px] h-7 px-2.5">
              {f.label}
            </Button>
          ))}
        </div>
        <div className="flex gap-1.5 items-center w-full sm:w-auto">
          <SearchBarWithGear
            search={search}
            setSearch={setSearch}
            placeholder="Filter URL, anchor text, link..."
            fields={linkFields}
            advancedFilter={advancedFilter}
            setAdvancedFilter={setAdvancedFilter}
          />
          <Button size="sm" variant="outline" onClick={handleCopy} className="h-7 gap-1 text-[11px] px-2.5">
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            Copy
          </Button>
          <Button size="sm" variant="outline" onClick={handleDownload} className="h-7 gap-1 text-[11px] px-2.5">
            <Download className="h-3 w-3" /> CSV
          </Button>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">{filteredResults.length} pages</p>

      <div className="border border-border rounded-lg overflow-hidden bg-card">
        <div className="grid grid-cols-[2fr_80px_80px_1fr] gap-0 border-b border-border bg-muted/30 text-[11px] font-medium text-muted-foreground">
          <div className="px-3 py-2">Page URL</div>
          <div className="px-3 py-2 text-center">Internal</div>
          <div className="px-3 py-2 text-center">External</div>
          <div className="px-3 py-2">Summary</div>
        </div>

        <div className="overflow-auto max-h-[600px] divide-y divide-border">
          {filteredResults.length === 0 ? (
            <div className="px-3 py-6 text-center text-[11px] text-muted-foreground">No results</div>
          ) : (
            filteredResults.map((row, index) => {
              const links = row.internalLinks ?? [];
              const internalCount = links.filter((l) => l.isInternal).length;
              const externalCount = links.filter((l) => !l.isInternal).length;
              const isExpanded = expandedRows.has(index);

              return (
                <div key={index}>
                  <button className="w-full grid grid-cols-[2fr_80px_80px_1fr] gap-0 hover:bg-muted/20 transition-colors text-left" onClick={() => links.length > 0 && toggleRow(index)}>
                    <div className="px-3 py-2 font-mono text-[11px] text-muted-foreground break-all">{row.url}</div>
                    <div className="px-3 py-2 text-center text-[11px] font-medium">
                      {internalCount > 0 ? (
                        <span className="text-success">{internalCount}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                    <div className="px-3 py-2 text-center text-[11px] font-medium">
                      {externalCount > 0 ? (
                        <span className="text-primary">{externalCount}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                    <div className="px-3 py-2 text-[11px]">
                      {links.length === 0 ? (
                        <span className="text-muted-foreground italic">No content links found</span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <span className="text-muted-foreground">{links.length} links in main content</span>
                          <span className="text-muted-foreground ml-auto text-[10px]">{isExpanded ? "▲" : "▼"}</span>
                        </span>
                      )}
                    </div>
                  </button>

                  {isExpanded && links.length > 0 && (
                    <div className="bg-muted/10 border-t border-border">
                      <div className="px-6 py-2">
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="text-muted-foreground">
                              <th className="text-left py-1 font-medium w-16">Type</th>
                              <th className="text-left py-1 font-medium">Anchor Text</th>
                              <th className="text-left py-1 font-medium">Link URL</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/30">
                            {links.map((link, lIdx) => (
                              <tr key={lIdx} className="hover:bg-muted/20">
                                <td className="py-1.5">
                                  <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                    link.isInternal ? "bg-success/15 text-success" : "bg-primary/10 text-primary"
                                  }`}>
                                    {link.isInternal ? (
                                      <><LinkIcon className="h-2.5 w-2.5" /> Int</>
                                    ) : (
                                      <><ExternalLink className="h-2.5 w-2.5" /> Ext</>
                                    )}
                                  </span>
                                </td>
                                <td className="py-1.5 break-words pr-3">{link.anchorText}</td>
                                <td className="py-1.5 font-mono text-muted-foreground break-all">
                                  <a href={link.href} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
                                    {link.href.length > 80 ? link.href.slice(0, 80) + '…' : link.href}
                                  </a>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
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

/**
 * Inline character-count badge shown beneath Meta Title / Meta Description.
 * Color-codes against an "ideal" length range so users can spot truncation
 * or under-optimised tags at a glance.
 */
function CharCountBadge({ len, ideal }: { len: number; ideal: [number, number] }) {
  const [min, max] = ideal;
  const ok = len >= min && len <= max;
  const tooLong = len > max;
  const tooShort = len < min;
  const cls = ok
    ? "bg-success/15 text-success border-success/30"
    : tooLong
    ? "bg-destructive/15 text-destructive border-destructive/30"
    : "bg-warning/15 text-warning border-warning/30";
  const hint = ok
    ? `Ideal (${min}–${max} chars)`
    : tooLong
    ? `Too long — over ${max} chars may truncate in SERPs`
    : tooShort
    ? `Short — under ${min} chars wastes SERP real estate`
    : "";
  return (
    <span
      title={hint}
      className={`inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded border tabular-nums ${cls}`}
    >
      {len} chars
    </span>
  );
}
