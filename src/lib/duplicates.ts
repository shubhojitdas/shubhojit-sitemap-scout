import type { CrawlResult } from "./crawl-api";

/**
 * Duplicate / near-duplicate detection for Title, Description and H1.
 *
 * - Exact: case/whitespace-normalized match.
 * - Near-duplicate: token-set Jaccard similarity ≥ 0.85 over normalized words.
 *   Cheap, deterministic, no external libs — safe to run client-side on
 *   thousands of URLs.
 */

export type DupField = "title" | "description" | "h1";

export interface DuplicateGroup {
  field: DupField;
  /** Representative value (first occurrence). */
  value: string;
  /** Either "exact" or "near" duplicate group. */
  kind: "exact" | "near";
  /** Affected URLs (≥ 2). */
  urls: string[];
}

const STOP = new Set([
  "a","an","the","and","or","of","to","in","on","for","with","is","are","was","were",
  "be","by","at","as","it","its","this","that","from","you","your","our","we","i",
]);

function normalize(s: string): string {
  return (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function tokenSet(s: string): Set<string> {
  return new Set(
    normalize(s)
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((t) => t && t.length > 1 && !STOP.has(t))
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function pickValue(field: DupField, r: CrawlResult): string {
  if (field === "title") return r.title ?? "";
  if (field === "description") return r.description ?? "";
  return (r.h1s ?? [])[0] ?? "";
}

export function findDuplicateGroups(
  results: CrawlResult[],
  field: DupField,
  opts: { nearThreshold?: number; minTokensForNear?: number } = {}
): DuplicateGroup[] {
  const nearThreshold = opts.nearThreshold ?? 0.85;
  const minTokensForNear = opts.minTokensForNear ?? 4;

  // ── Exact buckets ──────────────────────────────────────────────────────
  const exactMap = new Map<string, { value: string; urls: string[] }>();
  const items: { url: string; raw: string; norm: string; tokens: Set<string> }[] = [];

  for (const r of results) {
    if (r.statusCode < 200 || r.statusCode >= 300) continue;
    const raw = pickValue(field, r);
    if (!raw || !raw.trim()) continue;
    const norm = normalize(raw);
    const entry = exactMap.get(norm);
    if (entry) entry.urls.push(r.url);
    else exactMap.set(norm, { value: raw, urls: [r.url] });
    items.push({ url: r.url, raw, norm, tokens: tokenSet(raw) });
  }

  const exactGroups: DuplicateGroup[] = [];
  const seenInExact = new Set<string>();
  for (const { value, urls } of exactMap.values()) {
    if (urls.length > 1) {
      exactGroups.push({ field, value, kind: "exact", urls });
      for (const u of urls) seenInExact.add(u);
    }
  }

  // ── Near-duplicates (skip URLs already in an exact group) ──────────────
  const candidates = items.filter(
    (it) => !seenInExact.has(it.url) && it.tokens.size >= minTokensForNear
  );

  const visited = new Set<string>();
  const nearGroups: DuplicateGroup[] = [];
  // O(n^2) but bounded: typical crawls < 50k, near-candidates much smaller
  // since we skip exact duplicates and short content.
  for (let i = 0; i < candidates.length; i++) {
    if (visited.has(candidates[i].url)) continue;
    const cluster: typeof candidates = [candidates[i]];
    visited.add(candidates[i].url);
    for (let j = i + 1; j < candidates.length; j++) {
      if (visited.has(candidates[j].url)) continue;
      const sim = jaccard(candidates[i].tokens, candidates[j].tokens);
      if (sim >= nearThreshold) {
        cluster.push(candidates[j]);
        visited.add(candidates[j].url);
      }
    }
    if (cluster.length > 1) {
      nearGroups.push({
        field,
        kind: "near",
        value: cluster[0].raw,
        urls: cluster.map((c) => c.url),
      });
    }
  }

  return [...exactGroups, ...nearGroups].sort((a, b) => b.urls.length - a.urls.length);
}

export const FIELD_LABEL: Record<DupField, string> = {
  title: "Meta Title",
  description: "Meta Description",
  h1: "H1 Tag",
};
