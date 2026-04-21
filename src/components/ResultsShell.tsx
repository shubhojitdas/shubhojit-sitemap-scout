import { useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ResultsSidebar, type ResultsView } from "@/components/ResultsSidebar";
import { StatsCards } from "@/components/StatsCards";
import { ResultsTable } from "@/components/ResultsTable";
import { LinkGraph } from "@/components/LinkGraph";
import { SitemapGenerator } from "@/components/SitemapGenerator";
import { RobotsTxtPanel } from "@/components/RobotsTxtPanel";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { CrawlResult } from "@/lib/crawl-api";

interface Props {
  results: CrawlResult[];
  domain: string;
  parsedUrls: string[];
  crawlSource: "sitemap" | "site" | "urls" | null;
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
}

/**
 * Screaming Frog-inspired results layout.
 * Left sidebar selects a view; right panel renders the existing components
 * (ResultsTable, StatsCards, LinkGraph, SitemapGenerator, RobotsTxtPanel)
 * with view-specific column flags. The crawl pipeline is untouched.
 */
export function ResultsShell({
  results, domain, parsedUrls, crawlSource, flags, onClearCrawl,
}: Props) {
  const [view, setView] = useState<ResultsView>("overview");

  // For each sidebar view, force the right column flags so the existing
  // ResultsTable shows just that data — no logic changes required there.
  const flagsForView = (() => {
    switch (view) {
      case "page-titles":
        return { ...flags, includeTitle: true, includeDesc: false, includeH1: false, includeH2: false, includeH3: false, includeImages: false, includeSchemas: false, includeRobots: false, includeCanonical: false, includeHreflangs: false, includeInternalLinks: false, includeSocialTags: false };
      case "meta-description":
        return { ...flags, includeTitle: false, includeDesc: true, includeH1: false, includeH2: false, includeH3: false, includeImages: false, includeSchemas: false, includeRobots: false, includeCanonical: false, includeHreflangs: false, includeInternalLinks: false, includeSocialTags: false };
      case "h1":
        return { ...flags, includeTitle: false, includeDesc: false, includeH1: true, includeH2: false, includeH3: false, includeImages: false, includeSchemas: false, includeRobots: false, includeCanonical: false, includeHreflangs: false, includeInternalLinks: false, includeSocialTags: false };
      case "h2":
        return { ...flags, includeTitle: false, includeDesc: false, includeH1: false, includeH2: true, includeH3: false, includeImages: false, includeSchemas: false, includeRobots: false, includeCanonical: false, includeHreflangs: false, includeInternalLinks: false, includeSocialTags: false };
      case "h3":
        return { ...flags, includeTitle: false, includeDesc: false, includeH1: false, includeH2: false, includeH3: true, includeImages: false, includeSchemas: false, includeRobots: false, includeCanonical: false, includeHreflangs: false, includeInternalLinks: false, includeSocialTags: false };
      case "meta-robots":
        return { ...flags, includeTitle: false, includeDesc: false, includeH1: false, includeH2: false, includeH3: false, includeImages: false, includeSchemas: false, includeRobots: true, includeCanonical: false, includeHreflangs: false, includeInternalLinks: false, includeSocialTags: false };
      case "canonicals":
        return { ...flags, includeTitle: false, includeDesc: false, includeH1: false, includeH2: false, includeH3: false, includeImages: false, includeSchemas: false, includeRobots: false, includeCanonical: true, includeHreflangs: false, includeInternalLinks: false, includeSocialTags: false };
      case "hreflang":
        return { ...flags, includeTitle: false, includeDesc: false, includeH1: false, includeH2: false, includeH3: false, includeImages: false, includeSchemas: false, includeRobots: false, includeCanonical: false, includeHreflangs: true, includeInternalLinks: false, includeSocialTags: false };
      case "schema":
        return { ...flags, includeTitle: false, includeDesc: false, includeH1: false, includeH2: false, includeH3: false, includeImages: false, includeSchemas: true, includeRobots: false, includeCanonical: false, includeHreflangs: false, includeInternalLinks: false, includeSocialTags: false };
      case "images":
        return { ...flags, includeTitle: false, includeDesc: false, includeH1: false, includeH2: false, includeH3: false, includeImages: true, includeSchemas: false, includeRobots: false, includeCanonical: false, includeHreflangs: false, includeInternalLinks: false, includeSocialTags: false };
      case "internal-links":
        return { ...flags, includeTitle: false, includeDesc: false, includeH1: false, includeH2: false, includeH3: false, includeImages: false, includeSchemas: false, includeRobots: false, includeCanonical: false, includeHreflangs: false, includeInternalLinks: true, includeSocialTags: false };
      case "social":
        return { ...flags, includeTitle: false, includeDesc: false, includeH1: false, includeH2: false, includeH3: false, includeImages: false, includeSchemas: false, includeRobots: false, includeCanonical: false, includeHreflangs: false, includeInternalLinks: false, includeSocialTags: true };
      case "internal":
      case "response-codes":
      default:
        // Show user's selected columns
        return flags;
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
          <div className="sticky top-14 z-30 flex items-center gap-2 px-4 py-2 border-b border-border bg-background/80 backdrop-blur">
            <SidebarTrigger className="h-7 w-7" />
            <h2 className="text-sm font-semibold">{viewTitle[view]}</h2>
            <span className="text-[11px] text-muted-foreground">
              · {results.length.toLocaleString()} URL{results.length === 1 ? "" : "s"}
            </span>
            <div className="ml-auto flex items-center gap-1.5">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px] text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3 w-3 mr-1" />
                    Clear
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear all crawl data?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently deletes all crawled results. You'll need to re-crawl to get the data back.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={onClearCrawl} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Delete all data
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          <div className="flex-1 p-4 space-y-4 min-w-0">
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

            {/* All other views render the existing ResultsTable with view-specific flags */}
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
    </SidebarProvider>
  );
}
