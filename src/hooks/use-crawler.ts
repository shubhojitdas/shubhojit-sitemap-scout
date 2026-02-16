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

  const crawl = useCallback(async (sitemapUrl: string) => {
    abortRef.current = false;
    setState({ phase: "parsing", results: [], totalUrls: 0, processedUrls: 0, error: null });

    try {
      const urls = await parseSitemapUrls(sitemapUrl);
      if (urls.length === 0) {
        setState((s) => ({ ...s, phase: "error", error: "No URLs found in sitemap" }));
        return;
      }

      setState((s) => ({ ...s, phase: "crawling", totalUrls: urls.length }));

      const allResults: CrawlResult[] = [];
      const BATCH_SIZE = 10;

      for (let i = 0; i < urls.length; i += BATCH_SIZE) {
        if (abortRef.current) break;
        const batch = urls.slice(i, i + BATCH_SIZE);
        try {
          const batchResults = await fetchMetaBatch(batch);
          allResults.push(...batchResults);
        } catch {
          // If batch fails, mark all as error
          batch.forEach((url) => {
            allResults.push({ url, title: "", description: "", status: "Error", statusCode: 0, fetchTime: "0s" });
          });
        }
        setState((s) => ({ ...s, results: [...allResults], processedUrls: Math.min(i + BATCH_SIZE, urls.length) }));
      }

      setState((s) => ({ ...s, phase: "done" }));
    } catch (err) {
      setState((s) => ({
        ...s,
        phase: "error",
        error: err instanceof Error ? err.message : "An error occurred",
      }));
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current = true;
    setState({ phase: "idle", results: [], totalUrls: 0, processedUrls: 0, error: null });
  }, []);

  return { ...state, crawl, reset };
}
