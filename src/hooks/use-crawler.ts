import { useState, useCallback, useRef } from "react";
import { CrawlResult, parseSitemapUrls, fetchMetaBatch } from "@/lib/crawl-api";

interface CrawlState {
  phase: "idle" | "parsing" | "crawling" | "done" | "error";
  results: CrawlResult[];
  totalUrls: number;
  processedUrls: number;
  error: string | null;
}

const INITIAL_STATE: CrawlState = {
  phase: "idle",
  results: [],
  totalUrls: 0,
  processedUrls: 0,
  error: null,
};

export function useCrawler() {
  const [state, setState] = useState<CrawlState>(INITIAL_STATE);
  const controllerRef = useRef<AbortController | null>(null);

  const crawl = useCallback(async (sitemapUrl: string) => {
    // Abort any previous crawl
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    const signal = controller.signal;

    setState({ phase: "parsing", results: [], totalUrls: 0, processedUrls: 0, error: null });

    try {
      const urls = await parseSitemapUrls(sitemapUrl);
      if (signal.aborted) return;

      if (urls.length === 0) {
        if (!signal.aborted) {
          setState((s) => ({ ...s, phase: "error", error: "No URLs found in sitemap" }));
        }
        return;
      }

      setState((s) => ({ ...s, phase: "crawling", totalUrls: urls.length }));

      const allResults: CrawlResult[] = [];
      const BATCH_SIZE = 10;

      for (let i = 0; i < urls.length; i += BATCH_SIZE) {
        if (signal.aborted) return;
        const batch = urls.slice(i, i + BATCH_SIZE);
        try {
          const batchResults = await fetchMetaBatch(batch);
          if (signal.aborted) return;
          allResults.push(...batchResults);
        } catch {
          if (signal.aborted) return;
          batch.forEach((url) => {
            allResults.push({ url, title: "", description: "", status: "Error", statusCode: 0, fetchTime: "0s" });
          });
        }
        if (signal.aborted) return;
        setState((s) => ({ ...s, results: [...allResults], processedUrls: Math.min(i + BATCH_SIZE, urls.length) }));
      }

      if (!signal.aborted) {
        setState((s) => ({ ...s, phase: "done" }));
      }
    } catch (err) {
      if (!signal.aborted) {
        setState((s) => ({
          ...s,
          phase: "error",
          error: err instanceof Error ? err.message : "An error occurred",
        }));
      }
    }
  }, []);

  const reset = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
    setState(INITIAL_STATE);
  }, []);

  return { ...state, crawl, reset };
}
