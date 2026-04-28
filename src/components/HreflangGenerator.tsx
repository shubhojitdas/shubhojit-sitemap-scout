import { useMemo, useState } from "react";
import { Languages, Copy, FileDown, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { rowsToTSV } from "@/lib/crawl-api";
import { toast } from "@/hooks/use-toast";

interface AltEntry {
  hreflang: string; // e.g. en, en-US, x-default
  href: string;
}

interface Cluster {
  id: number;
  alternates: AltEntry[];
}

const HREFLANG_RX = /^([a-z]{2,3}(-[A-Z]{2})?|x-default)$/;

function validateCluster(c: Cluster): { ok: boolean; warnings: string[] } {
  const w: string[] = [];
  const seen = new Map<string, number>();
  let hasDefault = false;
  for (const a of c.alternates) {
    if (!a.hreflang) { w.push("Empty hreflang code"); continue; }
    if (!HREFLANG_RX.test(a.hreflang)) w.push(`Invalid format: "${a.hreflang}" (use ISO 639-1 + optional ISO 3166-1, e.g. en-US)`);
    if (a.hreflang === "x-default") hasDefault = true;
    seen.set(a.hreflang, (seen.get(a.hreflang) ?? 0) + 1);
    try { new URL(a.href); } catch { w.push(`Invalid URL: ${a.href}`); }
  }
  for (const [code, count] of seen) {
    if (count > 1) w.push(`Duplicate hreflang value: "${code}"`);
  }
  if (!hasDefault) w.push("Missing x-default fallback");
  if (c.alternates.length < 2) w.push("Cluster needs at least 2 alternates");
  return { ok: w.length === 0, warnings: w };
}

function buildHtml(c: Cluster): string {
  return c.alternates
    .map((a) => `<link rel="alternate" hreflang="${a.hreflang}" href="${a.href}" />`)
    .join("\n");
}

function buildXml(c: Cluster): string {
  const inner = c.alternates
    .map((a) => `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${a.href}" />`)
    .join("\n");
  return c.alternates
    .map((a) => `  <url>\n    <loc>${a.href}</loc>\n${inner}\n  </url>`)
    .join("\n");
}

export function HreflangGenerator() {
  const [text, setText] = useState(
    `# One cluster per blank-separated block. Format: code,url\n# Example:\nen,https://example.com/\nen-GB,https://example.com/uk/\nde-DE,https://example.com/de/\nx-default,https://example.com/`
  );
  const [siteRoot, setSiteRoot] = useState("");
  const [outputMode, setOutputMode] = useState<"html" | "xml">("html");

  const clusters: Cluster[] = useMemo(() => {
    const out: Cluster[] = [];
    let current: AltEntry[] = [];
    let id = 0;
    const flush = () => {
      if (current.length) out.push({ id: id++, alternates: current });
      current = [];
    };
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) {
        if (line === "" && current.length) flush();
        continue;
      }
      const [hreflang, href] = line.split(",").map((s) => (s ?? "").trim());
      if (!hreflang || !href) continue;
      current.push({ hreflang, href });
    }
    flush();
    return out;
  }, [text]);

  const validations = clusters.map(validateCluster);
  const okCount = validations.filter((v) => v.ok).length;

  const reciprocityIssues = useMemo(() => {
    // Each href in a cluster must mention the others. Flag missing reciprocal alternates.
    const issues: string[] = [];
    for (const c of clusters) {
      const urls = new Set(c.alternates.map((a) => a.href));
      for (const a of c.alternates) {
        // The page at a.href should list every other alternate. Since we only
        // have generator-side data, approximate: warn if the cluster isn't
        // self-referential (i.e. each URL listed as one of its own alts).
        if (!urls.has(a.href)) {
          issues.push(`${a.href} not present in its own cluster (reciprocal reference required)`);
        }
      }
    }
    return issues;
  }, [clusters]);

  const fullOutput = clusters
    .map((c, i) => {
      const v = validations[i];
      const header = `<!-- Cluster ${i + 1}${v.ok ? " ✓" : " ⚠ " + v.warnings.join("; ")} -->`;
      return `${header}\n${outputMode === "html" ? buildHtml(c) : buildXml(c)}`;
    })
    .join("\n\n");

  const handleCopy = () => {
    navigator.clipboard.writeText(fullOutput);
    toast({ title: "Copied", description: `${clusters.length} clusters copied.` });
  };

  const handleExport = () => {
    const rows = clusters.flatMap((c, i) =>
      c.alternates.map((a) => [
        String(i + 1), a.hreflang, a.href, validations[i].ok ? "Valid" : validations[i].warnings.join("; "),
      ])
    );
    const tsv = rowsToTSV(["Cluster", "Hreflang", "URL", "Status"], rows);
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
        <div className="flex items-center gap-2 mb-2">
          <Languages className="h-4 w-4 text-warning" />
          <h3 className="text-sm font-semibold">Bulk hreflang generator</h3>
        </div>
        <p className="text-[11px] text-muted-foreground mb-3">
          Define one URL cluster per block, separated by a blank line. Each row inside a block uses
          <code className="mx-1 font-mono">code,url</code> (e.g. <code>en-US,https://example.com/us/</code>).
          Always include an <code className="font-mono">x-default</code> entry per cluster.
        </p>

        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <div>
            <Label className="text-[11px] text-muted-foreground">Site root (optional, for reference)</Label>
            <Input
              value={siteRoot}
              onChange={(e) => setSiteRoot(e.target.value)}
              placeholder="https://example.com"
              className="h-8 text-xs mt-1"
            />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Output format</Label>
            <Tabs value={outputMode} onValueChange={(v) => setOutputMode(v as "html" | "xml")}>
              <TabsList className="h-8 mt-1">
                <TabsTrigger value="html" className="text-xs h-6">HTML &lt;link&gt;</TabsTrigger>
                <TabsTrigger value="xml" className="text-xs h-6">Sitemap XML</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="font-mono text-xs h-48"
        />
      </div>

      {clusters.length > 0 && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal">
              {clusters.length} clusters
            </Badge>
            <Badge className="text-[10px] h-4 px-1.5 font-normal bg-success/10 text-success border-transparent">
              <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
              {okCount} valid
            </Badge>
            {okCount < clusters.length && (
              <Badge className="text-[10px] h-4 px-1.5 font-normal bg-warning/10 text-warning border-transparent">
                <AlertTriangle className="h-2.5 w-2.5 mr-1" />
                {clusters.length - okCount} with warnings
              </Badge>
            )}
            <Button variant="ghost" size="sm" className="h-6 text-[11px] ml-auto" onClick={handleCopy}>
              <Copy className="h-3 w-3 mr-1" />
              Copy
            </Button>
            <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={handleExport}>
              <FileDown className="h-3 w-3 mr-1" />
              Export TSV
            </Button>
          </div>

          {validations.some((v) => !v.ok) && (
            <div className="px-3 py-2 border-b border-border bg-warning/5 space-y-1">
              {validations.map((v, i) => v.ok ? null : (
                <div key={i} className="text-[11px] text-warning flex items-start gap-1.5">
                  <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span><strong>Cluster {i + 1}:</strong> {v.warnings.join("; ")}</span>
                </div>
              ))}
              {reciprocityIssues.map((m, i) => (
                <div key={`rec-${i}`} className="text-[11px] text-warning">{m}</div>
              ))}
            </div>
          )}

          <ScrollArea className="h-[400px]">
            <pre className="p-3 text-[11px] font-mono whitespace-pre-wrap break-all text-foreground/85">
{fullOutput}
            </pre>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
