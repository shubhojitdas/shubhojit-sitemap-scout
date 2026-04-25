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
import { SectionVisualization, type SectionKey } from "@/components/SectionVisualization";
import { SeoIssuesView } from "@/components/SeoIssuesView";
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
  crawlStartedAt: string | null;
  crawlCompletedAt: string | null;
  lastCrawledAt: string | null;
}

/**
 * Maps each sidebar `view` to:
 *  - `forceTab`: which sub-table the ResultsTable should render exclusively
 *  - flags overrides so MetaTable only shows the columns relevant to that view.
 *
 * Crucial: keeping all `include*` flags `true` for non-meta views ensures the
 * dedicated sub-table (Images/Schemas/Social/etc.) doesn't fall back to MetaTable.
 */
function viewConfig(view: ResultsView, baseFlags: Props["flags"]) {
  // Helper: empty meta flags so MetaTable only shows the requested column.
  const onlyMeta = (over: Partial<Props["flags"]>): Props["flags"] => ({
    ...baseFlags,
    includeTitle: false, includeDesc: false, includeH1: false, includeH2: false, includeH3: false,
    includeImages: false, includeSchemas: false, includeRobots: false, includeCanonical: false,
    includeHreflangs: false, includeInternalLinks: false, includeSocialTags: false,
    ...over,
  });

  switch (view) {
    case "page-titles":     return { forceTab: "meta" as const,         flags: onlyMeta({ includeTitle: true }) };
    case "meta-description":return { forceTab: "meta" as const,         flags: onlyMeta({ includeDesc: true }) };
    case "h1":              return { forceTab: "meta" as const,         flags: onlyMeta({ includeH1: true }) };
    case "h2":              return { forceTab: "meta" as const,         flags: onlyMeta({ includeH2: true }) };
    case "h3":              return { forceTab: "meta" as const,         flags: onlyMeta({ includeH3: true }) };
    case "meta-robots":     return { forceTab: "meta" as const,         flags: onlyMeta({ includeRobots: true }) };
    case "combined":        return { forceTab: "meta" as const,         flags: baseFlags };
    case "canonicals":      return { forceTab: "canonical" as const,    flags: baseFlags };
    case "hreflang":        return { forceTab: "hreflangs" as const,    flags: baseFlags };
    case "schema":          return { forceTab: "schemas" as const,      flags: baseFlags };
    case "images":          return { forceTab: "images" as const,       flags: baseFlags };
    case "internal-links":  return { forceTab: "internalLinks" as const,flags: baseFlags };
    case "social":          return { forceTab: "social" as const,       flags: baseFlags };
    case "internal":
    case "response-codes":
      // Show URL + status code columns only.
      return { forceTab: "meta" as const, flags: onlyMeta({}) };
    default:
      return { forceTab: undefined, flags: baseFlags };
  }
}

const VIEW_TITLES: Record<ResultsView, string> = {
  overview: "Overview",
  internal: "Internal — All URLs",
  "response-codes": "Response Codes",
  "seo-issues": "SEO Issues",
  combined: "Combined Meta Data",
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
  social: "Social Tags (OG &amp; Twitter)",
  "internal-links": "Internal Links",
  "link-graph": "Visual Link Graph",
  sitemap: "Sitemap Generator",
  "robots-txt": "Robots.txt",
};

const SECTION_VIS_VIEWS = new Set<ResultsView>([
  "page-titles", "meta-description", "h1", "h2", "h3", "meta-robots",
  "canonicals", "hreflang", "schema", "images", "internal-links", "social",
  "internal", "response-codes",
]);

export function ResultsShell({
  results, domain, parsedUrls, crawlSource, lastInput, flags,
  isLoading, isPaused,
  onClearCrawl, onOpenConfig, onOpenNewCrawl, onPause, onResume,
  crawlStartedAt, crawlCompletedAt, lastCrawledAt,
}: Props) {
  const [view, setView] = useState<ResultsView>("overview");
  const cfg = viewConfig(view, flags);

  return (
    <SidebarProvider defaultOpen>
      <div className="w-full">
        {/* ── Crawl bar: sticks directly under fixed AppHeader (h-14) ───── */}
        <div className="sticky top-14 z-40 border-b border-border bg-background/95 backdrop-blur-xl">
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
              crawlStartedAt={crawlStartedAt}
              crawlCompletedAt={crawlCompletedAt}
              lastCrawledAt={lastCrawledAt}
            />
          </div>
        </div>

        <div className="flex w-full min-h-[calc(100vh-3.5rem)]">
          {/* Sidebar on the LEFT */}
          <ResultsSidebar
            view={view}
            setView={setView}
            results={results}
            flags={flags}
            crawlSource={crawlSource}
          />

          <div className="flex-1 flex flex-col min-w-0">
            {/* Sub-toolbar: scrolls with content (NOT sticky) so it never hides section content */}
            <div className="flex items-center gap-2 px-3 sm:px-4 py-2 border-b border-border bg-background">
              <SidebarTrigger className="h-7 w-7" />
              <h2 className="text-sm font-semibold truncate">{VIEW_TITLES[view]}</h2>
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
                  <CrawlOverview results={results} domain={domain} flags={flags} />
                  {(crawlSource === "site" || crawlSource === "sitemap") && (
                    <SitemapGenerator results={results} domain={domain} />
                  )}
                </>
              )}

              {view === "link-graph" && (
                <LinkGraph urls={parsedUrls.length > 0 ? parsedUrls : results.map((r) => r.url)} />
              )}

              {view === "sitemap" && (
                <div className="rounded-lg border border-border p-4 flex flex-col items-start gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">Sitemap Generator</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Build a clean, Google-ready <code className="font-mono">sitemap.xml</code> from this crawl —
                      only valid 2xx URLs, redirects resolved, duplicates removed.
                    </p>
                  </div>
                  <SitemapGenerator results={results} domain={domain} />
                </div>
              )}


              {view === "robots-txt" && (
                <RobotsTxtPanel results={results} domain={domain} />
              )}

              {view === "seo-issues" && (
                <SeoIssuesView results={results} flags={flags} />
              )}

              {/* All data views: mini visualization + filtered table */}
              {view !== "overview" && view !== "link-graph" && view !== "sitemap" && view !== "robots-txt" && view !== "seo-issues" && (
                <>
                  {SECTION_VIS_VIEWS.has(view) && (
                    <SectionVisualization
                      view={view as SectionKey}
                      results={results}
                    />
                  )}
                  <ResultsTable
                    results={results}
                    domain={domain}
                    forceTab={cfg.forceTab}
                    includeTitle={cfg.flags.includeTitle}
                    includeDesc={cfg.flags.includeDesc}
                    includeH1={cfg.flags.includeH1}
                    includeH2={cfg.flags.includeH2}
                    includeH3={cfg.flags.includeH3}
                    includeImages={cfg.flags.includeImages}
                    includeSchemas={cfg.flags.includeSchemas}
                    includeRobots={cfg.flags.includeRobots}
                    includeCanonical={cfg.flags.includeCanonical}
                    includeHreflangs={cfg.flags.includeHreflangs}
                    includeInternalLinks={cfg.flags.includeInternalLinks}
                    includeSocialTags={cfg.flags.includeSocialTags}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
