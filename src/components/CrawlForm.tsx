import { useState, useRef } from "react";
import { Search, Globe, List, Upload, X, FileSpreadsheet, Pause, Play, Network, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import * as XLSX from "xlsx";
import type { CrawlConfig } from "@/components/CrawlConfigDialog";

interface CrawlFormProps {
  config: CrawlConfig;
  onOpenConfig: () => void;
  onCrawl: (url: string, c: CrawlConfig) => void;
  onCrawlUrls: (urls: string[], c: CrawlConfig) => void;
  onSpiderSite: (url: string, c: CrawlConfig) => void;
  isLoading: boolean;
  isPaused: boolean;
  onReset: () => void;
  onPause: () => void;
  onResume: () => void;
}

function parseUrlsFromText(text: string): string[] {
  const seen = new Set<string>();
  return text
    .split(/\n/)
    .map((u) => u.trim())
    .filter((u) => u.length > 0 && (u.startsWith("http://") || u.startsWith("https://")))
    .filter((u) => { if (seen.has(u)) return false; seen.add(u); return true; });
}

function extractUrlsFromRows(rows: unknown[][]): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const row of rows) {
    for (const cell of row) {
      const val = String(cell ?? "").trim();
      if (val.startsWith("http://") || val.startsWith("https://")) {
        if (!seen.has(val)) { seen.add(val); urls.push(val); }
        break;
      }
    }
  }
  return urls;
}

export function CrawlForm({
  config, onOpenConfig, onCrawl, onCrawlUrls, onSpiderSite,
  isLoading, isPaused, onReset, onPause, onResume,
}: CrawlFormProps) {
  const [sitemapUrl, setSitemapUrl] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [urlText, setUrlText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileUrls, setFileUrls] = useState<string[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("sitemap");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const enabledCount = Object.values(config).filter(Boolean).length;

  const handleSitemapSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sitemapUrl.trim()) return;
    onCrawl(sitemapUrl.trim(), config);
  };
  const handleUrlsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const urls = parseUrlsFromText(urlText);
    if (urls.length === 0) return;
    onCrawlUrls(urls, config);
  };
  const handleSiteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteUrl.trim()) return;
    onSpiderSite(siteUrl.trim(), config);
  };
  const handleFileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (fileUrls.length === 0) return;
    onCrawlUrls(fileUrls, config);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    setFileUrls([]);
    setFileName(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    setFileName(file.name);

    if (ext === "csv" || ext === "txt") {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        const rows = text.split(/\n/).map((line) => line.split(","));
        let urls = extractUrlsFromRows(rows);
        if (urls.length === 0) urls = parseUrlsFromText(text);
        if (urls.length === 0) {
          setFileError("No valid URLs found. Make sure the file contains URLs starting with http:// or https://");
        } else {
          setFileUrls(urls);
        }
      };
      reader.readAsText(file);
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = new Uint8Array(ev.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          const urls = extractUrlsFromRows(rows);
          if (urls.length === 0) {
            setFileError("No valid URLs found. Make sure cells contain URLs starting with http:// or https://");
          } else {
            setFileUrls(urls);
          }
        } catch {
          setFileError("Failed to parse the Excel file. Please check the format.");
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      setFileError("Unsupported file type. Please upload .csv, .txt, .xlsx, or .xls");
      setFileName(null);
    }
    e.target.value = "";
  };

  const handleCancelOrReset = () => {
    onReset();
    setSitemapUrl(""); setSiteUrl(""); setUrlText("");
    setFileName(null); setFileUrls([]); setFileError(null);
  };

  // Configuration button shown above the action button row
  const ConfigBar = (
    <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onOpenConfig}
        disabled={isLoading}
        className="h-8 text-xs gap-1.5"
      >
        <Settings2 className="h-3.5 w-3.5" />
        Crawl Configuration
        <span className="ml-1 text-[10px] tabular-nums px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
          {enabledCount}
        </span>
      </Button>
      <span className="text-[11px] text-muted-foreground hidden sm:inline">
        Choose what to extract during the crawl
      </span>
    </div>
  );

  const ActionButtons = (submitDisabled = false, submitLabel = "Crawl") => (
    isLoading ? (
      <div className="flex gap-1.5">
        {isPaused ? (
          <Button type="button" onClick={onResume} className="h-9 px-3 text-xs gap-1.5 shrink-0">
            <Play className="h-3 w-3" /> Resume
          </Button>
        ) : (
          <Button type="button" variant="secondary" onClick={onPause} className="h-9 px-3 text-xs gap-1.5 shrink-0">
            <Pause className="h-3 w-3" /> Pause
          </Button>
        )}
        <Button type="button" variant="outline" onClick={handleCancelOrReset} className="h-9 px-3 text-xs shrink-0">
          Cancel
        </Button>
      </div>
    ) : (
      <Button type="submit" disabled={submitDisabled} className="h-9 px-4 text-xs font-medium gap-1.5 shrink-0">
        <Search className="h-3 w-3" />
        {submitLabel}
      </Button>
    )
  );

  return (
    <div className="w-full">
      <Tabs value={activeTab} onValueChange={(v) => { if (!isLoading) setActiveTab(v); }}>
        <TabsList className="w-full mb-3 grid grid-cols-4 h-9 bg-muted/50">
          <TabsTrigger value="sitemap" className="gap-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Globe className="h-3 w-3" /> Sitemap
          </TabsTrigger>
          <TabsTrigger value="site" className="gap-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Network className="h-3 w-3" /> Site
          </TabsTrigger>
          <TabsTrigger value="urls" className="gap-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <List className="h-3 w-3" /> URLs
          </TabsTrigger>
          <TabsTrigger value="file" className="gap-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Upload className="h-3 w-3" /> Upload
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sitemap" className="mt-0">
          <form onSubmit={handleSitemapSubmit}>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="text"
                  value={sitemapUrl}
                  onChange={(e) => setSitemapUrl(e.target.value)}
                  placeholder="https://example.com/sitemap.xml"
                  className="pl-8 h-9 bg-background border-border font-mono text-xs"
                  disabled={isLoading}
                />
              </div>
              {ActionButtons(false, "Crawl")}
            </div>
            {ConfigBar}
          </form>
        </TabsContent>

        <TabsContent value="site" className="mt-0">
          <form onSubmit={handleSiteSubmit}>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Network className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="text"
                  value={siteUrl}
                  onChange={(e) => setSiteUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="pl-8 h-9 bg-background border-border font-mono text-xs"
                  disabled={isLoading}
                />
              </div>
              {ActionButtons(false, "Crawl")}
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground/70">
              Discovers all internal URLs by following <code className="font-mono">&lt;a href&gt;</code> links from the homepage — no sitemap needed.
            </p>
            {ConfigBar}
          </form>
        </TabsContent>

        <TabsContent value="urls" className="mt-0">
          <form onSubmit={handleUrlsSubmit}>
            <Textarea
              value={urlText}
              onChange={(e) => setUrlText(e.target.value)}
              placeholder={"https://example.com/page-1\nhttps://example.com/page-2\nhttps://example.com/page-3"}
              className="font-mono text-xs min-h-[80px] bg-background border-border resize-none"
              disabled={isLoading}
            />
            <div className="flex items-center justify-between mt-2">
              <p className="text-[11px] text-muted-foreground">
                {urlText.trim() ? `${parseUrlsFromText(urlText).length} URL(s) detected` : "One URL per line"}
              </p>
              {ActionButtons(parseUrlsFromText(urlText).length === 0, `Crawl${parseUrlsFromText(urlText).length > 0 ? ` ${parseUrlsFromText(urlText).length} URLs` : ""}`)}
            </div>
            {ConfigBar}
          </form>
        </TabsContent>

        <TabsContent value="file" className="mt-0">
          <form onSubmit={handleFileSubmit}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,.xlsx,.xls"
              className="hidden"
              onChange={handleFileChange}
              disabled={isLoading}
            />
            {!fileName ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="w-full border border-dashed border-border rounded-lg p-5 flex flex-col items-center gap-1.5 text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileSpreadsheet className="h-5 w-5 opacity-40" />
                <span className="text-xs font-medium">Upload CSV, TXT or Excel</span>
                <span className="text-[11px] opacity-60">.csv · .txt · .xlsx · .xls</span>
              </button>
            ) : (
              <div className="border border-border rounded-lg p-3 bg-background flex items-center gap-3">
                <FileSpreadsheet className="h-6 w-6 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{fileName}</p>
                  {fileError ? (
                    <p className="text-[11px] text-destructive">{fileError}</p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">{fileUrls.length} URL(s) found</p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => { setFileName(null); setFileUrls([]); setFileError(null); }}
                  disabled={isLoading}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            <div className="flex items-center justify-between mt-2">
              <p className="text-[11px] text-muted-foreground">First column with URLs will be used</p>
              {ActionButtons(fileUrls.length === 0 || !!fileError, `Crawl${fileUrls.length > 0 ? ` ${fileUrls.length} URLs` : ""}`)}
            </div>
            {ConfigBar}
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
