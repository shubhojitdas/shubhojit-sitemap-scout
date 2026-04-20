import type { CrawlResult } from "./crawl-api";

/**
 * Build a Google-friendly XML sitemap from crawl results.
 *
 * Filtering rules (per user spec):
 *  • Only HTTP 2xx URLs are included.
 *  • Permanent (301) redirects are followed: the original URL is replaced
 *    with the redirect chain's final destination.
 *  • Temporary redirects (302), meta-refresh and inline-JS redirects are
 *    treated as non-canonical and EXCLUDED entirely.
 *  • De-duplicates by final URL.
 *  • Each <url> entry contains only <loc> and (when known) <lastmod>.
 *    No <priority> / <changefreq> — Google ignores them and they only
 *    bloat the file.
 */

export interface SitemapEntry {
  loc: string;
  lastmod?: string;
}

export interface BuildSitemapOptions {
  /** When false, every entry's lastmod defaults to today's date. */
  fallbackLastmodToday?: boolean;
}

/** Decide whether a single CrawlResult should appear in the sitemap. */
function resolveSitemapUrl(r: CrawlResult): string | null {
  // Must be a successful response.
  if (r.status !== "OK") return null;
  if (r.statusCode < 200 || r.statusCode >= 300) return null;

  const type = r.redirectType ?? "none";

  if (type === "none") {
    return r.finalUrl || r.url;
  }

  // Permanent HTTP redirects → keep the final URL.
  if (type === "http") {
    const chain = r.redirectChain ?? [];
    const onlyPermanent = chain
      .filter((h) => h.type === "http" && h.status >= 300 && h.status < 400)
      .every((h) => h.status === 301 || h.status === 308);
    if (!onlyPermanent) return null;
    return r.finalUrl || r.url;
  }

  // 302 / meta-refresh / inline-JS / mixed → exclude.
  return null;
}

function isoDate(d: Date): string {
  // YYYY-MM-DD — accepted by Google and shorter than full ISO timestamp.
  return d.toISOString().slice(0, 10);
}

export function buildSitemapEntries(
  results: CrawlResult[],
  opts: BuildSitemapOptions = {},
): SitemapEntry[] {
  const today = isoDate(new Date());
  const seen = new Set<string>();
  const entries: SitemapEntry[] = [];

  for (const r of results) {
    const loc = resolveSitemapUrl(r);
    if (!loc) continue;

    // Normalise (strip trailing fragments, decode safely).
    let normalized = loc;
    try {
      const u = new URL(loc);
      u.hash = "";
      normalized = u.href;
    } catch {
      continue; // skip anything that isn't a valid absolute URL
    }

    if (seen.has(normalized)) continue;
    seen.add(normalized);

    let lastmod: string | undefined;
    if (r.lastModified) {
      const d = new Date(r.lastModified);
      if (!isNaN(d.getTime())) lastmod = isoDate(d);
    }
    if (!lastmod && opts.fallbackLastmodToday) lastmod = today;

    entries.push({ loc: normalized, lastmod });
  }

  // Stable alphabetical order — easier for humans to scan & diff.
  entries.sort((a, b) => a.loc.localeCompare(b.loc));
  return entries;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function entriesToXml(entries: SitemapEntry[]): string {
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
  for (const e of entries) {
    lines.push("  <url>");
    lines.push(`    <loc>${escapeXml(e.loc)}</loc>`);
    if (e.lastmod) lines.push(`    <lastmod>${e.lastmod}</lastmod>`);
    lines.push("  </url>");
  }
  lines.push("</urlset>");
  return lines.join("\n");
}

export interface SitemapBuildResult {
  xml: string;
  entries: SitemapEntry[];
  /** Counts to show users why URLs were dropped. */
  stats: {
    total: number;
    included: number;
    droppedNon2xx: number;
    droppedTemporaryRedirect: number;
    droppedDuplicate: number;
  };
}

export function buildSitemap(
  results: CrawlResult[],
  opts: BuildSitemapOptions = { fallbackLastmodToday: true },
): SitemapBuildResult {
  let droppedNon2xx = 0;
  let droppedTemporaryRedirect = 0;

  for (const r of results) {
    if (r.status !== "OK" || r.statusCode < 200 || r.statusCode >= 300) {
      droppedNon2xx++;
      continue;
    }
    const type = r.redirectType ?? "none";
    if (type === "none") continue;
    if (type === "http") {
      const chain = r.redirectChain ?? [];
      const onlyPermanent = chain
        .filter((h) => h.type === "http" && h.status >= 300 && h.status < 400)
        .every((h) => h.status === 301 || h.status === 308);
      if (!onlyPermanent) droppedTemporaryRedirect++;
      continue;
    }
    droppedTemporaryRedirect++;
  }

  const entries = buildSitemapEntries(results, opts);
  // Duplicates = anything that resolved to a sitemap URL but was deduped.
  const eligibleCount = results.length - droppedNon2xx - droppedTemporaryRedirect;
  const droppedDuplicate = Math.max(0, eligibleCount - entries.length);

  return {
    xml: entriesToXml(entries),
    entries,
    stats: {
      total: results.length,
      included: entries.length,
      droppedNon2xx,
      droppedTemporaryRedirect,
      droppedDuplicate,
    },
  };
}

export function downloadSitemap(xml: string, domain: string) {
  const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sitemap-${domain || "site"}.xml`;
  a.click();
  URL.revokeObjectURL(url);
}
