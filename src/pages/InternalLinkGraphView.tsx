import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { InternalLinkGraph } from "@/components/InternalLinkGraph";
import type { CrawlResult } from "@/lib/crawl-api";

/**
 * Full-screen view of the Internal Link Graph, opened in a new tab.
 * Reads slimmed-down results (url + internalLinks) from sessionStorage so we
 * can reuse the same `InternalLinkGraph` component (incl. all controls, hover,
 * orphan detection, exports, and "Open in new tab" itself).
 */
export default function InternalLinkGraphView() {
  const results = useMemo<CrawlResult[]>(() => {
    try {
      const stored = sessionStorage.getItem("internalLinkGraphResults");
      if (!stored) return [];
      const slim = JSON.parse(stored) as Array<{ url: string; internalLinks: any[] }>;
      // Cast to CrawlResult — only `url` + `internalLinks` are read by the graph.
      return slim as unknown as CrawlResult[];
    } catch {
      return [];
    }
  }, []);

  if (results.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height: "calc(100vh - 3.5rem)" }}>
        <div className="text-center space-y-3">
          <p className="text-muted-foreground text-sm">No internal link data found. Crawl a site first with internal links enabled.</p>
          <Button variant="outline" size="sm" onClick={() => window.close()}>Close tab</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background" style={{ height: "calc(100vh - 3.5rem)" }}>
      <div className="h-full p-2">
        <div className="h-full">
          <InternalLinkGraph results={results} />
        </div>
      </div>
    </div>
  );
}
