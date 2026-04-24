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
  /** True when running an incremental extract (extendCrawl), so progress UI can label it. */
  incremental: boolean;
  /** Wall-clock ISO of when the current crawl was started. */
  crawlStartedAt: string | null;
  /** Wall-clock ISO of when the most recent crawl batch finished. */
  crawlCompletedAt: string | null;
  /** ISO of the most recent crawl activity (start, completion, or extension) in this dataset. */
  lastCrawledAt: string | null;
}

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
  crawledFlags: {
    includeTitle: false, includeDesc: false, includeH1: false, includeH2: false, includeH3: false,
    includeImages: false, includeSchemas: false, includeRobots: false, includeCanonical: false,
    includeHreflangs: false, includeInternalLinks: false, jsRenderedLinks: false, includeSocialTags: false,
  },
  incremental: false,
  crawlStartedAt: null,
  crawlCompletedAt: null,
  lastCrawledAt: null,
};

const STORAGE_KEY = "sitemap-scout-crawl-data";

const EMPTY_RESULT_FIELDS = { h2s: [] as string[], h3s: [] as string[], images: [], schemas: [] as string[], robots: '', canonical: '', canonicalStatus: 'Missing' as const, hreflangs: [], internalLinks: [] };

function loadPersistedState(): CrawlState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as CrawlState;
    if (data.results && data.results.length > 0) {
      data.crawlSource = data.crawlSource ?? null;
      data.lastInput = data.lastInput ?? null;
      data.crawledFlags = data.crawledFlags ?? INITIAL_STATE.crawledFlags;
      data.incremental = false;
      if (data.phase === "crawling" || data.phase === "parsing") {
        data.phase = "done";
      }
      return data;
    }
  } catch { /* ignore corrupt data */ }
  return null;
}

function persistState(state: CrawlState) {
  try {
    if (state.results.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  } catch { /* storage full or unavailable */ }
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

const DEFAULT_OPTS: CrawlOptions = { includeTitle: true, includeDesc: true, includeH1: false, includeH2: false, includeH3: false, includeImages: false, includeSchemas: false, includeRobots: false, includeCanonical: false, includeHreflangs: false, includeInternalLinks: false, jsRenderedLinks: false, includeSocialTags: false };

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

  useEffect(() => { persistState(state); }, [state]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (state.results.length > 0) { e.preventDefault(); }
    };
    const handleUnload = () => {
      if (state.results.length > 0) {
        try { localStorage.removeItem(STORAGE_KEY); } catch {}
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("unload", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("unload", handleUnload);
    };
  }, [state.results.length]);

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
    const BATCH_SIZE = 10;

    for (let i = startIndex; i < urls.length; i += BATCH_SIZE) {
      if (signal.aborted) return;
      if (pausedRef.current) {
        pendingIndexRef.current = i;
        accumulatedResultsRef.current = [...allResults];
        setState((s) => ({ ...s, phase: "paused" }));
        return;
      }
      const batch = urls.slice(i, i + BATCH_SIZE);
      try {
        const batchResults = await fetchMetaBatch(batch, opts.includeTitle, opts.includeDesc, opts.includeH1, opts.includeH2, opts.includeH3, opts.includeImages, opts.includeSchemas, opts.includeRobots, opts.includeCanonical, opts.includeHreflangs, opts.includeInternalLinks, opts.jsRenderedLinks, opts.includeSocialTags);
        if (signal.aborted) return;
        if (pausedRef.current) {
          allResults.push(...batchResults);
          pendingIndexRef.current = i + BATCH_SIZE;
          accumulatedResultsRef.current = [...allResults];
          setState((s) => ({ ...s, results: [...allResults], processedUrls: Math.min(i + BATCH_SIZE, urls.length), phase: "paused" }));
          return;
        }
        allResults.push(...batchResults);
      } catch {
        if (signal.aborted) return;
        batch.forEach((url) => {
          allResults.push({ url, title: "", description: "", h1s: [], ...EMPTY_RESULT_FIELDS, status: "Error", statusCode: 0, redirectType: 'none', redirectChain: [], hopCount: 0, initialUrl: url, finalUrl: url, fetchTime: "0s" });
        });
      }
      if (signal.aborted) return;
      setState((s) => ({ ...s, results: [...allResults], processedUrls: Math.min(i + BATCH_SIZE, urls.length) }));
    }

    if (!signal.aborted && !pausedRef.current) {
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
        incremental: false,
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
    setState({ ...INITIAL_STATE, phase: "parsing", crawlSource: "sitemap", lastInput: { source: "sitemap", display: sitemapUrl }, includeTitle, includeDesc, includeH2, includeH3 });

    try {
      const urls = await parseSitemapUrls(sitemapUrl);
      if (signal.aborted) return;

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
    crawlOptionsRef.current = opts;
    pendingUrlsRef.current = urls;
    pendingIndexRef.current = 0;
    accumulatedResultsRef.current = [];
    const display = urls.length === 1 ? urls[0] : `${urls.length} URLs`;
    setState({ ...INITIAL_STATE, phase: "crawling", crawlSource: "urls", totalUrls: urls.length, parsedUrls: urls, lastInput: { source: "urls", display, urls }, includeTitle, includeDesc, includeH2, includeH3 });

    try {
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
    setState({ ...INITIAL_STATE, phase: "parsing", crawlSource: "site", lastInput: { source: "site", display: siteUrl }, includeTitle, includeDesc, includeH2, includeH3 });

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

    setState((s) => ({
      ...s,
      phase: "crawling",
      totalUrls: targetUrls.length,
      processedUrls: 0,
      error: null,
      incremental: true,
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
    setState(INITIAL_STATE);
  }, []);

  return { ...state, crawl, crawlUrls, spiderSite, extendCrawl, pause, resume, reset, clearCrawl };
}
