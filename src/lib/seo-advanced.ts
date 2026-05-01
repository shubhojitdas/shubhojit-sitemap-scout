import type { CrawlResult } from "./crawl-api";

/**
 * Advanced SEO analyzers — pure, dependency-free functions running on the
 * crawl data already gathered by the edge function. Each module is opt-in
 * and degrades gracefully when underlying fields weren't crawled.
 */

// ─── Shared helpers ──────────────────────────────────────────────────────
function normalizeUrl(u: string, base?: string): string {
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

const GENERIC_ANCHORS = new Set([
  "click here", "click", "here", "read more", "learn more", "more",
  "this", "this link", "link", "details", "see more", "view more",
  "view", "go", "go here", "find out more", "continue", "continue reading",
  "download", "download here",
]);

function tokenize(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9\s]+/g, " ").split(/\s+/).filter((t) => t.length > 2);
}

function shingles(tokens: string[], k = 3): Set<string> {
  const set = new Set<string>();
  if (tokens.length < k) {
    if (tokens.length) set.add(tokens.join(" "));
    return set;
  }
  for (let i = 0; i <= tokens.length - k; i++) {
    set.add(tokens.slice(i, i + k).join(" "));
  }
  return set;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

// ─── 1. Anchor Text Optimization Audit ───────────────────────────────────
export type AnchorIssueType =
  | "Empty Anchor"
  | "Image-Only Anchor"
  | "Generic Anchor"
  | "Repeated Anchor"
  | "Over-Optimized Anchor"
  | "Low Diversity";

export interface AnchorIssueRow {
  sourceUrl: string;
  destUrl: string;
  anchorText: string;
  repetitionCount: number;
  issueType: AnchorIssueType;
}

export interface AnchorAuditReport {
  rows: AnchorIssueRow[];
  totals: Record<AnchorIssueType, number>;
}

export function auditAnchors(results: CrawlResult[]): AnchorAuditReport {
  const rows: AnchorIssueRow[] = [];
  // anchor frequency per destination — to detect repeated/over-optimized patterns
  const destAnchorCount = new Map<string, Map<string, number>>();
  const destTotal = new Map<string, number>();
  const destAnchorSources = new Map<string, Map<string, string[]>>(); // dest -> anchor -> source URLs

  for (const r of results) {
    for (const l of r.internalLinks ?? []) {
      if (!l.isInternal) continue;
      const dest = normalizeUrl(l.href, r.url);
      const anchor = (l.anchorText ?? "").trim();
      const key = anchor.toLowerCase();
      destTotal.set(dest, (destTotal.get(dest) ?? 0) + 1);
      const bag = destAnchorCount.get(dest) ?? new Map();
      bag.set(key, (bag.get(key) ?? 0) + 1);
      destAnchorCount.set(dest, bag);
      const srcMap = destAnchorSources.get(dest) ?? new Map();
      const list = srcMap.get(key) ?? [];
      list.push(r.url);
      srcMap.set(key, list);
      destAnchorSources.set(dest, srcMap);
    }
  }

  const seen = new Set<string>();
  const push = (row: AnchorIssueRow) => {
    const k = `${row.sourceUrl}\u0001${row.destUrl}\u0001${row.anchorText}\u0001${row.issueType}`;
    if (seen.has(k)) return;
    seen.add(k);
    rows.push(row);
  };

  for (const r of results) {
    for (const l of r.internalLinks ?? []) {
      if (!l.isInternal) continue;
      const dest = normalizeUrl(l.href, r.url);
      const anchor = (l.anchorText ?? "").trim();
      const lower = anchor.toLowerCase();
      const repCount = destAnchorCount.get(dest)?.get(lower) ?? 1;
      const total = destTotal.get(dest) ?? 1;

      if (anchor === "") {
        // Distinguish empty vs image-only? We don't know image presence per-link;
        // treat empty text as Empty Anchor.
        push({ sourceUrl: r.url, destUrl: dest, anchorText: "(empty)", repetitionCount: repCount, issueType: "Empty Anchor" });
        continue;
      }
      if (GENERIC_ANCHORS.has(lower)) {
        push({ sourceUrl: r.url, destUrl: dest, anchorText: anchor, repetitionCount: repCount, issueType: "Generic Anchor" });
      }
      if (repCount >= 5 && total >= 5 && repCount / total > 0.6) {
        push({ sourceUrl: r.url, destUrl: dest, anchorText: anchor, repetitionCount: repCount, issueType: "Over-Optimized Anchor" });
      } else if (repCount >= 4) {
        push({ sourceUrl: r.url, destUrl: dest, anchorText: anchor, repetitionCount: repCount, issueType: "Repeated Anchor" });
      }
    }
  }

  // Low diversity per destination (>=5 incoming, unique anchors / incoming < 0.3)
  for (const [dest, bag] of destAnchorCount) {
    const total = destTotal.get(dest) ?? 0;
    if (total < 5) continue;
    const diversity = bag.size / total;
    if (diversity >= 0.3) continue;
    // attach one row per source page that links here
    const sources = destAnchorSources.get(dest);
    if (!sources) continue;
    for (const [anchor, srcs] of sources) {
      for (const src of srcs) {
        push({
          sourceUrl: src, destUrl: dest, anchorText: anchor || "(empty)",
          repetitionCount: bag.get(anchor) ?? 1, issueType: "Low Diversity",
        });
      }
    }
  }

  const totals: Record<AnchorIssueType, number> = {
    "Empty Anchor": 0, "Image-Only Anchor": 0, "Generic Anchor": 0,
    "Repeated Anchor": 0, "Over-Optimized Anchor": 0, "Low Diversity": 0,
  };
  for (const r of rows) totals[r.issueType]++;
  return { rows, totals };
}

// ─── 2. Redirect Chain Detection ─────────────────────────────────────────
export type RedirectWarning = "Single Redirect" | "Redirect Chain" | "Redirect Loop";

export interface RedirectChainRow {
  originalUrl: string;
  hopCount: number;
  finalUrl: string;
  path: string[];
  warning: RedirectWarning;
}

export function analyzeRedirects(results: CrawlResult[]): RedirectChainRow[] {
  const rows: RedirectChainRow[] = [];
  for (const r of results) {
    const chain = r.redirectChain ?? [];
    if (chain.length === 0) continue;
    const path = [r.initialUrl ?? r.url, ...chain.map((h) => h.url)];
    const hopCount = chain.length;
    const finalUrl = r.finalUrl ?? path[path.length - 1] ?? r.url;
    const seen = new Set<string>();
    let loop = false;
    for (const u of path) {
      const k = normalizeUrl(u);
      if (seen.has(k)) { loop = true; break; }
      seen.add(k);
    }
    let warning: RedirectWarning = "Single Redirect";
    if (loop) warning = "Redirect Loop";
    else if (hopCount >= 2) warning = "Redirect Chain";
    rows.push({
      originalUrl: r.initialUrl ?? r.url, hopCount, finalUrl, path, warning,
    });
  }
  return rows;
}

// ─── 3 + 4. Content Similarity + Cannibalization ─────────────────────────
/**
 * Body text isn't fetched directly — we build a document signature from the
 * fields the crawler already collects: title, description, H1/H2/H3. This
 * gives a useful proxy for "do these pages target the same topic?" without
 * needing a re-crawl of full HTML bodies.
 */
function pageSignature(r: CrawlResult): string {
  return [
    r.title ?? "",
    r.description ?? "",
    ...(r.h1s ?? []),
    ...(r.h2s ?? []),
    ...(r.h3s ?? []),
  ].join(" ");
}

export interface SimilarityPair {
  a: string;
  b: string;
  similarity: number;          // 0..1
  titleSim: number;
  h1Sim: number;
  contentSim: number;
  reasons: string[];           // "Title Similarity", "H1 Similarity", "Content Overlap"
  warning: "Possible Duplicate" | "Template Heavy" | "Near Duplicate";
}

export interface SimilarityReport {
  pairs: SimilarityPair[];
  /** Subset of pairs that look like keyword cannibalization. */
  cannibalization: SimilarityPair[];
}

export function analyzeSimilarity(
  results: CrawlResult[],
  threshold = 0.55,
  maxPairs = 200,
): SimilarityReport {
  const ok = results.filter((r) => r.statusCode >= 200 && r.statusCode < 300);
  const docs = ok.map((r) => ({
    url: r.url,
    sig: shingles(tokenize(pageSignature(r))),
    titleSig: shingles(tokenize(r.title ?? ""), 2),
    h1Sig: shingles(tokenize((r.h1s ?? []).join(" ")), 2),
  }));

  const pairs: SimilarityPair[] = [];
  for (let i = 0; i < docs.length; i++) {
    for (let j = i + 1; j < docs.length; j++) {
      const sim = jaccard(docs[i].sig, docs[j].sig);
      if (sim < threshold) continue;
      const titleSim = jaccard(docs[i].titleSig, docs[j].titleSig);
      const h1Sim = jaccard(docs[i].h1Sig, docs[j].h1Sig);
      const reasons: string[] = [];
      if (titleSim >= 0.6) reasons.push("Title Similarity");
      if (h1Sim >= 0.6) reasons.push("H1 Similarity");
      if (sim >= 0.7) reasons.push("Content Overlap");
      let warning: SimilarityPair["warning"] = "Template Heavy";
      if (sim >= 0.85) warning = "Near Duplicate";
      else if (sim >= 0.7) warning = "Possible Duplicate";
      pairs.push({
        a: docs[i].url, b: docs[j].url,
        similarity: sim, titleSim, h1Sim, contentSim: sim, reasons, warning,
      });
    }
  }
  pairs.sort((x, y) => y.similarity - x.similarity);
  const trimmed = pairs.slice(0, maxPairs);
  const cannibalization = trimmed.filter(
    (p) => p.titleSim >= 0.6 || p.h1Sim >= 0.6,
  );
  return { pairs: trimmed, cannibalization };
}

// ─── 5. SEO Opportunity Score ────────────────────────────────────────────
export interface PageScore {
  url: string;
  score: number;          // 0..100
  issues: string[];
  priorityFixes: string[];
}

export function scorePages(results: CrawlResult[]): PageScore[] {
  return results.map((r) => {
    let score = 100;
    const issues: string[] = [];
    const priorityFixes: string[] = [];

    const t = (r.title ?? "").trim();
    if (!t) { score -= 18; issues.push("Missing title"); priorityFixes.push("Add a unique 50–60 char <title>"); }
    else if (t.length < 30 || t.length > 60) { score -= 6; issues.push(`Title length ${t.length}`); }

    const d = (r.description ?? "").trim();
    if (!d) { score -= 12; issues.push("Missing description"); priorityFixes.push("Add a 120–160 char meta description"); }
    else if (d.length < 70 || d.length > 160) { score -= 4; issues.push(`Description length ${d.length}`); }

    const h1s = r.h1s ?? [];
    if (h1s.length === 0) { score -= 12; issues.push("Missing H1"); priorityFixes.push("Add one descriptive H1"); }
    else if (h1s.length > 1) { score -= 4; issues.push("Multiple H1s"); }

    const wc = r.wordCount ?? -1;
    if (wc >= 0 && wc < 100) { score -= 14; issues.push("Very thin content"); priorityFixes.push("Expand body content (300+ words)"); }
    else if (wc >= 100 && wc < 300) { score -= 6; issues.push("Thin content"); }

    const internal = (r.internalLinks ?? []).filter((l) => l.isInternal).length;
    if (internal === 0) { score -= 10; issues.push("No outbound internal links"); priorityFixes.push("Add 3–10 contextual internal links"); }
    else if (internal > 100) { score -= 4; issues.push("Overlinked (>100)"); }

    if ((r.schemas ?? []).length === 0) { score -= 6; issues.push("No structured data"); }

    if (r.statusCode >= 400) { score -= 30; issues.push(`HTTP ${r.statusCode}`); }
    else if ((r.redirectChain?.length ?? 0) >= 2) { score -= 6; issues.push("Redirect chain"); }

    score = Math.max(0, Math.min(100, score));
    return { url: r.url, score, issues, priorityFixes };
  });
}

// ─── 6. Content-to-Link Ratio ────────────────────────────────────────────
export interface ContentRatioRow {
  url: string;
  wordCount: number;
  internalLinks: number;
  ratio: number;          // wordCount / internalLinks (Infinity if 0 links)
  status: "Balanced" | "Overlinked" | "Underlinked" | "Unknown";
}

export function contentLinkRatio(results: CrawlResult[]): ContentRatioRow[] {
  return results.map((r) => {
    const wc = r.wordCount;
    const internal = (r.internalLinks ?? []).filter((l) => l.isInternal).length;
    if (wc === undefined) {
      return { url: r.url, wordCount: 0, internalLinks: internal, ratio: 0, status: "Unknown" as const };
    }
    if (internal === 0) {
      return { url: r.url, wordCount: wc, internalLinks: 0, ratio: Infinity, status: wc > 500 ? "Underlinked" as const : "Balanced" as const };
    }
    const ratio = wc / internal;
    let status: ContentRatioRow["status"] = "Balanced";
    if (ratio < 30 && wc < 500) status = "Overlinked";
    else if (ratio > 400 && wc > 600) status = "Underlinked";
    return { url: r.url, wordCount: wc, internalLinks: internal, ratio, status };
  });
}

// ─── 7. Page Type Classification ─────────────────────────────────────────
export type PageType = "Homepage" | "Category" | "Product" | "Blog/Article" | "Utility" | "Other";

export interface PageTypeRow {
  url: string;
  type: PageType;
}

export function classifyPages(results: CrawlResult[]): Map<string, PageType> {
  const out = new Map<string, PageType>();
  // Determine homepage by shortest path on most common host
  const hostCounts = new Map<string, number>();
  for (const r of results) {
    try { const h = new URL(r.url).host; hostCounts.set(h, (hostCounts.get(h) ?? 0) + 1); } catch { /* ignore */ }
  }
  for (const r of results) {
    out.set(r.url, classifyOne(r));
  }
  return out;
}

function hasSchemaType(r: CrawlResult, types: string[]): boolean {
  const schemas = r.schemas ?? [];
  if (schemas.length === 0) return false;
  const lower = types.map((t) => t.toLowerCase());
  for (const s of schemas) {
    const m = s.match(/"@type"\s*:\s*"([^"]+)"/gi) ?? [];
    for (const hit of m) {
      const v = hit.toLowerCase();
      if (lower.some((t) => v.includes(t))) return true;
    }
  }
  return false;
}

function looksLikeProductSlug(seg: string): boolean {
  // multi-word kebab/snake slug, e.g. "nike-air-max-90", "iphone-15-pro-256gb"
  // Heuristic: 2+ separators OR digits, length > 8.
  if (seg.length < 8) return false;
  const sepCount = (seg.match(/[-_]/g) ?? []).length;
  const hasDigits = /\d/.test(seg);
  return sepCount >= 2 || (sepCount >= 1 && hasDigits);
}

function classifyOne(r: CrawlResult): PageType {
  let path = "/";
  try { path = new URL(r.url).pathname.toLowerCase(); } catch { /* ignore */ }
  const segs = path.split("/").filter(Boolean);
  if (segs.length === 0 || path === "/") return "Homepage";
  const wrapped = "/" + segs.join("/") + "/";
  const last = segs[segs.length - 1];

  // 1. Strongest signal: structured data (Product / Article / etc.)
  if (hasSchemaType(r, ["Product", "ProductGroup"])) return "Product";
  if (hasSchemaType(r, ["BlogPosting", "NewsArticle", "Article"])) return "Blog/Article";
  if (hasSchemaType(r, ["CollectionPage", "ItemList"])) return "Category";

  // 2. Utility / system pages
  const utilPatterns = /(login|signin|signup|register|account|cart|checkout|terms|privacy|policy|cookie|sitemap|search|404|contact|legal|refund|shipping|wishlist|compare|thank-you)/;
  if (utilPatterns.test(path)) return "Utility";

  // 3. Blog patterns
  const blogPatterns = /(\/blog\/|\/blogs\/|\/news\/|\/article\/|\/articles\/|\/post\/|\/posts\/|\/insights\/|\/journal\/|\/stories\/|\/story\/|\/guide\/|\/guides\/|\/tutorial\/|\/tutorials\/|\/learn\/|\/resources\/)/;
  if (blogPatterns.test(wrapped)) {
    // /blog/ alone (single seg) is the blog index → Category-like, but label as Blog/Article
    return "Blog/Article";
  }

  // 4. Explicit product paths
  const productPathPatterns = /(\/product\/|\/products\/|\/p\/|\/item\/|\/items\/|\/dp\/)/;
  if (productPathPatterns.test(wrapped)) {
    // Shopify pattern: /products/<slug> → product. /products on its own → category.
    if (segs.length === 1) return "Category";
    return "Product";
  }

  // 5. Explicit collection / category paths
  const categoryPathPatterns = /(\/category\/|\/categories\/|\/collection\/|\/collections\/|\/cat\/|\/tag\/|\/tags\/|\/topics?\/|\/department\/|\/shop\/|\/store\/|\/range\/)/;
  if (categoryPathPatterns.test(wrapped)) {
    // /collections/<handle>/products/<slug> → Product
    if (/\/products?\//.test(wrapped) && segs.length >= 4) return "Product";
    return "Category";
  }

  // 6. Slug-shape heuristic — deep path with a multi-word slug usually = product/article
  if (segs.length >= 2 && looksLikeProductSlug(last)) {
    // Distinguish blog-ish content (long-form) from product (short body, has price-like signals)
    const wc = r.wordCount ?? 0;
    const h2 = (r.h2s ?? []).length;
    if (wc >= 600 && h2 >= 3) return "Blog/Article";
    return "Product";
  }

  // 7. Heuristic by content shape — long article-shaped pages
  const wc = r.wordCount ?? 0;
  const h2 = (r.h2s ?? []).length;
  if (wc >= 600 && h2 >= 3) return "Blog/Article";

  // 8. Single-segment landing → Category
  if (segs.length === 1) return "Category";

  return "Other";
}

// ─── 8. Crawl Anomaly Detection ──────────────────────────────────────────
export type AnomalySeverity = "low" | "medium" | "high";
export type AnomalyType =
  | "Missing Title" | "Missing Description" | "Zero Word Count"
  | "Zero Internal Links" | "Excessive Internal Links" | "HTTP Error"
  | "Redirect Loop";

export interface AnomalyRow {
  url: string;
  type: AnomalyType;
  severity: AnomalySeverity;
}

export function detectAnomalies(results: CrawlResult[]): AnomalyRow[] {
  const out: AnomalyRow[] = [];
  for (const r of results) {
    const ok = r.statusCode >= 200 && r.statusCode < 300;
    if (!ok) {
      out.push({ url: r.url, type: "HTTP Error", severity: "high" });
      continue;
    }
    if (!(r.title ?? "").trim()) out.push({ url: r.url, type: "Missing Title", severity: "high" });
    if (!(r.description ?? "").trim()) out.push({ url: r.url, type: "Missing Description", severity: "medium" });
    if (typeof r.wordCount === "number" && r.wordCount === 0) {
      out.push({ url: r.url, type: "Zero Word Count", severity: "high" });
    }
    const internal = (r.internalLinks ?? []).filter((l) => l.isInternal).length;
    if (internal === 0) out.push({ url: r.url, type: "Zero Internal Links", severity: "medium" });
    else if (internal > 200) out.push({ url: r.url, type: "Excessive Internal Links", severity: "low" });

    const chain = r.redirectChain ?? [];
    if (chain.length) {
      const seen = new Set<string>();
      let loop = false;
      for (const h of chain) {
        const k = normalizeUrl(h.url);
        if (seen.has(k)) { loop = true; break; }
        seen.add(k);
      }
      if (loop) out.push({ url: r.url, type: "Redirect Loop", severity: "high" });
    }
  }
  return out;
}
