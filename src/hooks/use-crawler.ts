import { useState, useCallback, useRef } from "react";
import { CrawlResult, parseSitemapUrls, fetchMetaBatch } from "@/lib/crawl-api";

interface CrawlState {
  phase: "idle" | "parsing" | "crawling" | "done" | "error";
  results: CrawlResult[];
  totalUrls: number;
  processedUrls: number;
  error: string | null;
  includeH2: boolean;
  includeH3: boolean;
}

const INITIAL_STATE: CrawlState = {
  phase: "idle",
  results: [],
  totalUrls: 0,
  processedUrls: 0,
  error: null,
  includeH2: false,
  includeH3: false,
};

const EMPTY_RESULT_FIELDS = { h2s: [] as string[], h3s: [] as string[], images: [], schemas: [] as string[] };

export function useCrawler() {
  const [state, setState] = useState<CrawlState>(INITIAL_STATE);
  const controllerRef = useRef<AbortController | null>(null);

  const startController = () => {
    if (controllerRef.current) controllerRef.current.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    return controller.signal;
  };

  const runBatches = async (
    urls: string[],
    signal: AbortSignal,
    includeH1: boolean,
    includeH2: boolean,
    includeH3: boolean,
    includeImages: boolean,
    includeSchemas: boolean
  ) => {
    const allResults: CrawlResult[] = [];
    const BATCH_SIZE = 10;

    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
      if (signal.aborted) return;
      const batch = urls.slice(i, i + BATCH_SIZE);
      try {
        const batchResults = await fetchMetaBatch(batch, includeH1, includeH2, includeH3, includeImages, includeSchemas);
        if (signal.aborted) return;
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

    if (!signal.aborted) {
      setState((s) => ({ ...s, phase: "done" }));
    }
  };

  // Crawl from a sitemap URL (parses sitemap first)
  const crawl = useCallback(async (sitemapUrl: string, includeH1 = false, includeH2 = false, includeH3 = false, includeImages = false, includeSchemas = false) => {
    const signal = startController();
    setState({ phase: "parsing", results: [], totalUrls: 0, processedUrls: 0, error: null, includeH2, includeH3 });

    try {
      const urls = await parseSitemapUrls(sitemapUrl);
      if (signal.aborted) return;

      if (urls.length === 0) {
        if (!signal.aborted) setState((s) => ({ ...s, phase: "error", error: "No URLs found in sitemap" }));
        return;
      }

      setState((s) => ({ ...s, phase: "crawling", totalUrls: urls.length }));
      await runBatches(urls, signal, includeH1, includeH2, includeH3, includeImages, includeSchemas);
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

  // Crawl a pre-supplied list of URLs (skips sitemap parsing)
  const crawlUrls = useCallback(async (urls: string[], includeH1 = false, includeH2 = false, includeH3 = false, includeImages = false, includeSchemas = false) => {
    const signal = startController();
    setState({ phase: "crawling", results: [], totalUrls: urls.length, processedUrls: 0, error: null, includeH2, includeH3 });

    try {
      await runBatches(urls, signal, includeH1, includeH2, includeH3, includeImages);
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

  const reset = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
    setState(INITIAL_STATE);
  }, []);

  return { ...state, crawl, crawlUrls, reset };
}
