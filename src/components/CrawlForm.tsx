import { useState, useRef } from "react";
import { Search, Globe, List, Upload, X, FileSpreadsheet, Heading1, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import * as XLSX from "xlsx";

interface CrawlFormProps {
  onCrawl: (url: string, includeH1: boolean, includeH2: boolean, includeH3: boolean, includeImages: boolean) => void;
  onCrawlUrls: (urls: string[], includeH1: boolean, includeH2: boolean, includeH3: boolean, includeImages: boolean) => void;
  isLoading: boolean;
  onReset: () => void;
}

function parseUrlsFromText(text: string): string[] {
  const seen = new Set<string>();
  return text.
  split(/\n/).
  map((u) => u.trim()).
  filter((u) => u.length > 0 && (u.startsWith("http://") || u.startsWith("https://"))).
  filter((u) => {if (seen.has(u)) return false;seen.add(u);return true;});
}

function extractUrlsFromRows(rows: unknown[][]): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const row of rows) {
    for (const cell of row) {
      const val = String(cell ?? "").trim();
      if (val.startsWith("http://") || val.startsWith("https://")) {
        if (!seen.has(val)) {seen.add(val);urls.push(val);}
        break;
      }
    }
  }
  return urls;
}

export function CrawlForm({ onCrawl, onCrawlUrls, isLoading, onReset }: CrawlFormProps) {
  const [sitemapUrl, setSitemapUrl] = useState("");
  const [urlText, setUrlText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileUrls, setFileUrls] = useState<string[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("sitemap");
  const [includeH1, setIncludeH1] = useState(false);
  const [includeH2, setIncludeH2] = useState(false);
  const [includeH3, setIncludeH3] = useState(false);
  const [includeImages, setIncludeImages] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSitemapSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sitemapUrl.trim()) return;
    onCrawl(sitemapUrl.trim(), includeH1, includeH2, includeH3, includeImages);
  };

  const handleUrlsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const urls = parseUrlsFromText(urlText);
    if (urls.length === 0) return;
    onCrawlUrls(urls, includeH1, includeH2, includeH3, includeImages);
  };

  const handleFileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (fileUrls.length === 0) return;
    onCrawlUrls(fileUrls, includeH1, includeH2, includeH3, includeImages);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    setFileUrls([]);
    setFileName(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    setFileName(file.name);

    if (ext === "csv") {
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
      setFileError("Unsupported file type. Please upload a .csv, .xlsx, or .xls file.");
      setFileName(null);
    }

    e.target.value = "";
  };

  const handleCancelOrReset = () => {
    onReset();
    setSitemapUrl("");
    setUrlText("");
    setFileName(null);
    setFileUrls([]);
    setFileError(null);
  };

  const pillClass = (active: boolean) =>
    `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border cursor-pointer select-none text-xs font-medium transition-all duration-150
    ${active ? "border-foreground bg-foreground text-background" : "border-border bg-transparent text-muted-foreground hover:border-foreground/50 hover:text-foreground"}
    ${isLoading ? "opacity-50 pointer-events-none" : ""}`;

  const Toggles = (
    <div className="mt-3 pt-3 border-t border-border flex justify-center gap-2 flex-wrap">
      <Label htmlFor="include-h1" className={pillClass(includeH1)}>
        <Checkbox id="include-h1" checked={includeH1} onCheckedChange={(v) => setIncludeH1(!!v)} disabled={isLoading} className="hidden" />
        <Heading1 className="h-3.5 w-3.5" />
        &lt;H1&gt; tags
      </Label>

      <Label htmlFor="include-h2" className={pillClass(includeH2)}>
        <Checkbox id="include-h2" checked={includeH2} onCheckedChange={(v) => setIncludeH2(!!v)} disabled={isLoading} className="hidden" />
        <Heading1 className="h-3.5 w-3.5" />
        &lt;H2&gt; tags
      </Label>

      <Label htmlFor="include-h3" className={pillClass(includeH3)}>
        <Checkbox id="include-h3" checked={includeH3} onCheckedChange={(v) => setIncludeH3(!!v)} disabled={isLoading} className="hidden" />
        <Heading1 className="h-3.5 w-3.5" />
        &lt;H3&gt; tags
      </Label>

      <Label htmlFor="include-images" className={pillClass(includeImages)}>
        <Checkbox id="include-images" checked={includeImages} onCheckedChange={(v) => setIncludeImages(!!v)} disabled={isLoading} className="hidden" />
        <Image className="h-3.5 w-3.5" />
        Image alt texts
      </Label>
    </div>
  );

  return (
    <div className="w-full">
      <Tabs value={activeTab} onValueChange={(v) => {if (!isLoading) setActiveTab(v);}}>
        <TabsList className="w-full mb-3 grid grid-cols-3 h-9 bg-muted/50">
          <TabsTrigger value="sitemap" className="gap-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Globe className="h-3 w-3" />
            Sitemap
          </TabsTrigger>
          <TabsTrigger value="urls" className="gap-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <List className="h-3 w-3" />
            URLs
          </TabsTrigger>
          <TabsTrigger value="file" className="gap-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Upload className="h-3 w-3" />
            Upload
          </TabsTrigger>
        </TabsList>

        {/* ── Sitemap tab ── */}
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
              {isLoading ? (
                <Button type="button" variant="outline" onClick={handleCancelOrReset} className="h-9 px-4 text-xs">
                  Cancel
                </Button>
              ) : (
                <Button type="submit" className="h-9 px-4 text-xs font-medium gap-1.5 shrink-0">
                  <Search className="h-3 w-3" />
                  Crawl
                </Button>
              )}
            </div>
            {Toggles}
          </form>
        </TabsContent>

        {/* ── Enter URLs tab ── */}
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
                {urlText.trim()
                  ? `${parseUrlsFromText(urlText).length} URL(s) detected`
                  : "One URL per line"}
              </p>
              {isLoading ? (
                <Button type="button" variant="outline" onClick={handleCancelOrReset} className="px-4 h-8 text-xs">
                  Cancel
                </Button>
              ) : (
                <Button
                  type="submit"
                  className="font-medium gap-1.5 h-8 text-xs"
                  disabled={parseUrlsFromText(urlText).length === 0}
                >
                  <Search className="h-3 w-3" />
                  Crawl {parseUrlsFromText(urlText).length > 0 ? `${parseUrlsFromText(urlText).length} URLs` : ""}
                </Button>
              )}
            </div>
            {Toggles}
          </form>
        </TabsContent>

        {/* ── Upload File tab ── */}
        <TabsContent value="file" className="mt-0">
          <form onSubmit={handleFileSubmit}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
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
                <span className="text-xs font-medium">Upload CSV or Excel</span>
                <span className="text-[11px] opacity-60">.csv · .xlsx · .xls</span>
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
                  onClick={() => {setFileName(null);setFileUrls([]);setFileError(null);}}
                  disabled={isLoading}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            <div className="flex items-center justify-between mt-2">
              <p className="text-[11px] text-muted-foreground">
                First column with URLs will be used
              </p>
              {isLoading ? (
                <Button type="button" variant="outline" onClick={handleCancelOrReset} className="px-4 h-8 text-xs">
                  Cancel
                </Button>
              ) : (
                <Button
                  type="submit"
                  className="font-medium gap-1.5 h-8 text-xs"
                  disabled={fileUrls.length === 0 || !!fileError}
                >
                  <Search className="h-3 w-3" />
                  Crawl {fileUrls.length > 0 ? `${fileUrls.length} URLs` : ""}
                </Button>
              )}
            </div>
            {Toggles}
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
