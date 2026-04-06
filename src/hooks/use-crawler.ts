import { useState, useCallback, useRef } from "react";
import { CrawlResult, parseSitemapUrls, fetchMetaBatch } from "@/lib/crawl-api";

interface CrawlState {
  phase: "idle" | "parsing" | "crawling" | "paused" | "done" | "error";
  results: CrawlResult[];
  totalUrls: number;
  processedUrls: number;
  error: string | null;
  includeTitle: boolean;
  includeDesc: boolean;
  includeH2: boolean;
  includeH3: boolean;
  parsedUrls: string[];
}

const INITIAL_STATE: CrawlState = {
  phase: "idle",
  results: [],
  totalUrls: 0,
  processedUrls: 0,
  error: null,
  includeTitle: true,
  includeDesc: true,
  includeH2: false,
  includeH3: false,
  parsedUrls: [],
};

const EMPTY_RESULT_FIELDS = { h2s: [] as string[], h3s: [] as string[], images: [], schemas: [] as string[], robots: '', canonical: '', canonicalStatus: 'Missing' as const };

export function useCrawler() {
  const [state, setState] = useState<CrawlState>(INITIAL_STATE);
  const controllerRef = useRef<AbortController | null>(null);
  const pausedRef = useRef(false);
  const pendingUrlsRef = useRef<string[]>([]);
  const pendingIndexRef = useRef(0);
  const crawlOptionsRef = useRef<{ includeTitle: boolean; includeDesc: boolean; includeH1: boolean; includeH2: boolean; includeH3: boolean; includeImages: boolean; includeSchemas: boolean; includeRobots: boolean; includeCanonical: boolean }>({ includeTitle: true, includeDesc: true, includeH1: false, includeH2: false, includeH3: false, includeImages: false, includeSchemas: false, includeRobots: false, includeCanonical: false });
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
    includeTitle: boolean,
    includeDesc: boolean,
    includeH1: boolean,
    includeH2: boolean,
    includeH3: boolean,
    includeImages: boolean,
    includeSchemas: boolean,
    includeRobots: boolean,
    includeCanonical: boolean,
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
        const batchResults = await fetchMetaBatch(batch, includeTitle, includeDesc, includeH1, includeH2, includeH3, includeImages, includeSchemas, includeRobots, includeCanonical);
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
          allResults.push({ url, title: "", description: "", h1s: [], ...EMPTY_RESULT_FIELDS, status: "Error", statusCode: 0, fetchTime: "0s" });
        });
      }
      if (signal.aborted) return;
      setState((s) => ({ ...s, results: [...allResults], processedUrls: Math.min(i + BATCH_SIZE, urls.length) }));
    }

    if (!signal.aborted && !pausedRef.current) {
      setState((s) => ({ ...s, phase: "done" }));
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
  ) => {
    const signal = startController();
    crawlOptionsRef.current = { includeTitle, includeDesc, includeH1, includeH2, includeH3, includeImages, includeSchemas, includeRobots, includeCanonical };
    pendingUrlsRef.current = [];
    pendingIndexRef.current = 0;
    accumulatedResultsRef.current = [];
    setState({ phase: "parsing", results: [], totalUrls: 0, processedUrls: 0, error: null, includeTitle, includeDesc, includeH2, includeH3, parsedUrls: [] });

    try {
      const urls = await parseSitemapUrls(sitemapUrl);
      if (signal.aborted) return;

      if (urls.length === 0) {
        if (!signal.aborted) setState((s) => ({ ...s, phase: "error", error: "No URLs found in sitemap" }));
        return;
      }

      pendingUrlsRef.current = urls;
      setState((s) => ({ ...s, phase: "crawling", totalUrls: urls.length, parsedUrls: urls }));
      await runBatches(urls, signal, includeTitle, includeDesc, includeH1, includeH2, includeH3, includeImages, includeSchemas, includeRobots, includeCanonical);
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
  ) => {
    const signal = startController();
    crawlOptionsRef.current = { includeTitle, includeDesc, includeH1, includeH2, includeH3, includeImages, includeSchemas, includeRobots, includeCanonical };
    pendingUrlsRef.current = urls;
    pendingIndexRef.current = 0;
    accumulatedResultsRef.current = [];
    setState({ phase: "crawling", results: [], totalUrls: urls.length, processedUrls: 0, error: null, includeTitle, includeDesc, includeH2, includeH3, parsedUrls: urls });

    try {
      await runBatches(urls, signal, includeTitle, includeDesc, includeH1, includeH2, includeH3, includeImages, includeSchemas, includeRobots, includeCanonical);
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
      opts.includeTitle, opts.includeDesc, opts.includeH1, opts.includeH2, opts.includeH3,
      opts.includeImages, opts.includeSchemas, opts.includeRobots,
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

  return { ...state, crawl, crawlUrls, pause, resume, reset };
}
