import { useMemo, useState } from "react";
import { Share2, Copy, Download, FileDown, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { rowsToTSV } from "@/lib/crawl-api";
import type { CrawlResult } from "@/lib/crawl-api";
import { toast } from "@/hooks/use-toast";

interface Props {
  results: CrawlResult[];
}

interface SocialEntry {
  url: string;
  title: string;
  description: string;
  image: string;
  cardType: "summary" | "summary_large_image";
}

function buildTags(e: SocialEntry): string {
  const safe = (s: string) =>
    (s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const parts: string[] = [];
  parts.push(`<meta property="og:title" content="${safe(e.title)}" />`);
  parts.push(`<meta property="og:description" content="${safe(e.description)}" />`);
  parts.push(`<meta property="og:url" content="${safe(e.url)}" />`);
  if (e.image) parts.push(`<meta property="og:image" content="${safe(e.image)}" />`);
  parts.push(`<meta property="og:type" content="website" />`);
  parts.push(`<meta name="twitter:card" content="${e.cardType}" />`);
  parts.push(`<meta name="twitter:title" content="${safe(e.title)}" />`);
  parts.push(`<meta name="twitter:description" content="${safe(e.description)}" />`);
  if (e.image) parts.push(`<meta name="twitter:image" content="${safe(e.image)}" />`);
  return parts.join("\n");
}

function validate(e: SocialEntry): { ok: boolean; warnings: string[] } {
  const w: string[] = [];
  if (!e.title?.trim()) w.push("Missing title");
  else if (e.title.length > 70) w.push("Title > 70 chars (may truncate)");
  if (!e.description?.trim()) w.push("Missing description");
  else if (e.description.length > 200) w.push("Description > 200 chars");
  if (!e.image) w.push("Missing image (recommended 1200×630)");
  try { new URL(e.url); } catch { w.push("Invalid URL"); }
  return { ok: w.length === 0, warnings: w };
}

export function SocialTagGenerator({ results }: Props) {
  const [mode, setMode] = useState<"crawl" | "manual">(results.length > 0 ? "crawl" : "manual");
  const [manualText, setManualText] = useState("");
  const [defaultImage, setDefaultImage] = useState("");
  const [cardType, setCardType] = useState<"summary" | "summary_large_image">("summary_large_image");

  const entries: SocialEntry[] = useMemo(() => {
    if (mode === "crawl") {
      return results
        .filter((r) => r.statusCode >= 200 && r.statusCode < 300)
        .map((r) => ({
          url: r.url,
          title: r.title || (r.h1s ?? [])[0] || r.url,
          description: r.description || "",
          image: defaultImage,
          cardType,
        }));
    }
    // Manual: one URL per line, optional "URL | Title | Description"
    return manualText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [url, title = "", description = ""] = line.split("|").map((s) => s.trim());
        return { url, title, description, image: defaultImage, cardType };
      });
  }, [mode, results, manualText, defaultImage, cardType]);

  const validations = entries.map(validate);
  const okCount = validations.filter((v) => v.ok).length;

  const allTags = entries
    .map((e, i) => `<!-- ${e.url} -->\n${buildTags(e)}${validations[i].warnings.length ? `\n<!-- ⚠️ ${validations[i].warnings.join("; ")} -->` : ""}`)
    .join("\n\n");

  const handleCopyAll = () => {
    navigator.clipboard.writeText(allTags);
    toast({ title: "Copied", description: `Tags for ${entries.length} URLs copied.` });
  };

  const handleExportCsv = () => {
    const rows = entries.map((e) => [
      e.url, e.title, e.description, e.image, e.cardType, buildTags(e),
    ]);
    const tsv = rowsToTSV(["URL", "Title", "Description", "Image", "Card Type", "HTML Tags"], rows);
    const blob = new Blob([tsv], { type: "text/tab-separated-values;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `og-twitter-tags-${Date.now()}.tsv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-2 mb-3">
          <Share2 className="h-4 w-4 text-warning" />
          <h3 className="text-sm font-semibold">Bulk OG &amp; Twitter Card generator</h3>
        </div>

        <Tabs value={mode} onValueChange={(v) => setMode(v as "crawl" | "manual")}>
          <TabsList className="h-8">
            <TabsTrigger value="crawl" className="text-xs h-6" disabled={results.length === 0}>
              From crawl ({results.length})
            </TabsTrigger>
            <TabsTrigger value="manual" className="text-xs h-6">Manual URLs</TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="mt-3">
            <Label className="text-[11px] text-muted-foreground">
              One URL per line. Optional: <code>URL | Title | Description</code>
            </Label>
            <Textarea
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder={`https://example.com/page-1\nhttps://example.com/page-2 | About us | Learn what we do`}
              className="font-mono text-xs h-32 mt-1"
            />
          </TabsContent>

          <TabsContent value="crawl" className="mt-3">
            <p className="text-[11px] text-muted-foreground">
              Using titles &amp; descriptions from your crawl. Add a default image URL below if pages don't already have one.
            </p>
          </TabsContent>
        </Tabs>

        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <div>
            <Label className="text-[11px] text-muted-foreground">Default OG image URL (optional)</Label>
            <Input
              value={defaultImage}
              onChange={(e) => setDefaultImage(e.target.value)}
              placeholder="https://cdn.example.com/og.png"
              className="h-8 text-xs mt-1"
            />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Twitter card type</Label>
            <select
              value={cardType}
              onChange={(e) => setCardType(e.target.value as "summary" | "summary_large_image")}
              className="h-8 w-full text-xs mt-1 rounded-md border border-border bg-background px-2"
            >
              <option value="summary_large_image">summary_large_image</option>
              <option value="summary">summary</option>
            </select>
          </div>
        </div>
      </div>

      {entries.length > 0 && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal">
              {entries.length} URLs
            </Badge>
            <Badge className="text-[10px] h-4 px-1.5 font-normal bg-success/10 text-success border-transparent">
              <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
              {okCount} valid
            </Badge>
            {okCount < entries.length && (
              <Badge className="text-[10px] h-4 px-1.5 font-normal bg-warning/10 text-warning border-transparent">
                <AlertTriangle className="h-2.5 w-2.5 mr-1" />
                {entries.length - okCount} with warnings
              </Badge>
            )}
            <Button variant="ghost" size="sm" className="h-6 text-[11px] ml-auto" onClick={handleCopyAll}>
              <Copy className="h-3 w-3 mr-1" />
              Copy all
            </Button>
            <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={handleExportCsv}>
              <FileDown className="h-3 w-3 mr-1" />
              Export TSV
            </Button>
          </div>
          <ScrollArea className="h-[420px]">
            <pre className="p-3 text-[11px] font-mono whitespace-pre-wrap break-all text-foreground/85">
{allTags}
            </pre>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
