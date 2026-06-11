import { useEffect, useMemo, useState } from "react";
import {
  Share2, Copy, FileDown, AlertTriangle, CheckCircle2, Plus, Trash2,
  Facebook, Twitter, Wand2, Layers, Image as ImageIcon, Eye, Code2, Search,
} from "lucide-react";
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
import {
  FacebookPreview, TwitterPreview, LinkedInPreview,
  parseSocialHtml, ogToPreview, twitterToPreview,
  type SocialPreviewData,
} from "./SocialPreviews";

interface Props {
  results: CrawlResult[];
}

interface SocialEntry {
  id: string;
  url: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  twitterTitle: string;
  twitterDescription: string;
  twitterImage: string;
  cardType: "summary" | "summary_large_image";
}

const escAttr = (s: string) =>
  (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

function buildOgTags(e: SocialEntry): string {
  const parts: string[] = [];
  parts.push(`<meta property="og:title" content="${escAttr(e.ogTitle)}" />`);
  parts.push(`<meta property="og:description" content="${escAttr(e.ogDescription)}" />`);
  parts.push(`<meta property="og:url" content="${escAttr(e.url)}" />`);
  if (e.ogImage) parts.push(`<meta property="og:image" content="${escAttr(e.ogImage)}" />`);
  parts.push(`<meta property="og:type" content="website" />`);
  return parts.join("\n");
}

function hasTwitterData(e: SocialEntry): boolean {
  return Boolean(
    (e.twitterTitle && e.twitterTitle.trim()) ||
    (e.twitterDescription && e.twitterDescription.trim()) ||
    (e.twitterImage && e.twitterImage.trim())
  );
}

function buildTwitterTags(e: SocialEntry): string {
  if (!hasTwitterData(e)) return "";
  const parts: string[] = [];
  parts.push(`<meta name="twitter:card" content="${e.cardType}" />`);
  if (e.twitterTitle.trim())
    parts.push(`<meta name="twitter:title" content="${escAttr(e.twitterTitle)}" />`);
  if (e.twitterDescription.trim())
    parts.push(`<meta name="twitter:description" content="${escAttr(e.twitterDescription)}" />`);
  parts.push(`<meta name="twitter:url" content="${escAttr(e.url)}" />`);
  if (e.twitterImage.trim())
    parts.push(`<meta name="twitter:image" content="${escAttr(e.twitterImage)}" />`);
  return parts.join("\n");
}

function buildAllTags(e: SocialEntry): string {
  const og = buildOgTags(e);
  const tw = buildTwitterTags(e);
  return tw ? `${og}\n${tw}` : og;
}

function validate(e: SocialEntry): { ok: boolean; warnings: string[] } {
  const w: string[] = [];
  try { new URL(e.url); } catch { w.push("Invalid URL"); }
  if (!e.ogTitle.trim() && !e.twitterTitle.trim()) w.push("Missing title");
  if (e.ogTitle.length > 70) w.push("OG title >70 chars");
  if (e.twitterTitle.length > 70) w.push("Twitter title >70 chars");
  if (!e.ogDescription.trim() && !e.twitterDescription.trim()) w.push("Missing description");
  if (e.ogDescription.length > 200) w.push("OG description >200 chars");
  if (e.twitterDescription.length > 200) w.push("Twitter description >200 chars");
  if (!e.ogImage && !e.twitterImage) w.push("Missing image (recommended 1200×630)");
  return { ok: w.length === 0, warnings: w };
}

function entryFromResult(r: CrawlResult, defaults: { image: string; cardType: SocialEntry["cardType"] }): SocialEntry {
  const fallbackTitle = r.title || (r.h1s ?? [])[0] || r.url;
  return {
    id: `${r.url}-${Math.random().toString(36).slice(2, 7)}`,
    url: r.url,
    ogTitle: r.title || fallbackTitle,
    ogDescription: r.description || "",
    ogImage: defaults.image,
    twitterTitle: "",
    twitterDescription: "",
    twitterImage: "",
    cardType: defaults.cardType,
  };
}

function blankEntry(defaults: { image: string; cardType: SocialEntry["cardType"] }, url = ""): SocialEntry {
  return {
    id: `new-${Math.random().toString(36).slice(2, 9)}`,
    url,
    ogTitle: "",
    ogDescription: "",
    ogImage: defaults.image,
    twitterTitle: "",
    twitterDescription: "",
    twitterImage: defaults.image,
    cardType: defaults.cardType,
  };
}

export function SocialTagGenerator({ results }: Props) {
  const [mode, setMode] = useState<"individual" | "bulk">("individual");
  const [defaultImage, setDefaultImage] = useState("");
  const [cardType, setCardType] = useState<SocialEntry["cardType"]>("summary_large_image");
  const [entries, setEntries] = useState<SocialEntry[]>([
    blankEntry({ image: "", cardType: "summary_large_image" }),
  ]);

  // Bulk mode shared fields
  const [bulkText, setBulkText] = useState("");
  const [bulkTitle, setBulkTitle] = useState("");
  const [bulkDescription, setBulkDescription] = useState("");
  const [bulkImage, setBulkImage] = useState("");

  const updateEntry = (id: string, patch: Partial<SocialEntry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const addEntry = () => {
    setEntries((prev) => [...prev, blankEntry({ image: defaultImage, cardType })]);
  };

  const removeEntry = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const importFromCrawl = () => {
    const ok = results.filter((r) => r.statusCode >= 200 && r.statusCode < 300);
    if (ok.length === 0) {
      toast({ title: "Nothing to import", description: "Run a crawl first." });
      return;
    }
    setEntries(ok.map((r) => entryFromResult(r, { image: defaultImage, cardType })));
    toast({ title: "Imported", description: `${ok.length} pages loaded as editable rows.` });
  };

  // Bulk mode generates entries on the fly
  const bulkEntries: SocialEntry[] = useMemo(() => {
    if (mode !== "bulk") return [];
    return bulkText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((url) => ({
        id: `bulk-${url}`,
        url,
        ogTitle: bulkTitle,
        ogDescription: bulkDescription,
        ogImage: bulkImage,
        twitterTitle: bulkTitle,
        twitterDescription: bulkDescription,
        twitterImage: bulkImage,
        cardType,
      }));
  }, [mode, bulkText, bulkTitle, bulkDescription, bulkImage, cardType]);

  const activeEntries = mode === "individual" ? entries : bulkEntries;
  const validations = activeEntries.map(validate);
  const okCount = validations.filter((v) => v.ok).length;

  const copyEntryOg = (e: SocialEntry) => {
    navigator.clipboard.writeText(buildOgTags(e));
    toast({ title: "OG tags copied", description: e.url || "(no URL)" });
  };

  const copyEntryTwitter = (e: SocialEntry) => {
    navigator.clipboard.writeText(buildTwitterTags(e));
    toast({ title: "Twitter tags copied", description: e.url || "(no URL)" });
  };

  const copyEntryAll = (e: SocialEntry) => {
    navigator.clipboard.writeText(buildAllTags(e));
    toast({ title: "All tags copied", description: e.url || "(no URL)" });
  };

  const copyAll = () => {
    const out = activeEntries
      .map((e) => `<!-- ${e.url} -->\n${buildAllTags(e)}`)
      .join("\n\n");
    navigator.clipboard.writeText(out);
    toast({ title: "Copied", description: `Tags for ${activeEntries.length} URLs copied.` });
  };

  const exportTsv = () => {
    const rows = activeEntries.map((e) => [
      e.url, e.ogTitle, e.ogDescription, e.ogImage,
      e.twitterTitle, e.twitterDescription, e.twitterImage,
      e.cardType, buildAllTags(e),
    ]);
    const tsv = rowsToTSV(
      ["URL", "OG Title", "OG Description", "OG Image", "Twitter Title", "Twitter Description", "Twitter Image", "Card Type", "HTML Tags"],
      rows
    );
    const blob = new Blob([tsv], { type: "text/tab-separated-values;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `og-twitter-tags-${Date.now()}.tsv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Auto-fill blank fields when default image / card type changes (individual mode)
  useEffect(() => {
    setEntries((prev) =>
      prev.map((e) => ({
        ...e,
        ogImage: e.ogImage || defaultImage,
        twitterImage: e.twitterImage || defaultImage,
        cardType,
      }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultImage, cardType]);

  return (
    <div className="space-y-3">
      {/* Header card */}
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-2 mb-3">
          <Share2 className="h-4 w-4 text-warning" />
          <h3 className="text-sm font-semibold">OG &amp; Twitter Card generator</h3>
          <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal ml-auto">
            {activeEntries.length} URL{activeEntries.length === 1 ? "" : "s"} · {okCount} valid
          </Badge>
        </div>

        <Tabs value={mode} onValueChange={(v) => setMode(v as "individual" | "bulk")}>
          <TabsList className="h-8">
            <TabsTrigger value="individual" className="text-xs h-6 gap-1">
              <Layers className="h-3 w-3" /> Individual
            </TabsTrigger>
            <TabsTrigger value="bulk" className="text-xs h-6 gap-1">
              <Wand2 className="h-3 w-3" /> Bulk
            </TabsTrigger>
          </TabsList>

          <TabsContent value="individual" className="mt-3 space-y-3">
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-[11px] text-muted-foreground">Default OG image (auto-fills new rows)</Label>
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
                  onChange={(e) => setCardType(e.target.value as SocialEntry["cardType"])}
                  className="h-8 w-full text-xs mt-1 rounded-md border border-border bg-background px-2"
                >
                  <option value="summary_large_image">summary_large_image</option>
                  <option value="summary">summary</option>
                </select>
              </div>
              <div className="flex items-end gap-2">
                <Button variant="outline" size="sm" className="h-8 text-xs flex-1" onClick={importFromCrawl} disabled={results.length === 0}>
                  Import from crawl ({results.length})
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={addEntry}>
                  <Plus className="h-3 w-3 mr-1" /> Add URL
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="bulk" className="mt-3 space-y-3">
            <p className="text-[11px] text-muted-foreground">
              Apply one shared title, description, and image to many URLs at once. One URL per line.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] text-muted-foreground">URLs (one per line)</Label>
                <Textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={`https://example.com/page-1\nhttps://example.com/page-2`}
                  className="font-mono text-xs h-32 mt-1"
                />
              </div>
              <div className="space-y-2">
                <div>
                  <Label className="text-[11px] text-muted-foreground">Shared title</Label>
                  <Input value={bulkTitle} onChange={(e) => setBulkTitle(e.target.value)} className="h-8 text-xs mt-1" />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Shared description</Label>
                  <Input value={bulkDescription} onChange={(e) => setBulkDescription(e.target.value)} className="h-8 text-xs mt-1" />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Shared image URL</Label>
                  <Input value={bulkImage} onChange={(e) => setBulkImage(e.target.value)} placeholder="https://cdn.example.com/og.png" className="h-8 text-xs mt-1" />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Card type</Label>
                  <select
                    value={cardType}
                    onChange={(e) => setCardType(e.target.value as SocialEntry["cardType"])}
                    className="h-8 w-full text-xs mt-1 rounded-md border border-border bg-background px-2"
                  >
                    <option value="summary_large_image">summary_large_image</option>
                    <option value="summary">summary</option>
                  </select>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Per-URL editable rows (individual mode) */}
      {mode === "individual" && (
        <div className="space-y-3">
          {entries.map((e, i) => {
            const v = validations[i];
            return (
              <div key={e.id} className="rounded-lg border border-border bg-card overflow-hidden">
                <div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal">#{i + 1}</Badge>
                  {v.ok ? (
                    <Badge className="text-[10px] h-4 px-1.5 font-normal bg-success/10 text-success border-transparent">
                      <CheckCircle2 className="h-2.5 w-2.5 mr-1" /> Valid
                    </Badge>
                  ) : (
                    <Badge className="text-[10px] h-4 px-1.5 font-normal bg-warning/10 text-warning border-transparent">
                      <AlertTriangle className="h-2.5 w-2.5 mr-1" /> {v.warnings.length} issue{v.warnings.length === 1 ? "" : "s"}
                    </Badge>
                  )}
                  <div className="ml-auto flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => copyEntryOg(e)}>
                      <Facebook className="h-3 w-3 mr-1" /> Copy OG
                    </Button>
                    <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => copyEntryTwitter(e)}>
                      <Twitter className="h-3 w-3 mr-1" /> Copy Twitter
                    </Button>
                    <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => copyEntryAll(e)}>
                      <Copy className="h-3 w-3 mr-1" /> Copy all
                    </Button>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => removeEntry(e.id)} aria-label="Remove URL">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <div className="p-3 space-y-3">
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Page URL</Label>
                    <Input
                      value={e.url}
                      onChange={(ev) => updateEntry(e.id, { url: ev.target.value })}
                      placeholder="https://example.com/page"
                      className="h-8 text-xs mt-1 font-mono"
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-3">
                    {/* OG column */}
                    <div className="rounded-md border border-border p-3 space-y-2 bg-muted/10">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground/80">
                        <Facebook className="h-3 w-3 text-primary" /> Open Graph
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">og:title</Label>
                        <Input value={e.ogTitle} onChange={(ev) => updateEntry(e.id, { ogTitle: ev.target.value })} className="h-7 text-xs mt-0.5" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">og:description</Label>
                        <Textarea value={e.ogDescription} onChange={(ev) => updateEntry(e.id, { ogDescription: ev.target.value })} className="text-xs mt-0.5 h-16" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">og:image</Label>
                        <Input value={e.ogImage} onChange={(ev) => updateEntry(e.id, { ogImage: ev.target.value })} placeholder="https://cdn.example.com/og.png" className="h-7 text-xs mt-0.5 font-mono" />
                        <ImagePreview src={e.ogImage} />
                      </div>
                    </div>

                    {/* Twitter column */}
                    <div className="rounded-md border border-border p-3 space-y-2 bg-muted/10">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground/80">
                          <Twitter className="h-3 w-3 text-foreground" /> Twitter Card
                        </div>
                        <select
                          value={e.cardType}
                          onChange={(ev) => updateEntry(e.id, { cardType: ev.target.value as SocialEntry["cardType"] })}
                          className="h-6 text-[10px] rounded border border-border bg-background px-1"
                        >
                          <option value="summary_large_image">summary_large_image</option>
                          <option value="summary">summary</option>
                        </select>
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">twitter:title</Label>
                        <Input value={e.twitterTitle} onChange={(ev) => updateEntry(e.id, { twitterTitle: ev.target.value })} className="h-7 text-xs mt-0.5" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">twitter:description</Label>
                        <Textarea value={e.twitterDescription} onChange={(ev) => updateEntry(e.id, { twitterDescription: ev.target.value })} className="text-xs mt-0.5 h-16" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">twitter:image</Label>
                        <Input value={e.twitterImage} onChange={(ev) => updateEntry(e.id, { twitterImage: ev.target.value })} placeholder="https://cdn.example.com/og.png" className="h-7 text-xs mt-0.5 font-mono" />
                        <ImagePreview src={e.twitterImage} />
                      </div>
                    </div>
                  </div>

                  {!v.ok && (
                    <div className="text-[11px] text-warning flex items-start gap-1.5">
                      <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <span>{v.warnings.join(" · ")}</span>
                    </div>
                  )}

                  <details className="rounded border border-border bg-background">
                    <summary className="px-2 py-1 text-[11px] font-mono cursor-pointer text-muted-foreground hover:text-foreground">
                      Preview generated tags
                    </summary>
                    <pre className="px-3 py-2 text-[11px] font-mono whitespace-pre-wrap break-all text-foreground/85">
{buildAllTags(e)}
                    </pre>
                  </details>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bulk preview output */}
      {mode === "bulk" && bulkEntries.length > 0 && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal">{bulkEntries.length} URLs</Badge>
            <Badge className="text-[10px] h-4 px-1.5 font-normal bg-success/10 text-success border-transparent">
              <CheckCircle2 className="h-2.5 w-2.5 mr-1" /> {okCount} valid
            </Badge>
            <Button variant="ghost" size="sm" className="h-6 text-[11px] ml-auto" onClick={copyAll}>
              <Copy className="h-3 w-3 mr-1" /> Copy all
            </Button>
            <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={exportTsv}>
              <FileDown className="h-3 w-3 mr-1" /> Export TSV
            </Button>
          </div>
          <ScrollArea className="h-[420px]">
            <div className="divide-y divide-border">
              {bulkEntries.map((e) => (
                <div key={e.id} className="p-3 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-mono text-muted-foreground truncate">{e.url}</span>
                    <div className="ml-auto flex gap-1">
                      <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => copyEntryOg(e)}>OG</Button>
                      <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => copyEntryTwitter(e)}>Twitter</Button>
                      <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => copyEntryAll(e)}>All</Button>
                    </div>
                  </div>
                  <pre className="text-[11px] font-mono whitespace-pre-wrap break-all text-foreground/80 bg-muted/20 rounded p-2">
{buildAllTags(e)}
                  </pre>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Global actions for individual mode */}
      {mode === "individual" && entries.length > 0 && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={copyAll}>
            <Copy className="h-3 w-3 mr-1" /> Copy all rows
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={exportTsv}>
            <FileDown className="h-3 w-3 mr-1" /> Export TSV
          </Button>
        </div>
      )}
    </div>
  );
}

function ImagePreview({ src }: { src: string }) {
  if (!src) {
    return (
      <div className="mt-1 h-12 rounded border border-dashed border-border flex items-center justify-center text-[10px] text-muted-foreground gap-1">
        <ImageIcon className="h-3 w-3" /> No image
      </div>
    );
  }
  return (
    <div className="mt-1 h-16 rounded border border-border overflow-hidden bg-muted/20 flex items-center justify-center">
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <img
        src={src}
        className="max-h-full max-w-full object-contain"
        loading="lazy"
        onError={(ev) => {
          const el = ev.currentTarget as HTMLImageElement;
          el.style.display = "none";
          (el.parentElement as HTMLElement).innerHTML =
            '<span class="text-[10px] text-destructive">Image failed to load</span>';
        }}
      />
    </div>
  );
}
