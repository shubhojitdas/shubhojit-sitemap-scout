import type { CrawlResult } from "./crawl-api";
import type { SeoIssue } from "./seo-issues";

/**
 * Extra Sitebulb-style derived reports. All pure functions over the crawl
 * results we already have — click depth, orphan pages, redirect chains and a
 * per-directory rollup. No network calls, no new crawl fields.
 */

export function normalizeKey(u: string, base?: string): string {
  try {
    const x = base ? new URL(u, base) : new URL(u);
    x.hash = "";
    let p = x.pathname;
    if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
    const host = x.host.replace(/^www\./i, "");
    return `${x.protocol}//${host}${p}${x.search}`;
  } catch {
    return u;
  }
}

function isOk(r: CrawlResult): boolean {
  return r.statusCode >= 200 && r.statusCode < 300;
}

function isNoindex(r: CrawlResult): boolean {
  return (r.robots ?? "").toLowerCase().includes("noindex");
}

/* ────────────────────────────── Click depth ───────────────────────────── */

export interface DepthReport {
  /** normalized url → click depth from the homepage (0 = homepage). */
  depths: Map<string, number>;
  distribution: { depth: number; count: number }[];
  /** Pages deeper than 3 clicks, deepest first. */
  deepPages: { url: string; depth: number }[];
  /** Crawled pages not reachable from the homepage via internal links. */
  unreachable: string[];
  rootUrl: string | null;
  averageDepth: number;
  maxDepth: number;
}

export function computeClickDepth(results: CrawlResult[]): DepthReport {
  const byKey = new Map<string, CrawlResult>();
  for (const r of results) byKey.set(normalizeKey(r.url), r);

  // Pick the homepage: shortest path on the most frequent host.
  let root: string | null = null;
  let bestLen = Infinity;
  for (const [key, r] of byKey) {
    if (!isOk(r)) continue;
    try {
      const path = new URL(r.url).pathname.replace(/\/$/, "");
      if (path.length < bestLen) {
        bestLen = path.length;
        root = key;
      }
    } catch {
      /* ignore */
    }
  }

  const depths = new Map<string, number>();
  if (root) {
    const queue: string[] = [root];
    depths.set(root, 0);
    while (queue.length) {
      const cur = queue.shift()!;
      const d = depths.get(cur)!;
      const res = byKey.get(cur);
      for (const l of res?.internalLinks ?? []) {
        if (!l.isInternal) continue;
        const dest = normalizeKey(l.href, res!.url);
        if (!byKey.has(dest) || depths.has(dest)) continue;
        depths.set(dest, d + 1);
        queue.push(dest);
      }
    }
  }

  const buckets = new Map<number, number>();
  for (const d of depths.values()) buckets.set(d, (buckets.get(d) ?? 0) + 1);
  const distribution = Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([depth, count]) => ({ depth, count }));

  const deepPages = Array.from(depths.entries())
    .filter(([, d]) => d > 3)
    .map(([key, d]) => ({ url: byKey.get(key)?.url ?? key, depth: d }))
    .sort((a, b) => b.depth - a.depth);

  const unreachable = Array.from(byKey.entries())
    .filter(([key, r]) => !depths.has(key) && isOk(r))
    .map(([, r]) => r.url);

  const values = Array.from(depths.values());
  const averageDepth = values.length
    ? Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10
    : 0;

  return {
    depths,
    distribution,
    deepPages,
    unreachable,
    rootUrl: root ? byKey.get(root)?.url ?? root : null,
    averageDepth,
    maxDepth: values.length ? Math.max(...values) : 0,
  };
}

/* ──────────────────────── Orphan & low-link pages ─────────────────────── */

export interface OrphanReport {
  /** 0 inbound internal links. */
  orphans: { url: string; indexable: boolean; statusCode: number }[];
  /** 1–2 inbound internal links. */
  lowLink: { url: string; inbound: number }[];
  /** Orphans that are 2xx + indexable — the highest value fix. */
  criticalOrphans: string[];
  hasLinkData: boolean;
}

export function findOrphanPages(results: CrawlResult[]): OrphanReport {
  const byKey = new Map<string, CrawlResult>();
  for (const r of results) byKey.set(normalizeKey(r.url), r);

  const inbound = new Map<string, number>();
  let linkCount = 0;
  for (const r of results) {
    for (const l of r.internalLinks ?? []) {
      if (!l.isInternal) continue;
      linkCount++;
      const dest = normalizeKey(l.href, r.url);
      if (!byKey.has(dest)) continue;
      inbound.set(dest, (inbound.get(dest) ?? 0) + 1);
    }
  }

  const orphans: OrphanReport["orphans"] = [];
  const lowLink: OrphanReport["lowLink"] = [];

  for (const [key, r] of byKey) {
    const n = inbound.get(key) ?? 0;
    if (n === 0) {
      orphans.push({
        url: r.url,
        indexable: isOk(r) && !isNoindex(r),
        statusCode: r.statusCode,
      });
    } else if (n <= 2) {
      lowLink.push({ url: r.url, inbound: n });
    }
  }

  lowLink.sort((a, b) => a.inbound - b.inbound);

  return {
    orphans,
    lowLink,
    criticalOrphans: orphans.filter((o) => o.indexable).map((o) => o.url),
    hasLinkData: linkCount > 0,
  };
}

/* ───────────────────────── Redirect chains & loops ────────────────────── */

export interface ChainRow {
  url: string;
  hops: { url: string; status: number; type: string }[];
  hopCount: number;
  loop: boolean;
  endsInError: boolean;
  finalUrl: string;
  finalStatus: number;
}

export interface RedirectChainReport {
  rows: ChainRow[];
  longChains: ChainRow[];
  loops: ChainRow[];
  brokenEnds: ChainRow[];
  /** Internal links pointing at a URL that redirects. */
  linksToRedirects: { from: string; to: string }[];
}

export function analyseRedirectChains(results: CrawlResult[]): RedirectChainReport {
  const rows: ChainRow[] = [];
  const redirecting = new Set<string>();

  for (const r of results) {
    const chain = r.redirectChain ?? [];
    if (chain.length === 0) continue;
    redirecting.add(normalizeKey(r.url));

    const seen = new Set<string>();
    let loop = false;
    for (const h of chain) {
      const k = normalizeKey(h.url);
      if (seen.has(k)) loop = true;
      seen.add(k);
    }
    const finalUrl = r.finalUrl ?? r.redirectedUrl ?? chain[chain.length - 1]?.url ?? r.url;
    if (normalizeKey(finalUrl) === normalizeKey(r.url)) loop = true;

    rows.push({
      url: r.initialUrl ?? r.url,
      hops: chain.map((h) => ({ url: h.url, status: h.status, type: h.type })),
      hopCount: chain.length,
      loop,
      endsInError: r.statusCode >= 400,
      finalUrl,
      finalStatus: r.statusCode,
    });
  }

  rows.sort((a, b) => b.hopCount - a.hopCount);

  const linksToRedirects: { from: string; to: string }[] = [];
  for (const r of results) {
    for (const l of r.internalLinks ?? []) {
      if (!l.isInternal) continue;
      const dest = normalizeKey(l.href, r.url);
      if (redirecting.has(dest) && dest !== normalizeKey(r.url)) {
        linksToRedirects.push({ from: r.url, to: l.href });
      }
    }
  }

  return {
    rows,
    longChains: rows.filter((r) => r.hopCount >= 2),
    loops: rows.filter((r) => r.loop),
    brokenEnds: rows.filter((r) => r.endsInError),
    linksToRedirects,
  };
}

/* ────────────────────── Site structure by directory ───────────────────── */

export interface DirectoryRow {
  segment: string;
  urls: number;
  ok: number;
  redirects: number;
  errors: number;
  noindex: number;
  missingTitle: number;
  avgDepth: number | null;
}

export function buildDirectoryRollup(
  results: CrawlResult[],
  depths?: Map<string, number>
): DirectoryRow[] {
  const map = new Map<string, DirectoryRow & { depthSum: number; depthN: number }>();

  for (const r of results) {
    let segment = "/";
    try {
      const parts = new URL(r.url).pathname.split("/").filter(Boolean);
      segment = parts.length ? `/${parts[0]}` : "/";
    } catch {
      /* ignore */
    }

    const row =
      map.get(segment) ??
      {
        segment,
        urls: 0,
        ok: 0,
        redirects: 0,
        errors: 0,
        noindex: 0,
        missingTitle: 0,
        avgDepth: null,
        depthSum: 0,
        depthN: 0,
      };

    row.urls++;
    if (isOk(r)) row.ok++;
    if ((r.redirectChain?.length ?? 0) > 0 || (r.statusCode >= 300 && r.statusCode < 400)) row.redirects++;
    if (r.statusCode >= 400) row.errors++;
    if (isNoindex(r)) row.noindex++;
    if (isOk(r) && !r.title?.trim()) row.missingTitle++;

    const d = depths?.get(normalizeKey(r.url));
    if (typeof d === "number") {
      row.depthSum += d;
      row.depthN++;
    }

    map.set(segment, row);
  }

  return Array.from(map.values())
    .map((r) => ({
      segment: r.segment,
      urls: r.urls,
      ok: r.ok,
      redirects: r.redirects,
      errors: r.errors,
      noindex: r.noindex,
      missingTitle: r.missingTitle,
      avgDepth: r.depthN ? Math.round((r.depthSum / r.depthN) * 10) / 10 : null,
    }))
    .sort((a, b) => b.urls - a.urls);
}

/* ───────────── Insight-derived issues (feed scoring + hints) ──────────── */

/**
 * Turns the derived reports above into `SeoIssue` entries so they flow through
 * the same scoring, prioritisation and URL-appendix machinery as every other
 * rule. Only produced when the crawl actually captured internal links.
 */
export function buildInsightIssues(
  results: CrawlResult[],
  hasInternalLinks: boolean
): SeoIssue[] {
  const issues: SeoIssue[] = [];

  const chains = analyseRedirectChains(results);
  if (chains.longChains.length) {
    issues.push({
      id: "insight-redirect-chains",
      flag: "includeCanonical",
      group: "Redirects",
      title: `${chains.longChains.length} URL${chains.longChains.length === 1 ? "" : "s"} redirect through 2+ hops`,
      why: "Every extra hop wastes crawl budget, slows the page for users and leaks a little link equity. Search engines may also stop following long chains.",
      fix: "Update the first redirect so it points straight at the final destination, then fix any internal links that still reference the old URL.",
      severity: "warning",
      urls: chains.longChains.map((c) => c.url),
      count: chains.longChains.length,
    });
  }
  if (chains.loops.length) {
    issues.push({
      id: "insight-redirect-loops",
      flag: "includeCanonical",
      group: "Redirects",
      title: `${chains.loops.length} redirect loop${chains.loops.length === 1 ? "" : "s"} detected`,
      why: "A loop never resolves, so neither users nor crawlers can ever reach the content. The page is effectively removed from your site.",
      fix: "Trace the chain and remove the rule that sends the URL back to a previous hop; point it at a single canonical destination.",
      severity: "critical",
      urls: chains.loops.map((c) => c.url),
      count: chains.loops.length,
    });
  }
  if (chains.brokenEnds.length) {
    issues.push({
      id: "insight-redirect-broken-end",
      flag: "includeCanonical",
      group: "Redirects",
      title: `${chains.brokenEnds.length} redirect${chains.brokenEnds.length === 1 ? "" : "s"} end on an error page`,
      why: "Redirecting to a 4xx or 5xx destination wastes the redirect entirely and hands the visitor a dead end.",
      fix: "Repoint each redirect at a live, relevant page — or remove it and serve a proper 410 if the content is gone for good.",
      severity: "critical",
      urls: chains.brokenEnds.map((c) => c.url),
      count: chains.brokenEnds.length,
    });
  }

  if (!hasInternalLinks) return issues;

  const orphan = findOrphanPages(results);
  if (orphan.hasLinkData && orphan.criticalOrphans.length) {
    issues.push({
      id: "insight-orphan-pages",
      flag: "includeInternalLinks",
      group: "Internal Links",
      title: `${orphan.criticalOrphans.length} indexable page${orphan.criticalOrphans.length === 1 ? "" : "s"} with no internal links pointing to them`,
      why: "Orphaned pages receive no internal link equity and are hard for crawlers to discover, so they rarely rank even when the content is strong.",
      fix: "Link to each orphan from a relevant hub, category or navigation block — ideally within three clicks of the homepage.",
      severity: "critical",
      urls: orphan.criticalOrphans,
      count: orphan.criticalOrphans.length,
    });
  }
  if (orphan.hasLinkData && orphan.lowLink.length) {
    issues.push({
      id: "insight-low-link-pages",
      flag: "includeInternalLinks",
      group: "Internal Links",
      title: `${orphan.lowLink.length} page${orphan.lowLink.length === 1 ? "" : "s"} with only 1–2 internal links`,
      why: "Thinly linked pages look unimportant to search engines and are crawled less often than well-connected pages.",
      fix: "Add contextual internal links from related content so important pages pick up more inbound equity.",
      severity: "info",
      urls: orphan.lowLink.map((p) => p.url),
      count: orphan.lowLink.length,
    });
  }

  const depth = computeClickDepth(results);
  if (depth.deepPages.length) {
    issues.push({
      id: "insight-deep-pages",
      flag: "includeInternalLinks",
      group: "Internal Links",
      title: `${depth.deepPages.length} page${depth.deepPages.length === 1 ? "" : "s"} sit more than 3 clicks from the homepage`,
      why: "Click depth is a strong signal of importance. Deeply buried pages get crawled less frequently and convert worse because users struggle to find them.",
      fix: "Flatten the architecture: surface these pages from hub pages, category listings or the main navigation to bring them within three clicks.",
      severity: "warning",
      urls: depth.deepPages.map((p) => p.url),
      count: depth.deepPages.length,
    });
  }

  return issues;
}
