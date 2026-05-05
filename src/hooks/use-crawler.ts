import { useState, useCallback, useRef, useEffect } from "react";
import { CrawlResult, parseSitemapUrls, spiderSiteUrls, fetchMetaBatch } from "@/lib/crawl-api";

export interface LastCrawlInput {
  source: "sitemap" | "site" | "urls";
  /** The original input the user typed: a sitemap URL, a site root URL, or a textual list. */
  display: string;
  /** When the source is "urls", this stores the actual URL list. */
  urls?: string[];
}

interface CrawlState {
  phase: "idle" | "parsing" | "crawling" | "paused" | "done" | "error";
  crawlSource: "sitemap" | "site" | "urls" | null;
  results: CrawlResult[];
  totalUrls: number;
  processedUrls: number;
  error: string | null;
  includeTitle: boolean;
  includeDesc: boolean;
  includeH2: boolean;
  includeH3: boolean;
  parsedUrls: string[];
  lastInput: LastCrawlInput | null;
  /** Tracks every flag that has been crawled at least once on the current dataset. */
  crawledFlags: CrawlOptions;
  /** Tracks the full field selection for the current/restored crawl session. */
  selectedOptions: CrawlOptions;
  /** True when running an incremental extract (extendCrawl), so progress UI can label it. */
  incremental: boolean;
  /** Wall-clock ISO of when the current crawl was started. */
  crawlStartedAt: string | null;
  /** Wall-clock ISO of when the most recent crawl batch finished. */
  crawlCompletedAt: string | null;
  /** ISO of the most recent crawl activity (start, completion, or extension) in this dataset. */
  lastCrawledAt: string | null;
}

export interface CrawlOptions {
  includeTitle: boolean;
  includeDesc: boolean;
  includeH1: boolean;
  includeH2: boolean;
  includeH3: boolean;
  includeImages: boolean;
  includeSchemas: boolean;
  includeRobots: boolean;
  includeCanonical: boolean;
  includeHreflangs: boolean;
  includeInternalLinks: boolean;
  jsRenderedLinks: boolean;
  includeSocialTags: boolean;
}

const EMPTY_CRAWL_OPTIONS: CrawlOptions = {
  includeTitle: false, includeDesc: false, includeH1: false, includeH2: false, includeH3: false,
  includeImages: false, includeSchemas: false, includeRobots: false, includeCanonical: false,
  includeHreflangs: false, includeInternalLinks: false, jsRenderedLinks: false, includeSocialTags: false,
};

const DEFAULT_OPTS: CrawlOptions = {
  includeTitle: true, includeDesc: true, includeH1: false, includeH2: false, includeH3: false,
  includeImages: false, includeSchemas: false, includeRobots: false, includeCanonical: false,
  includeHreflangs: false, includeInternalLinks: false, jsRenderedLinks: false, includeSocialTags: false,
};

const INITIAL_STATE: CrawlState = {
  phase: "idle",
  crawlSource: null,
  results: [],
  totalUrls: 0,
  processedUrls: 0,
  error: null,
  includeTitle: true,
  includeDesc: true,
  includeH2: false,
  includeH3: false,
  parsedUrls: [],
  lastInput: null,
  crawledFlags: EMPTY_CRAWL_OPTIONS,
  selectedOptions: EMPTY_CRAWL_OPTIONS,
  incremental: false,
  crawlStartedAt: null,
  crawlCompletedAt: null,
  lastCrawledAt: null,
};

const STORAGE_KEY = "sitemap-scout-crawl-data";
const DB_NAME = "sitemap-scout-crawl-store";
const DB_VERSION = 1;
const DB_STORE = "sessions";
const DB_SESSION_KEY = "current";

const EMPTY_RESULT_FIELDS = { h2s: [] as string[], h3s: [] as string[], images: [], schemas: [] as string[], robots: '', canonical: '', canonicalStatus: 'Missing' as const, hreflangs: [], internalLinks: [] };

function hasAnyOption(options: CrawlOptions) {
  return Object.values(options).some(Boolean);
}

/**
 * Sanitize a list of URLs: trim whitespace, reject obviously malformed entries
 * (e.g. two URLs concatenated together — a common WordPress sitemap bug),
 * and deduplicate.
 */
function sanitizeUrlList(urls: string[]): string[] {
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const raw of urls) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    // Detect concatenated URLs: if the string contains "http" after position 8
    // it likely has two URLs jammed together (e.g. ".../page/https://...")
    const secondHttp = trimmed.indexOf("http", 8);
    if (secondHttp > 0) {
      // Split into the two individual URLs
      const first = trimmed.slice(0, secondHttp).trim();
      const second = trimmed.slice(secondHttp).trim();
      for (const u of [first, second]) {
        try { new URL(u); } catch { continue; }
        if (!seen.has(u)) { seen.add(u); clean.push(u); }
      }
      continue;
    }
    try { new URL(trimmed); } catch { continue; }
    if (!seen.has(trimmed)) { seen.add(trimmed); clean.push(trimmed); }
  }
  return clean;
}

function normalizeOptions(options?: Partial<CrawlOptions> | null, fallback: CrawlOptions = EMPTY_CRAWL_OPTIONS): CrawlOptions {
  return { ...fallback, ...(options ?? {}) };
}

function inferOptionsFromResults(data: Partial<CrawlState>): CrawlOptions {
  const results = Array.isArray(data.results) ? data.results : [];
  const inferred = normalizeOptions(data.crawledFlags, normalizeOptions(data.selectedOptions));

  if (hasAnyOption(inferred)) return inferred;

  return {
    includeTitle: !!data.includeTitle || results.some((r) => !!r.title),
    includeDesc: !!data.includeDesc || results.some((r) => !!r.description),
    includeH1: results.some((r) => Array.isArray(r.h1s) && r.h1s.length > 0),
    includeH2: !!data.includeH2 || results.some((r) => Array.isArray(r.h2s) && r.h2s.length > 0),
    includeH3: !!data.includeH3 || results.some((r) => Array.isArray(r.h3s) && r.h3s.length > 0),
    includeImages: results.some((r) => Array.isArray(r.images) && r.images.length > 0),
    includeSchemas: results.some((r) => Array.isArray(r.schemas) && r.schemas.length > 0),
    includeRobots: results.some((r) => typeof r.robots === "string" && r.robots.length > 0),
    includeCanonical: results.some((r) => typeof r.canonical === "string" && r.canonical.length > 0),
    includeHreflangs: results.some((r) => Array.isArray(r.hreflangs) && r.hreflangs.length > 0),
    includeInternalLinks: results.some((r) => Array.isArray(r.internalLinks) && r.internalLinks.length > 0),
    jsRenderedLinks: false,
    includeSocialTags: results.some((r) => !!r.socialTags),
  };
}

function normalizePersistedState(data: Partial<CrawlState> | null): CrawlState | null {
  if (!data) return null;
  const results = Array.isArray(data.results) ? data.results : [];
  const parsedUrls = Array.isArray(data.parsedUrls) ? data.parsedUrls : [];
  const hasSession = results.length > 0 || parsedUrls.length > 0 || !!data.lastInput;
  if (!hasSession) return null;

  const inferredOptions = inferOptionsFromResults(data);
  const selectedOptions = normalizeOptions(data.selectedOptions, inferredOptions);
  const crawledFlags = normalizeOptions(data.crawledFlags, hasAnyOption(inferredOptions) ? inferredOptions : selectedOptions);

  return {
    ...INITIAL_STATE,
    ...data,
    results,
    parsedUrls,
    crawlSource: data.crawlSource ?? null,
    lastInput: data.lastInput ?? null,
    crawledFlags,
    selectedOptions,
    incremental: false,
    crawlStartedAt: data.crawlStartedAt ?? null,
    crawlCompletedAt: data.crawlCompletedAt ?? null,
    lastCrawledAt: data.lastCrawledAt ?? data.crawlCompletedAt ?? data.crawlStartedAt ?? null,
    phase: data.phase === "crawling" || data.phase === "parsing" || data.phase === "paused" ? "done" : data.phase ?? "done",
  };
}

function shouldPersistSession(state: CrawlState) {
  return state.results.length > 0 || state.parsedUrls.length > 0 || !!state.lastInput || state.phase !== "idle";
}

function loadPersistedState(): CrawlState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizePersistedState(JSON.parse(raw) as Partial<CrawlState>);
  } catch { /* ignore corrupt data */ }
  return null;
}

function persistState(state: CrawlState) {
  try {
    if (shouldPersistSession(state)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  } catch { /* storage full or unavailable */ }
}

function openSessionDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadPersistedStateFromDb(): Promise<CrawlState | null> {
  try {
    const db = await openSessionDb();
    return await new Promise<CrawlState | null>((resolve) => {
      const tx = db.transaction(DB_STORE, "readonly");
      const request = tx.objectStore(DB_STORE).get(DB_SESSION_KEY);
      request.onsuccess = () => resolve(normalizePersistedState(request.result as Partial<CrawlState> | null));
      request.onerror = () => resolve(null);
      tx.oncomplete = () => db.close();
      tx.onerror = () => db.close();
    });
  } catch {
    return null;
  }
}

async function persistStateToDb(state: CrawlState) {
  if (!shouldPersistSession(state)) return;
  try {
    const db = await openSessionDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).put(state, DB_SESSION_KEY);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); resolve(); };
      tx.onabort = () => { db.close(); resolve(); };
    });
  } catch { /* IndexedDB unavailable */ }
}

async function clearPersistedStateFromDb() {
  try {
    const db = await openSessionDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).delete(DB_SESSION_KEY);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); resolve(); };
      tx.onabort = () => { db.close(); resolve(); };
    });
  } catch { /* IndexedDB unavailable */ }
}

/** Merge an incremental batch into existing results: keep existing fields, only overwrite the
 *  ones the user requested in this incremental crawl. Uses URL as join key. */
function mergeResults(existing: CrawlResult[], fresh: CrawlResult[], opts: CrawlOptions): CrawlResult[] {
  const byUrl = new Map(fresh.map((r) => [r.url, r]));
  return existing.map((old) => {
    const f = byUrl.get(old.url);
    if (!f) return old;
    const merged: CrawlResult = { ...old };
    if (opts.includeTitle) merged.title = f.title;
    if (opts.includeDesc) merged.description = f.description;
    if (opts.includeH1) merged.h1s = f.h1s;
    if (opts.includeH2) merged.h2s = f.h2s;
    if (opts.includeH3) merged.h3s = f.h3s;
    if (opts.includeImages) merged.images = f.images;
    if (opts.includeSchemas) merged.schemas = f.schemas;
    if (opts.includeRobots) merged.robots = f.robots;
    if (opts.includeCanonical) { merged.canonical = f.canonical; merged.canonicalStatus = f.canonicalStatus; }
    if (opts.includeHreflangs) merged.hreflangs = f.hreflangs;
    if (opts.includeInternalLinks) merged.internalLinks = f.internalLinks;
    if (opts.includeSocialTags) merged.socialTags = f.socialTags;
    return merged;
  });
}

export function useCrawler() {
  const [state, setState] = useState<CrawlState>(() => loadPersistedState() || INITIAL_STATE);

  useEffect(() => {
    let cancelled = false;
    loadPersistedStateFromDb().then((stored) => {
      if (!cancelled && stored && stored.results.length >= state.results.length) {
        setState(stored);
      }
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    persistState(state);
    persistStateToDb(state);
  }, [state]);

  // Warn the user before closing/refreshing the tab while a crawl is active
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (state.phase === "crawling" || state.phase === "parsing" || state.phase === "paused") {
        e.preventDefault();
        // Legacy browsers need returnValue
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [state.phase]);

  const controllerRef = useRef<AbortController | null>(null);
  const pausedRef = useRef(false);
  const pendingUrlsRef = useRef<string[]>([]);
  const pendingIndexRef = useRef(0);
  const crawlOptionsRef = useRef<CrawlOptions>(DEFAULT_OPTS);
  const accumulatedResultsRef = useRef<CrawlResult[]>([]);

  const startController = () => {
    if (controllerRef.current) controllerRef.current.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    pausedRef.current = false;
    return controller.signal;
  };

  const runBatches = async (
    urls: string[],
    signal: AbortSignal,
    opts: CrawlOptions,
    startIndex = 0,
    existingResults: CrawlResult[] = [],
  ) => {
    const allResults: CrawlResult[] = [...existingResults];
    // Balanced batch size: large enough to amortize round-trip latency,
    // small enough that progress updates feel responsive and we never
    // overwhelm a target site's server. Pairs with the edge function's
    // 8-wide concurrent pool (4 for JS-rendered).
    const BATCH_SIZE = 16;

    // ── Redirect-dedup bookkeeping ───────────────────────────────────────────
    // Track every URL we've already represented in the crawl (either because
    // we crawled it directly OR because it was reached as the final destination
    // of an earlier redirect chain). Any URL already in this set is skipped on
    // subsequent batches so we never crawl the same final page twice.
    const seenUrls = new Set<string>();
    const norm = (u: string) => {
      try {
        const parsed = new URL(u);
        // Normalize trailing slash + lowercase host so /foo and /foo/ collapse.
        let path = parsed.pathname.replace(/\/+$/, "") || "/";
        return `${parsed.protocol}//${parsed.host.toLowerCase()}${path}${parsed.search}`;
      } catch { return u; }
    };
    for (const r of allResults) {
      seenUrls.add(norm(r.url));
      if (r.finalUrl) seenUrls.add(norm(r.finalUrl));
    }

    for (let i = startIndex; i < urls.length; i += BATCH_SIZE) {
      if (signal.aborted) return;
      if (pausedRef.current) {
        pendingIndexRef.current = i;
        accumulatedResultsRef.current = [...allResults];
        setState((s) => ({ ...s, phase: "paused" }));
        return;
      }
      // Filter out URLs that are already represented (avoid re-crawling
      // redirect destinations that we've already resolved).
      const rawBatch = urls.slice(i, i + BATCH_SIZE);
      const batch = rawBatch.filter((u) => !seenUrls.has(norm(u)));
      if (batch.length === 0) {
        setState((s) => ({ ...s, processedUrls: Math.min(i + BATCH_SIZE, urls.length) }));
        continue;
      }
      try {
        const batchResults = await fetchMetaBatch(batch, opts.includeTitle, opts.includeDesc, opts.includeH1, opts.includeH2, opts.includeH3, opts.includeImages, opts.includeSchemas, opts.includeRobots, opts.includeCanonical, opts.includeHreflangs, opts.includeInternalLinks, opts.jsRenderedLinks, opts.includeSocialTags);
        if (signal.aborted) return;
        if (pausedRef.current) {
          for (const r of batchResults) { seenUrls.add(norm(r.url)); if (r.finalUrl) seenUrls.add(norm(r.finalUrl)); }
          allResults.push(...batchResults);
          pendingIndexRef.current = i + BATCH_SIZE;
          accumulatedResultsRef.current = [...allResults];
          setState((s) => ({ ...s, results: [...allResults], processedUrls: Math.min(i + BATCH_SIZE, urls.length), phase: "paused" }));
          return;
        }
        for (const r of batchResults) { seenUrls.add(norm(r.url)); if (r.finalUrl) seenUrls.add(norm(r.finalUrl)); }
        allResults.push(...batchResults);
      } catch {
        if (signal.aborted) return;
        batch.forEach((url) => {
          allResults.push({ url, title: "", description: "", h1s: [], ...EMPTY_RESULT_FIELDS, status: "Error", statusCode: 0, redirectType: 'none', redirectChain: [], hopCount: 0, initialUrl: url, finalUrl: url, fetchTime: "0s" });
          seenUrls.add(norm(url));
        });
      }
      if (signal.aborted) return;
      setState((s) => ({ ...s, results: [...allResults], processedUrls: Math.min(i + BATCH_SIZE, urls.length) }));
    }

    if (!signal.aborted && !pausedRef.current) {
      const completedAt = new Date().toISOString();
      setState((s) => ({
        ...s,
        phase: "done",
        crawledFlags: {
          includeTitle: s.crawledFlags.includeTitle || opts.includeTitle,
          includeDesc: s.crawledFlags.includeDesc || opts.includeDesc,
          includeH1: s.crawledFlags.includeH1 || opts.includeH1,
          includeH2: s.crawledFlags.includeH2 || opts.includeH2,
          includeH3: s.crawledFlags.includeH3 || opts.includeH3,
          includeImages: s.crawledFlags.includeImages || opts.includeImages,
          includeSchemas: s.crawledFlags.includeSchemas || opts.includeSchemas,
          includeRobots: s.crawledFlags.includeRobots || opts.includeRobots,
          includeCanonical: s.crawledFlags.includeCanonical || opts.includeCanonical,
          includeHreflangs: s.crawledFlags.includeHreflangs || opts.includeHreflangs,
          includeInternalLinks: s.crawledFlags.includeInternalLinks || opts.includeInternalLinks,
          jsRenderedLinks: s.crawledFlags.jsRenderedLinks || opts.jsRenderedLinks,
          includeSocialTags: s.crawledFlags.includeSocialTags || opts.includeSocialTags,
        },
        selectedOptions: {
          includeTitle: s.selectedOptions.includeTitle || opts.includeTitle,
          includeDesc: s.selectedOptions.includeDesc || opts.includeDesc,
          includeH1: s.selectedOptions.includeH1 || opts.includeH1,
          includeH2: s.selectedOptions.includeH2 || opts.includeH2,
          includeH3: s.selectedOptions.includeH3 || opts.includeH3,
          includeImages: s.selectedOptions.includeImages || opts.includeImages,
          includeSchemas: s.selectedOptions.includeSchemas || opts.includeSchemas,
          includeRobots: s.selectedOptions.includeRobots || opts.includeRobots,
          includeCanonical: s.selectedOptions.includeCanonical || opts.includeCanonical,
          includeHreflangs: s.selectedOptions.includeHreflangs || opts.includeHreflangs,
          includeInternalLinks: s.selectedOptions.includeInternalLinks || opts.includeInternalLinks,
          jsRenderedLinks: s.selectedOptions.jsRenderedLinks || opts.jsRenderedLinks,
          includeSocialTags: s.selectedOptions.includeSocialTags || opts.includeSocialTags,
        },
        incremental: false,
        crawlCompletedAt: completedAt,
        lastCrawledAt: completedAt,
      }));
    }
  };

  const crawl = useCallback(async (
    sitemapUrl: string,
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
  ) => {
    const signal = startController();
    const opts: CrawlOptions = { includeTitle, includeDesc, includeH1, includeH2, includeH3, includeImages, includeSchemas, includeRobots, includeCanonical, includeHreflangs, includeInternalLinks, jsRenderedLinks, includeSocialTags };
    crawlOptionsRef.current = opts;
    pendingUrlsRef.current = [];
    pendingIndexRef.current = 0;
    accumulatedResultsRef.current = [];
    const startedAt = new Date().toISOString();
    setState({ ...INITIAL_STATE, phase: "parsing", crawlSource: "sitemap", lastInput: { source: "sitemap", display: sitemapUrl }, includeTitle, includeDesc, includeH2, includeH3, selectedOptions: opts, crawlStartedAt: startedAt, crawlCompletedAt: null, lastCrawledAt: startedAt });

    try {
      const rawUrls = await parseSitemapUrls(sitemapUrl);
      if (signal.aborted) return;
      const urls = sanitizeUrlList(rawUrls);

      if (urls.length === 0) {
        if (!signal.aborted) setState((s) => ({ ...s, phase: "error", error: "No URLs found in sitemap" }));
        return;
      }

      pendingUrlsRef.current = urls;
      setState((s) => ({ ...s, phase: "crawling", totalUrls: urls.length, parsedUrls: urls }));
      await runBatches(urls, signal, opts);
    } catch (err) {
      if (!signal.aborted) {
        setState((s) => ({
          ...s,
          phase: "error",
          error: err instanceof Error ? err.message : "An error occurred",
        }));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const crawlUrls = useCallback(async (
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
  ) => {
    const signal = startController();
    const opts: CrawlOptions = { includeTitle, includeDesc, includeH1, includeH2, includeH3, includeImages, includeSchemas, includeRobots, includeCanonical, includeHreflangs, includeInternalLinks, jsRenderedLinks, includeSocialTags };
    const cleanUrls = sanitizeUrlList(urls);
    crawlOptionsRef.current = opts;
    pendingUrlsRef.current = cleanUrls;
    pendingIndexRef.current = 0;
    accumulatedResultsRef.current = [];
    const display = cleanUrls.length === 1 ? cleanUrls[0] : `${cleanUrls.length} URLs`;
    const startedAt = new Date().toISOString();
    setState({ ...INITIAL_STATE, phase: "crawling", crawlSource: "urls", totalUrls: cleanUrls.length, parsedUrls: cleanUrls, lastInput: { source: "urls", display, urls: cleanUrls }, includeTitle, includeDesc, includeH2, includeH3, selectedOptions: opts, crawlStartedAt: startedAt, crawlCompletedAt: null, lastCrawledAt: startedAt });

    try {
      await runBatches(cleanUrls, signal, opts);
    } catch (err) {
      if (!signal.aborted) {
        setState((s) => ({
          ...s,
          phase: "error",
          error: err instanceof Error ? err.message : "An error occurred",
        }));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const spiderSite = useCallback(async (
    siteUrl: string,
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
  ) => {
    const signal = startController();
    const opts: CrawlOptions = { includeTitle, includeDesc, includeH1, includeH2, includeH3, includeImages, includeSchemas, includeRobots, includeCanonical, includeHreflangs, includeInternalLinks, jsRenderedLinks, includeSocialTags };
    crawlOptionsRef.current = opts;
    pendingUrlsRef.current = [];
    pendingIndexRef.current = 0;
    accumulatedResultsRef.current = [];
    const startedAt = new Date().toISOString();
    setState({ ...INITIAL_STATE, phase: "parsing", crawlSource: "site", lastInput: { source: "site", display: siteUrl }, includeTitle, includeDesc, includeH2, includeH3, selectedOptions: opts, crawlStartedAt: startedAt, crawlCompletedAt: null, lastCrawledAt: startedAt });

    try {
      const urls = await spiderSiteUrls(siteUrl);
      if (signal.aborted) return;

      if (urls.length === 0) {
        if (!signal.aborted) setState((s) => ({ ...s, phase: "error", error: "No internal URLs discovered. The site may block crawlers or have no internal links." }));
        return;
      }

      pendingUrlsRef.current = urls;
      setState((s) => ({ ...s, phase: "crawling", totalUrls: urls.length, parsedUrls: urls }));
      await runBatches(urls, signal, opts);
    } catch (err) {
      if (!signal.aborted) {
        setState((s) => ({
          ...s,
          phase: "error",
          error: err instanceof Error ? err.message : "An error occurred",
        }));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Re-crawl the existing dataset's URLs to extract additional (or refresh existing)
   * fields without re-discovering URLs. Results are merged into the current dataset.
   * Pass only the flags you want to (re)extract — other fields are preserved.
   */
  const extendCrawl = useCallback(async (extraOpts: Partial<CrawlOptions>) => {
    const opts: CrawlOptions = { ...DEFAULT_OPTS, ...extraOpts };
    // If nothing new requested, bail.
    if (!Object.values(opts).some(Boolean)) return;

    const targetUrls = state.results.map((r) => r.url);
    if (targetUrls.length === 0) return;

    const signal = startController();
    crawlOptionsRef.current = opts;
    accumulatedResultsRef.current = [];

    const startedAt = new Date().toISOString();
    setState((s) => ({
      ...s,
      phase: "crawling",
      totalUrls: targetUrls.length,
      processedUrls: 0,
      error: null,
      incremental: true,
        selectedOptions: {
          includeTitle: s.selectedOptions.includeTitle || opts.includeTitle,
          includeDesc: s.selectedOptions.includeDesc || opts.includeDesc,
          includeH1: s.selectedOptions.includeH1 || opts.includeH1,
          includeH2: s.selectedOptions.includeH2 || opts.includeH2,
          includeH3: s.selectedOptions.includeH3 || opts.includeH3,
          includeImages: s.selectedOptions.includeImages || opts.includeImages,
          includeSchemas: s.selectedOptions.includeSchemas || opts.includeSchemas,
          includeRobots: s.selectedOptions.includeRobots || opts.includeRobots,
          includeCanonical: s.selectedOptions.includeCanonical || opts.includeCanonical,
          includeHreflangs: s.selectedOptions.includeHreflangs || opts.includeHreflangs,
          includeInternalLinks: s.selectedOptions.includeInternalLinks || opts.includeInternalLinks,
          jsRenderedLinks: s.selectedOptions.jsRenderedLinks || opts.jsRenderedLinks,
          includeSocialTags: s.selectedOptions.includeSocialTags || opts.includeSocialTags,
        },
      crawlStartedAt: startedAt,
      crawlCompletedAt: null,
      lastCrawledAt: startedAt,
    }));

    const BATCH_SIZE = 10;
    let merged = state.results;
    for (let i = 0; i < targetUrls.length; i += BATCH_SIZE) {
      if (signal.aborted) return;
      const batch = targetUrls.slice(i, i + BATCH_SIZE);
      try {
        const fresh = await fetchMetaBatch(batch, opts.includeTitle, opts.includeDesc, opts.includeH1, opts.includeH2, opts.includeH3, opts.includeImages, opts.includeSchemas, opts.includeRobots, opts.includeCanonical, opts.includeHreflangs, opts.includeInternalLinks, opts.jsRenderedLinks, opts.includeSocialTags);
        if (signal.aborted) return;
        merged = mergeResults(merged, fresh, opts);
        setState((s) => ({ ...s, results: merged, processedUrls: Math.min(i + BATCH_SIZE, targetUrls.length) }));
      } catch {
        if (signal.aborted) return;
        // skip batch on error, continue
      }
    }

    if (!signal.aborted) {
      const completedAt = new Date().toISOString();
      setState((s) => ({
        ...s,
        phase: "done",
        incremental: false,
        crawledFlags: {
          includeTitle: s.crawledFlags.includeTitle || opts.includeTitle,
          includeDesc: s.crawledFlags.includeDesc || opts.includeDesc,
          includeH1: s.crawledFlags.includeH1 || opts.includeH1,
          includeH2: s.crawledFlags.includeH2 || opts.includeH2,
          includeH3: s.crawledFlags.includeH3 || opts.includeH3,
          includeImages: s.crawledFlags.includeImages || opts.includeImages,
          includeSchemas: s.crawledFlags.includeSchemas || opts.includeSchemas,
          includeRobots: s.crawledFlags.includeRobots || opts.includeRobots,
          includeCanonical: s.crawledFlags.includeCanonical || opts.includeCanonical,
          includeHreflangs: s.crawledFlags.includeHreflangs || opts.includeHreflangs,
          includeInternalLinks: s.crawledFlags.includeInternalLinks || opts.includeInternalLinks,
          jsRenderedLinks: s.crawledFlags.jsRenderedLinks || opts.jsRenderedLinks,
          includeSocialTags: s.crawledFlags.includeSocialTags || opts.includeSocialTags,
        },
        selectedOptions: {
          includeTitle: s.selectedOptions.includeTitle || opts.includeTitle,
          includeDesc: s.selectedOptions.includeDesc || opts.includeDesc,
          includeH1: s.selectedOptions.includeH1 || opts.includeH1,
          includeH2: s.selectedOptions.includeH2 || opts.includeH2,
          includeH3: s.selectedOptions.includeH3 || opts.includeH3,
          includeImages: s.selectedOptions.includeImages || opts.includeImages,
          includeSchemas: s.selectedOptions.includeSchemas || opts.includeSchemas,
          includeRobots: s.selectedOptions.includeRobots || opts.includeRobots,
          includeCanonical: s.selectedOptions.includeCanonical || opts.includeCanonical,
          includeHreflangs: s.selectedOptions.includeHreflangs || opts.includeHreflangs,
          includeInternalLinks: s.selectedOptions.includeInternalLinks || opts.includeInternalLinks,
          jsRenderedLinks: s.selectedOptions.jsRenderedLinks || opts.jsRenderedLinks,
          includeSocialTags: s.selectedOptions.includeSocialTags || opts.includeSocialTags,
        },
        crawlCompletedAt: completedAt,
        lastCrawledAt: completedAt,
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.results]);

  const pause = useCallback(() => {
    pausedRef.current = true;
  }, []);

  const resume = useCallback(async () => {
    pausedRef.current = false;
    const signal = controllerRef.current?.signal;
    if (!signal || signal.aborted) return;
    setState((s) => ({ ...s, phase: "crawling" }));
    const opts = crawlOptionsRef.current;
    await runBatches(
      pendingUrlsRef.current,
      signal,
      opts,
      pendingIndexRef.current,
      accumulatedResultsRef.current,
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
    pausedRef.current = false;
    pendingUrlsRef.current = [];
    pendingIndexRef.current = 0;
    accumulatedResultsRef.current = [];
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    try {
      localStorage.removeItem("sitemap-scout-ui-results-view");
      localStorage.removeItem("sitemap-scout-ui-table-state");
    } catch {}
    clearPersistedStateFromDb();
    setState(INITIAL_STATE);
  }, []);

  const clearCrawl = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
    pausedRef.current = false;
    pendingUrlsRef.current = [];
    pendingIndexRef.current = 0;
    accumulatedResultsRef.current = [];
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    try {
      localStorage.removeItem("sitemap-scout-ui-results-view");
      localStorage.removeItem("sitemap-scout-ui-table-state");
    } catch {}
    clearPersistedStateFromDb();
    setState(INITIAL_STATE);
  }, []);

  return { ...state, crawl, crawlUrls, spiderSite, extendCrawl, pause, resume, reset, clearCrawl };
}
