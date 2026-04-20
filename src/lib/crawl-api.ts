import { supabase } from "@/integrations/supabase/client";

export interface ImageData {
  src: string;
  alt: string | null;
}

export interface HreflangEntry {
  href: string;
  hreflang: string;
}

export interface InternalLinkData {
  anchorText: string;
  href: string;
  isInternal: boolean;
}

export interface SocialTag {
  network: 'og' | 'twitter';
  property: string;
  content: string;
}

export type RedirectType = 'none' | 'http' | 'meta-refresh' | 'javascript' | 'mixed';

export interface RedirectHop {
  url: string;
  status: number;
  type: 'http' | 'meta-refresh' | 'javascript';
  statusText?: string;
}

export interface CrawlResult {
  url: string;
  title: string;
  description: string;
  h1s: string[];
  h2s: string[];
  h3s: string[];
  images?: ImageData[];
  schemas?: string[];
  robots?: string;
  canonical?: string;
  canonicalStatus?: 'Self Referencing' | 'Canonicalised' | 'Missing';
  hreflangs?: HreflangEntry[];
  internalLinks?: InternalLinkData[];
  socialTags?: SocialTag[];
  status: "OK" | "Error";
  statusCode: number;
  redirectStatusCode?: number;
  redirectedUrl?: string;
  /** none | http | meta-refresh | mixed (chain contains both) */
  redirectType?: RedirectType;
  /**
   * Phase 1 detailed chain: every hop with URL + status + hop type.
   * Empty array = no redirect.
   */
  redirectChain?: RedirectHop[];
  /** The originally requested URL. */
  initialUrl?: string;
  /** Final URL after the entire redirect chain resolves. */
  finalUrl?: string;
  /** Length of redirectChain. */
  hopCount?: number;
  /** ISO-8601 Last-Modified header from the final HTTP response, when present. */
  lastModified?: string;
  fetchTime: string;
}

export async function parseSitemapUrls(sitemapUrl: string): Promise<string[]> {
  const { data, error } = await supabase.functions.invoke("crawl-sitemap", {
    body: { sitemapUrl },
  });

  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);
  return data.urls || [];
}

export async function spiderSiteUrls(siteUrl: string): Promise<string[]> {
  const { data, error } = await supabase.functions.invoke("crawl-site", {
    body: { siteUrl },
  });

  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);
  return data.urls || [];
}

export async function fetchMetaBatch(
  urls: string[],
  includeTitle = true,
  includeDesc = true,
  includeH1 = false,
  includeH2 = false,
  includeH3 = false,
  includeImages = false,
  includeSchemas = false,
  includeRobots = false,
  includeCanonical = false,
  includeHreflangs = false,
  includeInternalLinks = false,
  jsRenderedLinks = false,
  includeSocialTags = false,
): Promise<CrawlResult[]> {
  const { data, error } = await supabase.functions.invoke("crawl-sitemap-batch", {
    body: { urls, includeTitle, includeDesc, includeH1, includeH2, includeH3, includeImages, includeSchemas, includeRobots, includeCanonical, includeHreflangs, includeInternalLinks, jsRenderedLinks, includeSocialTags },
  });

  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);
  return data.results || [];
}

// ─── Output formatting helpers ────────────────────────────────────────────────
// We support two output flavours:
//   • CSV  — for downloadable .csv files (comma-separated, RFC 4180 quoting)
//   • TSV  — for clipboard copies. Excel/Google Sheets auto-split tab-separated
//            text into individual cells when pasted, so this makes the "Copy"
//            button paste cleanly into spreadsheets instead of dumping
//            everything into a single cell.

type Sep = "," | "\t";

function buildTable(
  results: CrawlResult[],
  sep: Sep,
  includeTitle: boolean,
  includeDesc: boolean,
  includeH1: boolean,
  includeH2: boolean,
  includeH3: boolean,
  includeImages: boolean,
  includeRobots: boolean,
  includeCanonical: boolean,
): string {
  // CSV needs RFC-4180 quoting; TSV cells must avoid raw tabs/newlines so
  // Excel keeps them in a single cell. Multi-value fields (H1/H2/H3) are
  // joined with " | " (a delimiter that's safe in both formats) so each row
  // remains exactly one row in the spreadsheet.
  const sanitizeForTsv = (s: string) =>
    s.replace(/\r?\n|\r|\t/g, " ").replace(/\s+/g, " ").trim();
  const escape = (s: string) =>
    sep === ","
      ? `"${s.replace(/"/g, '""')}"`
      : sanitizeForTsv(s);

  if (includeImages) {
    const header = ["Page URL", "Image URL", "Alt Text", "Image Count"].join(sep);
    const rows: string[] = [];
    results.forEach((r) => {
      const images = r.images ?? [];
      if (images.length === 0) {
        rows.push([escape(r.url), escape(""), escape("No images found"), "0"].join(sep));
      } else {
        images.forEach((img) => {
          rows.push([escape(r.url), escape(img.src), escape(img.alt ?? "No alt text"), String(images.length)].join(sep));
        });
      }
    });
    return [header, ...rows].join("\n");
  }

  const headerParts = ["URL"];
  if (includeTitle) headerParts.push("Meta Title");
  if (includeDesc) headerParts.push("Meta Description");
  if (includeH1) headerParts.push("H1 Tags", "H1 Count");
  if (includeH2) headerParts.push("H2 Tags", "H2 Count");
  if (includeH3) headerParts.push("H3 Tags", "H3 Count");
  if (includeRobots) headerParts.push("Meta Robots");
  if (includeCanonical) headerParts.push("Canonical URL", "Canonical Status");
  headerParts.push("Status", "Response Code", "Fetch Time");
  const header = headerParts.join(sep);

  const rows = results.map((r) => {
    const parts = [escape(r.url)];
    if (includeTitle) parts.push(escape(r.title));
    if (includeDesc) parts.push(escape(r.description));
    if (includeH1) { parts.push(escape((r.h1s ?? []).join(" | ")), String((r.h1s ?? []).length)); }
    if (includeH2) { parts.push(escape((r.h2s ?? []).join(" | ")), String((r.h2s ?? []).length)); }
    if (includeH3) { parts.push(escape((r.h3s ?? []).join(" | ")), String((r.h3s ?? []).length)); }
    if (includeRobots) { parts.push(escape(r.robots ?? '')); }
    if (includeCanonical) { parts.push(escape(r.canonical ?? ''), escape(r.canonicalStatus ?? 'Missing')); }
    parts.push(escape(r.status), String(r.statusCode), escape(r.fetchTime));
    return parts.join(sep);
  });
  return [header, ...rows].join("\n");
}

export function generateCSV(
  results: CrawlResult[],
  includeTitle = true,
  includeDesc = true,
  includeH1 = false,
  includeH2 = false,
  includeH3 = false,
  includeImages = false,
  includeRobots = false,
  includeCanonical = false,
): string {
  return buildTable(results, ",", includeTitle, includeDesc, includeH1, includeH2, includeH3, includeImages, includeRobots, includeCanonical);
}

/**
 * TSV (tab-separated) for clipboard. Pasting this into Excel/Google Sheets
 * automatically distributes columns into separate cells.
 */
export function generateTSV(
  results: CrawlResult[],
  includeTitle = true,
  includeDesc = true,
  includeH1 = false,
  includeH2 = false,
  includeH3 = false,
  includeImages = false,
  includeRobots = false,
  includeCanonical = false,
): string {
  return buildTable(results, "\t", includeTitle, includeDesc, includeH1, includeH2, includeH3, includeImages, includeRobots, includeCanonical);
}

/** Build a TSV table from arbitrary rows for ad-hoc copy actions. */
export function rowsToTSV(header: string[], rows: string[][]): string {
  const sanitize = (s: string) =>
    (s ?? "").replace(/\r?\n|\r|\t/g, " ").replace(/\s+/g, " ").trim();
  return [header.map(sanitize).join("\t"), ...rows.map((r) => r.map(sanitize).join("\t"))].join("\n");
}

export function downloadCSV(csv: string, domain: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sitemap-${domain}-${timestamp}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
