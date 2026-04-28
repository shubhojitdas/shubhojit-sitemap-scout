import type { CrawlResult, InternalLinkData } from "./crawl-api";

/**
 * Internal link equity scoring + outbound link attribute auditing.
 *
 * No external APIs, no PageRank iterations — uses a simple, transparent
 * "incoming-link weight" score that's easy to explain to SEO users:
 *
 *   score = round(log2(1 + incoming) * 25)   // 0..100-ish, capped at 100
 *
 * Anchor diversity is the ratio of unique anchor texts to total incoming
 * links (a value of 1 = perfect diversity, 0.1 = same anchor 90% of the
 * time = potential over-optimization signal).
 */

function normalizeUrl(u: string): string {
  try {
    const x = new URL(u);
    x.hash = "";
    // Drop trailing slash for consistent matching
    let p = x.pathname;
    if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
    return `${x.protocol}//${x.host}${p}${x.search}`;
  } catch {
    return u;
  }
}

export interface PageEquity {
  url: string;
  incoming: number;
  outgoing: number;
  uniqueAnchors: number;
  anchorDiversity: number; // 0..1
  /** 0..100 simple log-scaled score. */
  score: number;
  /** "strong" | "average" | "weak" | "orphan" */
  strength: "strong" | "average" | "weak" | "orphan";
  /** True if outgoing > 100 (very high — equity dilution risk). */
  overlinked: boolean;
  /** Top anchor text used to link TO this page (for review). */
  topAnchor?: string;
}

export interface EquityReport {
  pages: PageEquity[];
  maxIncoming: number;
}

export function computeLinkEquity(results: CrawlResult[]): EquityReport {
  // Build a quick lookup: normalized URL → CrawlResult
  const byUrl = new Map<string, CrawlResult>();
  for (const r of results) byUrl.set(normalizeUrl(r.url), r);

  // For every internal link, increment the destination's incoming count.
  const incomingCounts = new Map<string, number>();
  const anchorMap = new Map<string, Map<string, number>>(); // dest → anchor → count

  for (const r of results) {
    const links = r.internalLinks ?? [];
    for (const l of links) {
      if (!l.isInternal) continue;
      const dest = normalizeUrl(l.href);
      if (!byUrl.has(dest)) continue; // only count links to crawled pages
      incomingCounts.set(dest, (incomingCounts.get(dest) ?? 0) + 1);
      const anchorBag = anchorMap.get(dest) ?? new Map<string, number>();
      const a = (l.anchorText ?? "").trim().toLowerCase();
      if (a) anchorBag.set(a, (anchorBag.get(a) ?? 0) + 1);
      anchorMap.set(dest, anchorBag);
    }
  }

  const maxIncoming = Array.from(incomingCounts.values()).reduce(
    (m, v) => Math.max(m, v),
    0
  );

  const pages: PageEquity[] = results.map((r) => {
    const key = normalizeUrl(r.url);
    const incoming = incomingCounts.get(key) ?? 0;
    const outgoing = (r.internalLinks ?? []).filter((l) => l.isInternal).length;
    const anchorBag = anchorMap.get(key) ?? new Map<string, number>();
    const uniqueAnchors = anchorBag.size;
    const anchorDiversity = incoming > 0 ? uniqueAnchors / incoming : 0;

    // Log-scaled score — softens dominance of one super-linked page.
    const raw = Math.log2(1 + incoming) * 25;
    const score = Math.min(100, Math.round(raw));

    let strength: PageEquity["strength"] = "orphan";
    if (incoming === 0) strength = "orphan";
    else if (score >= 60) strength = "strong";
    else if (score >= 30) strength = "average";
    else strength = "weak";

    let topAnchor: string | undefined;
    if (anchorBag.size) {
      let max = 0;
      for (const [a, c] of anchorBag) {
        if (c > max) {
          max = c;
          topAnchor = a;
        }
      }
    }

    return {
      url: r.url,
      incoming,
      outgoing,
      uniqueAnchors,
      anchorDiversity,
      score,
      strength,
      overlinked: outgoing > 100,
      topAnchor,
    };
  });

  return { pages, maxIncoming };
}

// ─── Outbound link attribute audit ───────────────────────────────────────

export interface AuditedLink {
  pageUrl: string;
  href: string;
  anchorText: string;
  rel: string;
  nofollow: boolean;
  sponsored: boolean;
  ugc: boolean;
  isInternal: boolean;
  /** Status string for the table. */
  status: "Followed" | "Nofollow" | "Sponsored" | "UGC" | "No rel";
  /** True if outbound external link is missing rel="nofollow" / sponsored / ugc. */
  missingRecommendedRel: boolean;
}

export function auditLinks(results: CrawlResult[]): AuditedLink[] {
  const out: AuditedLink[] = [];
  for (const r of results) {
    for (const l of r.internalLinks ?? []) {
      const status: AuditedLink["status"] = l.sponsored
        ? "Sponsored"
        : l.ugc
        ? "UGC"
        : l.nofollow
        ? "Nofollow"
        : (l.rel ?? "").length > 0
        ? "Followed"
        : "No rel";
      out.push({
        pageUrl: r.url,
        href: l.href,
        anchorText: l.anchorText,
        rel: l.rel ?? "",
        nofollow: !!l.nofollow,
        sponsored: !!l.sponsored,
        ugc: !!l.ugc,
        isInternal: l.isInternal,
        status,
        // External links should normally carry one of nofollow/sponsored/ugc
        // unless they're trusted partner links — flag as missing for review.
        missingRecommendedRel:
          !l.isInternal && !l.nofollow && !l.sponsored && !l.ugc,
      });
    }
  }
  return out;
}
