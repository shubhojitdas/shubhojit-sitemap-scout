import { useMemo, useState } from "react";
import {
  Languages, Copy, FileDown, AlertTriangle, CheckCircle2, Plus, Trash2,
  Globe, Wand2, Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { rowsToTSV } from "@/lib/crawl-api";
import { toast } from "@/hooks/use-toast";

interface Alternate {
  id: string;
  language: string; // e.g. "en"
  country: string;  // e.g. "IN" (optional, blank = language only)
  href: string;
}

interface Cluster {
  id: string;
  canonical: string;
  alternates: Alternate[];
  xDefault: string; // URL for x-default; blank = use canonical
}

const LANG_RX = /^[a-z]{2,3}$/;
const COUNTRY_RX = /^[A-Z]{2}$/;

const newId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

function makeAlternate(language = "en", country = "", href = ""): Alternate {
  return { id: newId("alt"), language, country, href };
}

function makeCluster(canonical = ""): Cluster {
  return {
    id: newId("c"),
    canonical,
    alternates: [
      makeAlternate("en", "US", canonical),
      makeAlternate("en", "GB", ""),
    ],
    xDefault: "",
  };
}

function hreflangCode(a: Alternate): string {
  if (!a.language) return "";
  return a.country ? `${a.language}-${a.country}` : a.language;
}

function validateCluster(c: Cluster): { ok: boolean; warnings: string[] } {
  const w: string[] = [];
  if (!c.canonical) w.push("Missing canonical URL");
  else { try { new URL(c.canonical); } catch { w.push("Invalid canonical URL"); } }

  const seen = new Map<string, number>();
  for (const a of c.alternates) {
    if (!a.language && !a.country && !a.href) continue;
    if (!LANG_RX.test(a.language)) w.push(`Invalid language code: "${a.language}"`);
    if (a.country && !COUNTRY_RX.test(a.country)) w.push(`Invalid country code: "${a.country}" (use ISO 3166-1 alpha-2)`);
    try { new URL(a.href); } catch { w.push(`Invalid URL: ${a.href || "(empty)"}`); }
    const code = hreflangCode(a);
    if (code) seen.set(code, (seen.get(code) ?? 0) + 1);
  }
  for (const [code, count] of seen) {
    if (count > 1) w.push(`Duplicate hreflang: "${code}"`);
  }
  if (c.alternates.filter((a) => a.href).length < 2) w.push("Need at least 2 alternates");
  if (c.xDefault) {
    try { new URL(c.xDefault); } catch { w.push("Invalid x-default URL"); }
  }
  return { ok: w.length === 0, warnings: w };
}

function buildHtml(c: Cluster): string {
  const xDefault = c.xDefault || c.canonical;
  const lines: string[] = [];
  for (const a of c.alternates) {
    const code = hreflangCode(a);
    if (!code || !a.href) continue;
    lines.push(`<link rel="alternate" hreflang="${code}" href="${a.href}" />`);
  }
  if (xDefault) lines.push(`<link rel="alternate" hreflang="x-default" href="${xDefault}" />`);
  return lines.join("\n");
}

function buildXml(c: Cluster): string {
  const xDefault = c.xDefault || c.canonical;
  const alts = c.alternates.filter((a) => a.href && hreflangCode(a));
  const inner: string[] = alts.map((a) => `    <xhtml:link rel="alternate" hreflang="${hreflangCode(a)}" href="${a.href}" />`);
  if (xDefault) inner.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${xDefault}" />`);
  const innerStr = inner.join("\n");
  const urls = alts.map((a) => `  <url>\n    <loc>${a.href}</loc>\n${innerStr}\n  </url>`);
  return urls.join("\n");
}

export function HreflangGenerator() {
  const [mode, setMode] = useState<"individual" | "bulk">("individual");
  const [outputMode, setOutputMode] = useState<"html" | "xml">("html");
  const [clusters, setClusters] = useState<Cluster[]>([makeCluster()]);

  // Bulk mode shared inputs
  const [bulkUrls, setBulkUrls] = useState("");
  const [bulkAlternates, setBulkAlternates] = useState<Alternate[]>([
    makeAlternate("en", "US", ""),
    makeAlternate("en", "GB", ""),
    makeAlternate("fr", "FR", ""),
  ]);
  const [bulkApplyMode, setBulkApplyMode] = useState<"shared" | "self">("self");
  // shared = same alternate URLs across all canonicals
  // self = the canonical itself appears as one of its alternates (helpful when each URL is one locale)

  // ── Individual mode mutations ─────────────────────────────────────────────
  const updateCluster = (id: string, patch: Partial<Cluster>) =>
    setClusters((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const updateAlternate = (cId: string, aId: string, patch: Partial<Alternate>) =>
    setClusters((prev) =>
      prev.map((c) =>
        c.id === cId
          ? { ...c, alternates: c.alternates.map((a) => (a.id === aId ? { ...a, ...patch } : a)) }
          : c
      )
    );

  const addAlternate = (cId: string) =>
    setClusters((prev) => prev.map((c) => (c.id === cId ? { ...c, alternates: [...c.alternates, makeAlternate("", "", "")] } : c)));

  const removeAlternate = (cId: string, aId: string) =>
    setClusters((prev) =>
      prev.map((c) => (c.id === cId ? { ...c, alternates: c.alternates.filter((a) => a.id !== aId) } : c))
    );

  const addCluster = () => setClusters((prev) => [...prev, makeCluster()]);
  const removeCluster = (id: string) => setClusters((prev) => prev.filter((c) => c.id !== id));

  // ── Bulk mode → derived clusters ──────────────────────────────────────────
  const derivedBulkClusters: Cluster[] = useMemo(() => {
    if (mode !== "bulk") return [];
    const urls = bulkUrls.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    return urls.map((u, i) => {
      const alts = bulkApplyMode === "shared"
        ? bulkAlternates.map((a) => ({ ...a, id: `bulk-${i}-${a.id}` }))
        : [
            ...bulkAlternates.map((a) => ({ ...a, id: `bulk-${i}-${a.id}` })),
            // ensure canonical itself is included as an alternate when in "self" mode
          ];
      return {
        id: `bulkc-${i}`,
        canonical: u,
        alternates: alts,
        xDefault: "",
      };
    });
  }, [mode, bulkUrls, bulkAlternates, bulkApplyMode]);

  const activeClusters = mode === "individual" ? clusters : derivedBulkClusters;
  const validations = activeClusters.map(validateCluster);
  const okCount = validations.filter((v) => v.ok).length;

  const copyCluster = (c: Cluster) => {
    const out = outputMode === "html" ? buildHtml(c) : buildXml(c);
    navigator.clipboard.writeText(out);
    toast({ title: "Copied", description: c.canonical || "(cluster)" });
  };

  const copyAll = () => {
    const out = activeClusters
      .map((c, i) => `<!-- Cluster ${i + 1}: ${c.canonical} -->\n${outputMode === "html" ? buildHtml(c) : buildXml(c)}`)
      .join("\n\n");
    navigator.clipboard.writeText(out);
    toast({ title: "Copied", description: `${activeClusters.length} clusters copied.` });
  };

  const exportTsv = () => {
    const rows = activeClusters.flatMap((c, i) =>
      c.alternates.map((a) => [
        String(i + 1), c.canonical, hreflangCode(a), a.href,
        validations[i].ok ? "Valid" : validations[i].warnings.join("; "),
      ])
    );
    const tsv = rowsToTSV(["Cluster", "Canonical", "Hreflang", "URL", "Status"], rows);
    const blob = new Blob([tsv], { type: "text/tab-separated-values;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hreflang-${Date.now()}.tsv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-2 mb-3">
          <Languages className="h-4 w-4 text-warning" />
          <h3 className="text-sm font-semibold">Hreflang generator</h3>
          <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal ml-auto">
            {activeClusters.length} cluster{activeClusters.length === 1 ? "" : "s"} · {okCount} valid
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

          <TabsContent value="individual" className="mt-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Label className="text-[11px] text-muted-foreground">Output format</Label>
              <Tabs value={outputMode} onValueChange={(v) => setOutputMode(v as "html" | "xml")}>
                <TabsList className="h-7">
                  <TabsTrigger value="html" className="text-[11px] h-5">HTML &lt;link&gt;</TabsTrigger>
                  <TabsTrigger value="xml" className="text-[11px] h-5">Sitemap XML</TabsTrigger>
                </TabsList>
              </Tabs>
              <Button variant="outline" size="sm" className="h-7 text-xs ml-auto" onClick={addCluster}>
                <Plus className="h-3 w-3 mr-1" /> Add cluster
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="bulk" className="mt-3 space-y-3">
            <p className="text-[11px] text-muted-foreground">
              Paste many canonical URLs and apply one shared set of language/country variants.
              Each URL gets its own hreflang block in the output.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] text-muted-foreground">Canonical URLs (one per line)</Label>
                <Textarea
                  value={bulkUrls}
                  onChange={(e) => setBulkUrls(e.target.value)}
                  placeholder={`https://example.com/page-1\nhttps://example.com/page-2`}
                  className="font-mono text-xs h-32 mt-1"
                />
                <div className="mt-2">
                  <Label className="text-[11px] text-muted-foreground">Output format</Label>
                  <Tabs value={outputMode} onValueChange={(v) => setOutputMode(v as "html" | "xml")}>
                    <TabsList className="h-7 mt-1">
                      <TabsTrigger value="html" className="text-[11px] h-5">HTML</TabsTrigger>
                      <TabsTrigger value="xml" className="text-[11px] h-5">Sitemap XML</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </div>

              <div>
                <Label className="text-[11px] text-muted-foreground">Shared alternates</Label>
                <div className="mt-1 space-y-1.5">
                  {bulkAlternates.map((a, i) => (
                    <div key={a.id} className="flex items-center gap-1.5">
                      <Input
                        value={a.language}
                        onChange={(e) => {
                          const v = e.target.value.toLowerCase();
                          setBulkAlternates((prev) => prev.map((x, j) => (j === i ? { ...x, language: v } : x)));
                        }}
                        placeholder="en"
                        className="h-7 text-xs w-14"
                      />
                      <Input
                        value={a.country}
                        onChange={(e) => {
                          const v = e.target.value.toUpperCase();
                          setBulkAlternates((prev) => prev.map((x, j) => (j === i ? { ...x, country: v } : x)));
                        }}
                        placeholder="US"
                        className="h-7 text-xs w-14"
                      />
                      <Input
                        value={a.href}
                        onChange={(e) => setBulkAlternates((prev) => prev.map((x, j) => (j === i ? { ...x, href: e.target.value } : x)))}
                        placeholder="https://example.com/us/"
                        className="h-7 text-xs flex-1 font-mono"
                      />
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => setBulkAlternates((prev) => prev.filter((_, j) => j !== i))} aria-label="Remove">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline" size="sm" className="h-7 text-xs"
                    onClick={() => setBulkAlternates((prev) => [...prev, makeAlternate("", "", "")])}
                  >
                    <Plus className="h-3 w-3 mr-1" /> Add alternate
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Per-cluster editor (individual mode) */}
      {mode === "individual" && clusters.map((c, i) => {
        const v = validations[i];
        return (
          <div key={c.id} className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal">Cluster #{i + 1}</Badge>
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
                <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => copyCluster(c)}>
                  <Copy className="h-3 w-3 mr-1" /> Copy
                </Button>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => removeCluster(c.id)} aria-label="Remove cluster">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div className="p-3 space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] text-muted-foreground">Canonical URL</Label>
                  <Input
                    value={c.canonical}
                    onChange={(e) => updateCluster(c.id, { canonical: e.target.value })}
                    placeholder="https://example.com/"
                    className="h-8 text-xs mt-1 font-mono"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">x-default URL (optional, defaults to canonical)</Label>
                  <Input
                    value={c.xDefault}
                    onChange={(e) => updateCluster(c.id, { xDefault: e.target.value })}
                    placeholder={c.canonical || "https://example.com/"}
                    className="h-8 text-xs mt-1 font-mono"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Globe className="h-3 w-3" /> Alternate language / country versions
                  </Label>
                  <Button variant="outline" size="sm" className="h-6 text-[11px]" onClick={() => addAlternate(c.id)}>
                    <Plus className="h-3 w-3 mr-1" /> Add
                  </Button>
                </div>

                <div className="space-y-1.5">
                  <div className="grid grid-cols-[60px_60px_1fr_28px] gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground px-1">
                    <span>Lang</span><span>Country</span><span>URL</span><span />
                  </div>
                  {c.alternates.map((a) => (
                    <div key={a.id} className="grid grid-cols-[60px_60px_1fr_28px] gap-1.5 items-center">
                      <Input
                        value={a.language}
                        onChange={(e) => updateAlternate(c.id, a.id, { language: e.target.value.toLowerCase() })}
                        placeholder="en"
                        maxLength={3}
                        className="h-7 text-xs"
                      />
                      <Input
                        value={a.country}
                        onChange={(e) => updateAlternate(c.id, a.id, { country: e.target.value.toUpperCase() })}
                        placeholder="US"
                        maxLength={2}
                        className="h-7 text-xs"
                      />
                      <Input
                        value={a.href}
                        onChange={(e) => updateAlternate(c.id, a.id, { href: e.target.value })}
                        placeholder="https://example.com/us/"
                        className="h-7 text-xs font-mono"
                      />
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => removeAlternate(c.id, a.id)} aria-label="Remove alternate">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
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
                  Preview generated tags ({outputMode === "html" ? "HTML" : "Sitemap XML"})
                </summary>
                <pre className="px-3 py-2 text-[11px] font-mono whitespace-pre-wrap break-all text-foreground/85">
{outputMode === "html" ? buildHtml(c) : buildXml(c)}
                </pre>
              </details>
            </div>
          </div>
        );
      })}

      {/* Bulk preview output */}
      {mode === "bulk" && derivedBulkClusters.length > 0 && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal">{derivedBulkClusters.length} clusters</Badge>
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
              {derivedBulkClusters.map((c, i) => (
                <div key={c.id} className="p-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-muted-foreground truncate">{c.canonical}</span>
                    {!validations[i].ok && (
                      <span className="text-[10px] text-warning">{validations[i].warnings[0]}</span>
                    )}
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] ml-auto" onClick={() => copyCluster(c)}>
                      <Copy className="h-3 w-3 mr-1" /> Copy
                    </Button>
                  </div>
                  <pre className="text-[11px] font-mono whitespace-pre-wrap break-all text-foreground/80 bg-muted/20 rounded p-2">
{outputMode === "html" ? buildHtml(c) : buildXml(c)}
                  </pre>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Global actions for individual mode */}
      {mode === "individual" && clusters.length > 0 && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={copyAll}>
            <Copy className="h-3 w-3 mr-1" /> Copy all clusters
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={exportTsv}>
            <FileDown className="h-3 w-3 mr-1" /> Export TSV
          </Button>
        </div>
      )}
    </div>
  );
}
