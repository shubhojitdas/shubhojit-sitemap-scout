import { useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ResultsSidebar, type ResultsView } from "@/components/ResultsSidebar";
import { StatsCards } from "@/components/StatsCards";
import { ResultsTable } from "@/components/ResultsTable";
import { LinkGraph } from "@/components/LinkGraph";
import { SitemapGenerator } from "@/components/SitemapGenerator";
import { RobotsTxtPanel } from "@/components/RobotsTxtPanel";
import { CrawlOverview } from "@/components/CrawlOverview";
import { CrawlBar } from "@/components/CrawlBar";
import type { CrawlResult } from "@/lib/crawl-api";
import type { LastCrawlInput } from "@/hooks/use-crawler";

interface Props {
  results: CrawlResult[];
  domain: string;
  parsedUrls: string[];
  crawlSource: "sitemap" | "site" | "urls" | null;
  lastInput: LastCrawlInput | null;
  isLoading: boolean;
  isPaused: boolean;
  flags: {
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
    includeSocialTags: boolean;
  };
  onClearCrawl: () => void;
  onOpenConfig: () => void;
  onOpenNewCrawl: () => void;
  onPause: () => void;
  onResume: () => void;
}

export function ResultsShell({
  results, domain, parsedUrls, crawlSource, lastInput, flags,
  isLoading, isPaused,
  onClearCrawl, onOpenConfig, onOpenNewCrawl, onPause, onResume,
}: Props) {
  const [view, setView] = useState<ResultsView>("overview");

  const flagsForView = (() => {
    const base = { ...flags, includeTitle: false, includeDesc: false, includeH1: false, includeH2: false, includeH3: false, includeImages: false, includeSchemas: false, includeRobots: false, includeCanonical: false, includeHreflangs: false, includeInternalLinks: false, includeSocialTags: false };
    switch (view) {
      case "page-titles": return { ...base, includeTitle: true };
      case "meta-description": return { ...base, includeDesc: true };
      case "h1": return { ...base, includeH1: true };
      case "h2": return { ...base, includeH2: true };
      case "h3": return { ...base, includeH3: true };
      case "meta-robots": return { ...base, includeRobots: true };
      case "canonicals": return { ...base, includeCanonical: true };
      case "hreflang": return { ...base, includeHreflangs: true };
      case "schema": return { ...base, includeSchemas: true };
      case "images": return { ...base, includeImages: true };
      case "internal-links": return { ...base, includeInternalLinks: true };
      case "social": return { ...base, includeSocialTags: true };
      default: return flags;
    }
  })();

  const viewTitle: Record<ResultsView, string> = {
    overview: "Overview",
    internal: "Internal — All URLs",
    "response-codes": "Response Codes",
    "page-titles": "Page Titles",
    "meta-description": "Meta Descriptions",
    h1: "H1 Tags",
    h2: "H2 Tags",
    h3: "H3 Tags",
    images: "Images",
    canonicals: "Canonicals",
    hreflang: "Hreflang",
    schema: "Schema",
    "meta-robots": "Meta Robots",
    social: "Social Tags",
    "internal-links": "Internal Links",
    "link-graph": "Visual Link Graph",
    sitemap: "Sitemap Generator",
    "robots-txt": "Robots.txt",
  };

  return (
    <SidebarProvider defaultOpen>
      {/* Compact crawl bar (sticky above the shell) */}
      <div className="w-full">
        <div className="sticky top-14 z-40 border-b border-border bg-background/90 backdrop-blur-xl">
          <div className="px-3 sm:px-4 py-2">
            <CrawlBar
              lastInput={lastInput}
              isLoading={isLoading}
              isPaused={isPaused}
              onOpenConfig={onOpenConfig}
              onOpenNewCrawl={onOpenNewCrawl}
              onPause={onPause}
              onResume={onResume}
              onClearCrawl={onClearCrawl}
            />
          </div>
        </div>

        <div className="flex w-full min-h-[calc(100vh-3.5rem)]">
          <ResultsSidebar
            view={view}
            setView={setView}
            results={results}
            flags={flags}
            crawlSource={crawlSource}
          />

          <div className="flex-1 flex flex-col min-w-0">
            {/* Sub-toolbar */}
            <div className="flex items-center gap-2 px-3 sm:px-4 py-2 border-b border-border bg-background/80 backdrop-blur">
              <SidebarTrigger className="h-7 w-7" />
              <h2 className="text-sm font-semibold truncate">{viewTitle[view]}</h2>
              <span className="text-[11px] text-muted-foreground hidden sm:inline">
                · {results.length.toLocaleString()} URL{results.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="flex-1 p-3 sm:p-4 space-y-4 min-w-0 overflow-x-hidden">
              {view === "overview" && (
                <>
                  <StatsCards
                    results={results}
                    includeTitle={flags.includeTitle}
                    includeDesc={flags.includeDesc}
                    includeH1={flags.includeH1}
                    includeH2={flags.includeH2}
                    includeH3={flags.includeH3}
                    includeImages={flags.includeImages}
                    includeSchemas={flags.includeSchemas}
                    includeRobots={flags.includeRobots}
                    includeHreflangs={flags.includeHreflangs}
                  />
                  <CrawlOverview results={results} domain={domain} />
                  {(crawlSource === "site" || crawlSource === "sitemap") && (
                    <SitemapGenerator results={results} domain={domain} />
                  )}
                </>
              )}

              {view === "link-graph" && (
                <LinkGraph urls={parsedUrls.length > 0 ? parsedUrls : results.map((r) => r.url)} />
              )}

              {view === "sitemap" && (
                <div className="rounded-lg border border-border p-4">
                  <SitemapGenerator results={results} domain={domain} />
                </div>
              )}

              {view === "robots-txt" && (
                <RobotsTxtPanel results={results} domain={domain} />
              )}

              {view !== "overview" &&
                view !== "link-graph" &&
                view !== "sitemap" &&
                view !== "robots-txt" && (
                  <ResultsTable
                    results={results}
                    domain={domain}
                    includeTitle={flagsForView.includeTitle}
                    includeDesc={flagsForView.includeDesc}
                    includeH1={flagsForView.includeH1}
                    includeH2={flagsForView.includeH2}
                    includeH3={flagsForView.includeH3}
                    includeImages={flagsForView.includeImages}
                    includeSchemas={flagsForView.includeSchemas}
                    includeRobots={flagsForView.includeRobots}
                    includeCanonical={flagsForView.includeCanonical}
                    includeHreflangs={flagsForView.includeHreflangs}
                    includeInternalLinks={flagsForView.includeInternalLinks}
                    includeSocialTags={flagsForView.includeSocialTags}
                  />
                )}
            </div>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
