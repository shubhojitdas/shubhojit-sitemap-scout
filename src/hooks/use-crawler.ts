import { useState, useCallback, useRef } from "react";
import { CrawlResult, parseSitemapUrls, fetchMetaBatch } from "@/lib/crawl-api";

interface CrawlState {
  phase: "idle" | "parsing" | "crawling" | "done" | "error";
  results: CrawlResult[];
  totalUrls: number;
  processedUrls: number;
  error: string | null;
}

export function useCrawler() {
  const [state, setState] = useState<CrawlState>({
    phase: "idle",
    results: [],
    totalUrls: 0,
    processedUrls: 0,
    error: null,
  });
  const abortRef = useRef(false);
  const crawlIdRef = useRef(0);

  const crawl = useCallback(async (sitemapUrl: string) => {
    abortRef.current = false;
    const currentCrawlId = ++crawlIdRef.current;
    setState({ phase: "parsing", results: [], totalUrls: 0, processedUrls: 0, error: null });

    const isStale = () => abortRef.current || crawlIdRef.current !== currentCrawlId;

    try {
      const urls = await parseSitemapUrls(sitemapUrl);
      if (isStale()) return;

      if (urls.length === 0) {
        setState((s) => ({ ...s, phase: "error", error: "No URLs found in sitemap" }));
        return;
      }

      setState((s) => ({ ...s, phase: "crawling", totalUrls: urls.length }));

      const allResults: CrawlResult[] = [];
      const BATCH_SIZE = 10;

      for (let i = 0; i < urls.length; i += BATCH_SIZE) {
        if (isStale()) return;
        const batch = urls.slice(i, i + BATCH_SIZE);
        try {
          const batchResults = await fetchMetaBatch(batch);
          if (isStale()) return;
          allResults.push(...batchResults);
        } catch {
          if (isStale()) return;
          batch.forEach((url) => {
            allResults.push({ url, title: "", description: "", status: "Error", statusCode: 0, fetchTime: "0s" });
          });
        }
        if (isStale()) return;
        setState((s) => ({ ...s, results: [...allResults], processedUrls: Math.min(i + BATCH_SIZE, urls.length) }));
      }

      if (!isStale()) {
        setState((s) => ({ ...s, phase: "done" }));
      }
    } catch (err) {
      if (!isStale()) {
        setState((s) => ({
          ...s,
          phase: "error",
          error: err instanceof Error ? err.message : "An error occurred",
        }));
      }
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current = true;
    crawlIdRef.current++;
    setState({ phase: "idle", results: [], totalUrls: 0, processedUrls: 0, error: null });
  }, []);

  return { ...state, crawl, reset };
}
