import { useState, useRef } from "react";
import { Search, Globe, List, Upload, X, FileSpreadsheet, Heading1 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import * as XLSX from "xlsx";

interface CrawlFormProps {
  onCrawl: (url: string, includeH1: boolean) => void;
  onCrawlUrls: (urls: string[], includeH1: boolean) => void;
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

/** Extract one URL per row (first URL found in the row), then deduplicate. */
function extractUrlsFromRows(rows: unknown[][]): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const row of rows) {
    for (const cell of row) {
      const val = String(cell ?? "").trim();
      if (val.startsWith("http://") || val.startsWith("https://")) {
        if (!seen.has(val)) {seen.add(val);urls.push(val);}
        break; // only first URL per row
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSitemapSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sitemapUrl.trim()) return;
    onCrawl(sitemapUrl.trim(), includeH1);
  };

  const handleUrlsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const urls = parseUrlsFromText(urlText);
    if (urls.length === 0) return;
    onCrawlUrls(urls, includeH1);
  };

  const handleFileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (fileUrls.length === 0) return;
    onCrawlUrls(fileUrls, includeH1);
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

  /** Shared H1 toggle shown below every tab */
  const H1Toggle =
  <div className="gap-2 mt-2 px-1 items-center justify-center flex flex-row border-t border-border/40 pt-2.5">
      <Checkbox
      id="include-h1"
      checked={includeH1}
      onCheckedChange={(v) => setIncludeH1(!!v)}
      disabled={isLoading} />
      <Label
      htmlFor="include-h1"
      className="flex items-center gap-1.5 text-xs cursor-pointer select-none text-muted-foreground hover:text-foreground transition-colors">
        <Heading1 className="h-3 w-3" />
        Also extract &lt;H1&gt; tags from each page.
      </Label>
    </div>;


  return (
    <motion.div
      className="w-full max-w-2xl mx-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}>
      
      <Tabs value={activeTab} onValueChange={(v) => {if (!isLoading) setActiveTab(v);}}>
        <TabsList className="w-full mb-3 grid grid-cols-3">
          <TabsTrigger value="sitemap" className="gap-1.5 text-xs sm:text-sm">
            <Globe className="h-3.5 w-3.5" />
            Sitemap URL
          </TabsTrigger>
          <TabsTrigger value="urls" className="gap-1.5 text-xs sm:text-sm">
            <List className="h-3.5 w-3.5" />
            Enter URLs
          </TabsTrigger>
          <TabsTrigger value="file" className="gap-1.5 text-xs sm:text-sm">
            <Upload className="h-3.5 w-3.5" />
            Upload File
          </TabsTrigger>
        </TabsList>

        {/* ── Sitemap tab ── */}
        <TabsContent value="sitemap">
          <form onSubmit={handleSitemapSubmit}>
            <div className="flex gap-2.5">
              <div className="relative flex-1">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  value={sitemapUrl}
                  onChange={(e) => setSitemapUrl(e.target.value)}
                  placeholder="https://example.com/sitemap.xml"
                  className="pl-9 h-10 bg-card border-border/60 focus-visible:ring-primary/40 font-mono text-sm"
                  disabled={isLoading} />
              </div>
              {isLoading ?
              <Button type="button" variant="outline" onClick={handleCancelOrReset} className="h-10 px-5">
                  Cancel
                </Button> :
              <Button type="submit" className="h-10 px-6 glow font-semibold gap-2 shrink-0">
                  <Search className="h-4 w-4" />
                  Crawl
                </Button>
              }
            </div>
            <p className="text-muted-foreground mt-1.5 text-center text-xs">
              Enter a sitemap.xml URL to extract all URLs with meta titles and descriptions
            </p>
            {H1Toggle}
          </form>
        </TabsContent>

        {/* ── Enter URLs tab ── */}
        <TabsContent value="urls">
          <form onSubmit={handleUrlsSubmit}>
            <Textarea
              value={urlText}
              onChange={(e) => setUrlText(e.target.value)}
              placeholder={"https://example.com/page-1\nhttps://example.com/page-2\nhttps://example.com/page-3"}
              className="font-mono text-sm min-h-[130px] bg-card border-border/60 focus-visible:ring-primary/40 resize-none"
              disabled={isLoading} />
            
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs text-muted-foreground">
                {urlText.trim() ?
                `${parseUrlsFromText(urlText).length} valid URL(s) detected` :
                "Paste one URL per line (must start with http:// or https://)"}
              </p>
              {isLoading ?
              <Button type="button" variant="outline" onClick={handleCancelOrReset} className="px-6">
                  Cancel
                </Button> :

              <Button
                type="submit"
                className="glow font-semibold gap-2"
                disabled={parseUrlsFromText(urlText).length === 0}>
                
                  <Search className="h-4 w-4" />
                  Crawl {parseUrlsFromText(urlText).length > 0 ? `${parseUrlsFromText(urlText).length} URLs` : ""}
                </Button>
              }
            </div>
            {H1Toggle}
          </form>
        </TabsContent>

        {/* ── Upload File tab ── */}
        <TabsContent value="file">
          <form onSubmit={handleFileSubmit}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={handleFileChange}
              disabled={isLoading} />
            

            {!fileName ?
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="w-full border-2 border-dashed border-border/60 rounded-lg p-10 flex flex-col items-center gap-3 text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
              
                <FileSpreadsheet className="h-10 w-10 opacity-50" />
                <span className="text-sm font-medium">Click to upload CSV or Excel file</span>
                <span className="text-xs">.csv · .xlsx · .xls — one URL per row</span>
              </button> :

            <div className="border border-border/60 rounded-lg p-4 bg-card flex items-center gap-3">
                <FileSpreadsheet className="h-8 w-8 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{fileName}</p>
                  {fileError ?
                <p className="text-xs text-destructive">{fileError}</p> :

                <p className="text-xs text-muted-foreground">{fileUrls.length} valid URL(s) found</p>
                }
                </div>
                <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => {setFileName(null);setFileUrls([]);setFileError(null);}}
                disabled={isLoading}>
                
                  <X className="h-4 w-4" />
                </Button>
              </div>
            }

            <div className="flex items-center justify-between mt-3">
              <p className="text-xs text-muted-foreground">
                First column with valid URLs will be used
              </p>
              {isLoading ?
              <Button type="button" variant="outline" onClick={handleCancelOrReset} className="px-6">
                  Cancel
                </Button> :

              <Button
                type="submit"
                className="glow font-semibold gap-2"
                disabled={fileUrls.length === 0 || !!fileError}>
                
                  <Search className="h-4 w-4" />
                  Crawl {fileUrls.length > 0 ? `${fileUrls.length} URLs` : ""}
                </Button>
              }
            </div>
            {H1Toggle}
          </form>
        </TabsContent>
      </Tabs>
    </motion.div>);

}