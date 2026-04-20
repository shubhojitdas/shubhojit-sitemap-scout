import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CrawlResult, SocialTag } from "@/lib/crawl-api";
import { Button } from "@/components/ui/button";
import { Copy, Check, Facebook, Twitter, ChevronRight, ImageOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  results: CrawlResult[];
}

type Filter = "all" | "has-og" | "has-twitter" | "has-both" | "missing-both" | "missing-og" | "missing-twitter";

function buildHtmlBlock(tags: SocialTag[]): string {
  return tags
    .map((t) => {
      const attrName = t.network === "og" ? "property" : "name";
      const escapedContent = t.content.replace(/"/g, "&quot;");
      return `<meta ${attrName}="${t.property}" content="${escapedContent}" />`;
    })
    .join("\n");
}

function getTag(tags: SocialTag[], property: string): string {
  return tags.find((t) => t.property === property)?.content ?? "";
}

function FacebookPreview({ tags, fallbackUrl }: { tags: SocialTag[]; fallbackUrl: string }) {
  const title = getTag(tags, "og:title") || "Untitled";
  const desc = getTag(tags, "og:description");
  const image = getTag(tags, "og:image") || getTag(tags, "og:image:secure_url");
  const siteUrl = getTag(tags, "og:url") || fallbackUrl;
  let domain = "";
  try { domain = new URL(siteUrl).hostname.replace(/^www\./, ""); } catch { /* keep */ }

  return (
    <div className="rounded-md border border-border bg-background overflow-hidden">
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-border bg-muted/30">
        <Facebook className="h-3 w-3 text-primary" />
        <span className="text-[10px] font-medium text-muted-foreground">Facebook / Open Graph preview</span>
      </div>
      {image ? (
        <div className="aspect-[1.91/1] bg-muted overflow-hidden">
          <img src={image} alt="" className="w-full h-full object-cover" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        </div>
      ) : (
        <div className="aspect-[1.91/1] bg-muted flex items-center justify-center text-muted-foreground">
          <ImageOff className="h-6 w-6 opacity-40" />
        </div>
      )}
      <div className="p-2.5 space-y-1 bg-muted/20">
        {domain && <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{domain}</div>}
        <div className="text-[12px] font-semibold text-foreground line-clamp-2 leading-snug">{title}</div>
        {desc && <div className="text-[11px] text-muted-foreground line-clamp-2 leading-snug">{desc}</div>}
      </div>
    </div>
  );
}

function TwitterPreview({ tags, fallbackUrl }: { tags: SocialTag[]; fallbackUrl: string }) {
  const card = getTag(tags, "twitter:card") || "summary";
  const title = getTag(tags, "twitter:title") || getTag(tags, "og:title") || "Untitled";
  const desc = getTag(tags, "twitter:description") || getTag(tags, "og:description");
  const image = getTag(tags, "twitter:image") || getTag(tags, "og:image");
  const siteUrl = getTag(tags, "twitter:url") || getTag(tags, "og:url") || fallbackUrl;
  let domain = "";
  try { domain = new URL(siteUrl).hostname.replace(/^www\./, ""); } catch { /* keep */ }
  const isLarge = card === "summary_large_image";

  return (
    <div className="rounded-2xl border border-border bg-background overflow-hidden">
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border bg-muted/30">
        <div className="flex items-center gap-1.5">
          <Twitter className="h-3 w-3 text-foreground" />
          <span className="text-[10px] font-medium text-muted-foreground">Twitter / X card preview</span>
        </div>
        <span className="text-[9px] font-mono text-muted-foreground">{card}</span>
      </div>
      {isLarge ? (
        <div>
          {image ? (
            <div className="aspect-[2/1] bg-muted overflow-hidden">
              <img src={image} alt="" className="w-full h-full object-cover" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            </div>
          ) : (
            <div className="aspect-[2/1] bg-muted flex items-center justify-center text-muted-foreground">
              <ImageOff className="h-6 w-6 opacity-40" />
            </div>
          )}
          <div className="p-2.5 space-y-0.5">
            <div className="text-[12px] font-semibold text-foreground line-clamp-2 leading-snug">{title}</div>
            {desc && <div className="text-[11px] text-muted-foreground line-clamp-2 leading-snug">{desc}</div>}
            {domain && <div className="text-[10px] text-muted-foreground">{domain}</div>}
          </div>
        </div>
      ) : (
        <div className="flex">
          {image ? (
            <div className="w-20 h-20 bg-muted shrink-0 overflow-hidden">
              <img src={image} alt="" className="w-full h-full object-cover" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            </div>
          ) : (
            <div className="w-20 h-20 bg-muted shrink-0 flex items-center justify-center text-muted-foreground">
              <ImageOff className="h-5 w-5 opacity-40" />
            </div>
          )}
          <div className="p-2.5 space-y-0.5 min-w-0 flex-1">
            <div className="text-[12px] font-semibold text-foreground line-clamp-2 leading-snug">{title}</div>
            {desc && <div className="text-[11px] text-muted-foreground line-clamp-2 leading-snug">{desc}</div>}
            {domain && <div className="text-[10px] text-muted-foreground">{domain}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function HtmlBlock({ tags, network }: { tags: SocialTag[]; network: "og" | "twitter" }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const filtered = tags.filter((t) => t.network === network);
  const html = buildHtmlBlock(filtered);

  const copy = () => {
    navigator.clipboard.writeText(html);
    setCopied(true);
    toast({ title: "Copied!", description: `${filtered.length} ${network === "og" ? "OG" : "Twitter"} tag(s) copied as HTML` });
    setTimeout(() => setCopied(false), 1800);
  };

  if (filtered.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/20 p-3 text-[11px] text-muted-foreground italic">
        No {network === "og" ? "Open Graph" : "Twitter"} tags found on this page.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-muted/30 overflow-hidden">
      <div className="flex items-center justify-between px-2.5 py-1 border-b border-border bg-muted/40">
        <span className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
          {network === "og" ? "Open Graph" : "Twitter Card"} · {filtered.length} tag{filtered.length === 1 ? "" : "s"}
        </span>
        <Button size="sm" variant="ghost" onClick={copy} className="h-6 px-1.5 text-[10px] gap-1">
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          Copy
        </Button>
      </div>
      <pre className="px-3 py-2 text-[11px] font-mono leading-relaxed text-foreground overflow-x-auto whitespace-pre">
        {filtered.map((t, i) => {
          const attrName = t.network === "og" ? "property" : "name";
          return (
            <div key={i} className="break-all whitespace-pre-wrap">
              <span className="text-muted-foreground">&lt;meta </span>
              <span className="text-primary">{attrName}</span>
              <span className="text-muted-foreground">=</span>
              <span className="text-success">"{t.property}"</span>
              <span className="text-muted-foreground"> content</span>
              <span className="text-muted-foreground">=</span>
              <span className="text-warning">"{t.content}"</span>
              <span className="text-muted-foreground"> /&gt;</span>
            </div>
          );
        })}
      </pre>
    </div>
  );
}

export function SocialTagsTable({ results }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggle = (i: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const filtered = useMemo(() => {
    let data = results.filter((r) => r.status === "OK");
    const counts = (r: CrawlResult) => {
      const t = r.socialTags ?? [];
      return { og: t.filter((x) => x.network === "og").length, tw: t.filter((x) => x.network === "twitter").length };
    };
    if (filter === "has-og") data = data.filter((r) => counts(r).og > 0);
    else if (filter === "has-twitter") data = data.filter((r) => counts(r).tw > 0);
    else if (filter === "has-both") data = data.filter((r) => { const c = counts(r); return c.og > 0 && c.tw > 0; });
    else if (filter === "missing-both") data = data.filter((r) => { const c = counts(r); return c.og === 0 && c.tw === 0; });
    else if (filter === "missing-og") data = data.filter((r) => counts(r).og === 0);
    else if (filter === "missing-twitter") data = data.filter((r) => counts(r).tw === 0);

    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter((r) =>
        r.url.toLowerCase().includes(q) ||
        (r.socialTags ?? []).some((t) => t.property.includes(q) || t.content.toLowerCase().includes(q))
      );
    }
    return data;
  }, [results, filter, search]);

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All Pages" },
    { key: "has-both", label: "Has OG + Twitter" },
    { key: "has-og", label: "Has OG" },
    { key: "has-twitter", label: "Has Twitter" },
    { key: "missing-og", label: "Missing OG" },
    { key: "missing-twitter", label: "Missing Twitter" },
    { key: "missing-both", label: "Missing Both" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
        <div className="flex gap-1.5 flex-wrap">
          {filters.map((f) => (
            <Button key={f.key} size="sm" variant={filter === f.key ? "default" : "outline"} onClick={() => setFilter(f.key)} className="text-[11px] h-7 px-2.5">
              {f.label}
            </Button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter URL, property or content..."
          className="h-7 text-[11px] px-2.5 rounded-md border border-border bg-background w-full sm:w-64"
        />
      </div>

      <p className="text-[11px] text-muted-foreground">{filtered.length} pages · click a row to view stacked HTML and live previews</p>

      <div className="border border-border rounded-lg overflow-hidden bg-card">
        <div className="grid grid-cols-[24px_1.6fr_90px_90px] gap-0 border-b border-border bg-muted/30 text-[11px] font-medium text-muted-foreground">
          <div className="px-1 py-2" />
          <div className="px-3 py-2">Page URL</div>
          <div className="px-3 py-2 text-center">OG tags</div>
          <div className="px-3 py-2 text-center">Twitter</div>
        </div>

        <div className="overflow-auto max-h-[600px] divide-y divide-border">
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-[11px] text-muted-foreground">No pages match this filter</div>
          ) : (
            filtered.map((row, index) => {
              const tags = row.socialTags ?? [];
              const ogCount = tags.filter((t) => t.network === "og").length;
              const twCount = tags.filter((t) => t.network === "twitter").length;
              const isOpen = expanded.has(index);
              const hasAny = tags.length > 0;

              return (
                <div key={index}>
                  <button
                    type="button"
                    onClick={() => hasAny && toggle(index)}
                    disabled={!hasAny}
                    className={`w-full grid grid-cols-[24px_1.6fr_90px_90px] gap-0 hover:bg-muted/20 transition-colors text-left ${hasAny ? "cursor-pointer" : "cursor-default"}`}
                  >
                    <div className="flex items-center justify-center py-2">
                      {hasAny ? (
                        <ChevronRight className={`h-3 w-3 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`} />
                      ) : null}
                    </div>
                    <div className="px-3 py-2 break-all font-mono text-[11px] text-muted-foreground">{row.url}</div>
                    <div className="px-3 py-2 text-center">
                      {ogCount > 0 ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/15 text-primary">
                          <Facebook className="h-2.5 w-2.5" /> {ogCount}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60 text-[10px]">—</span>
                      )}
                    </div>
                    <div className="px-3 py-2 text-center">
                      {twCount > 0 ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-foreground/10 text-foreground">
                          <Twitter className="h-2.5 w-2.5" /> {twCount}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60 text-[10px]">—</span>
                      )}
                    </div>
                  </button>

                  {isOpen && hasAny && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      transition={{ duration: 0.2 }}
                      className="bg-muted/10 border-t border-border overflow-hidden"
                    >
                      <div className="p-4 grid gap-4 lg:grid-cols-2">
                        <div className="space-y-3">
                          <HtmlBlock tags={tags} network="og" />
                          <FacebookPreview tags={tags} fallbackUrl={row.finalUrl ?? row.url} />
                        </div>
                        <div className="space-y-3">
                          <HtmlBlock tags={tags} network="twitter" />
                          <TwitterPreview tags={tags} fallbackUrl={row.finalUrl ?? row.url} />
                        </div>
                      </div>
                    </motion.div>
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
