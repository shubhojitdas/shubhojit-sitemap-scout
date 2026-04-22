import { useCrawler } from "@/hooks/use-crawler";
import { CrawlForm } from "@/components/CrawlForm";
import { CrawlProgress } from "@/components/CrawlProgress";
import { ResultsShell } from "@/components/ResultsShell";
import { CrawlConfigDialog, DEFAULT_CRAWL_CONFIG, type CrawlConfig } from "@/components/CrawlConfigDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

const Index = () => {
  const {
    phase, crawlSource, results, totalUrls, processedUrls, error,
    crawl, crawlUrls, spiderSite, extendCrawl, pause, resume, reset, clearCrawl,
    parsedUrls, lastInput, crawledFlags,
  } = useCrawler();

  const [showTop, setShowTop] = useState(false);
  const [domain, setDomain] = useState("");
  const [config, setConfig] = useState<CrawlConfig>(DEFAULT_CRAWL_CONFIG);
  const [activeConfig, setActiveConfig] = useState<CrawlConfig>(DEFAULT_CRAWL_CONFIG);
  const [configOpen, setConfigOpen] = useState(false);
  const [newCrawlOpen, setNewCrawlOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setShowTop(window.scrollY > 400);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const setDomainFromUrl = (url: string) => {
    try {
      const parsed = new URL(url.startsWith("http") ? url : "https://" + url);
      setDomain(parsed.hostname);
    } catch {
      setDomain("unknown");
    }
  };

  const handleCrawl = (url: string, c: CrawlConfig) => {
    setDomainFromUrl(url);
    setActiveConfig(c);
    setNewCrawlOpen(false);
    crawl(url, c.includeTitle, c.includeDesc, c.includeH1, c.includeH2, c.includeH3, c.includeImages, c.includeSchemas, c.includeRobots, c.includeCanonical, c.includeHreflangs, c.includeInternalLinks, c.jsRenderedLinks, c.includeSocialTags);
  };

  const handleSpiderSite = (url: string, c: CrawlConfig) => {
    setDomainFromUrl(url);
    setActiveConfig(c);
    setNewCrawlOpen(false);
    spiderSite(url, c.includeTitle, c.includeDesc, c.includeH1, c.includeH2, c.includeH3, c.includeImages, c.includeSchemas, c.includeRobots, c.includeCanonical, c.includeHreflangs, c.includeInternalLinks, c.jsRenderedLinks, c.includeSocialTags);
  };

  const handleCrawlUrls = (urls: string[], c: CrawlConfig) => {
    if (urls[0]) setDomainFromUrl(urls[0]);
    setActiveConfig(c);
    setNewCrawlOpen(false);
    crawlUrls(urls, c.includeTitle, c.includeDesc, c.includeH1, c.includeH2, c.includeH3, c.includeImages, c.includeSchemas, c.includeRobots, c.includeCanonical, c.includeHreflangs, c.includeInternalLinks, c.jsRenderedLinks, c.includeSocialTags);
  };

  const handleExtend = (extra: Partial<CrawlConfig>) => {
    setActiveConfig((prev) => ({
      ...prev,
      ...Object.fromEntries(Object.entries(extra).filter(([, v]) => v)) as Partial<CrawlConfig>,
    }));
    extendCrawl(extra);
  };

  const isLoading = phase === "parsing" || phase === "crawling" || phase === "paused";
  const hasResults = results.length > 0;

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background">
      {/* ── Hero (only when no results yet) ── */}
      {!hasResults && (
        <section
          className="relative flex flex-col justify-center overflow-hidden"
          style={{ minHeight: "calc(100vh - 7rem)" }}
        >
          <div className="absolute inset-0 grid-bg fade-mask pointer-events-none" />

          <div className="relative container max-w-2xl mx-auto px-4 flex flex-col items-center">
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="mb-4"
            >
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-card text-[11px] font-medium text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                Free &amp; open — no login required
              </div>
            </motion.div>

            <motion.div
              className="text-center mb-6"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
            >
              <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold tracking-tight leading-[1.1] gradient-text pb-1">
                SEO Sitemap Scout
              </h1>
              <p className="text-[15px] mt-3 tracking-wide font-semibold text-muted-foreground">
                by{"  "}
                <a
                  href="/shubhojit-das"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative inline-block ml-1"
                >
                  <span className="relative z-10 text-foreground underline decoration-foreground/30 underline-offset-2 hover:decoration-foreground transition-colors">Shubhojit Das</span>
                  <svg
                    className="absolute -inset-x-3 -inset-y-2 w-[calc(100%+24px)] h-[calc(100%+16px)] pointer-events-none"
                    viewBox="0 0 200 60"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    preserveAspectRatio="none"
                  >
                    <ellipse
                      cx="100" cy="30" rx="92" ry="24"
                      stroke="hsl(var(--foreground))"
                      strokeWidth="2.5" strokeLinecap="round"
                      strokeDasharray="600" strokeDashoffset="600"
                      transform="rotate(-3 100 30)"
                      className="animate-doodle-circle"
                    />
                  </svg>
                </a>
              </p>
              <p className="text-muted-foreground text-sm sm:text-[15px] mt-2.5 max-w-md mx-auto leading-relaxed">
                Crawl any sitemap and extract Meta Titles, Descriptions, Headings, Image Alt Texts, Schema Markup, and
                Meta Robots. Visualize your site's link structure. Export in seconds.
              </p>
            </motion.div>

            <motion.div
              className="w-full max-w-xl"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.4 }}
            >
              <div className="rounded-xl border border-border bg-card p-3 sm:p-4 card-elevated">
                <CrawlForm
                  config={config}
                  onOpenConfig={() => setConfigOpen(true)}
                  onCrawl={handleCrawl}
                  onCrawlUrls={handleCrawlUrls}
                  onSpiderSite={handleSpiderSite}
                  isLoading={isLoading}
                  isPaused={phase === "paused"}
                  onReset={reset}
                  onPause={pause}
                  onResume={resume}
                />
              </div>
            </motion.div>

            <motion.p
              className="mt-3 text-[11px] text-muted-foreground/60 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
            >
              Supports sitemap index files · Bulk URL paste · CSV &amp; Excel upload
            </motion.p>
          </div>
        </section>
      )}

      {/* ── Progress (only on hero, results page has its own) ── */}
      {!hasResults && (
        <section className="container max-w-7xl mx-auto px-4">
          <CrawlProgress phase={phase} source={crawlSource} processed={processedUrls} total={totalUrls} />
        </section>
      )}

      {/* ── Error ── */}
      {error && (
        <section className="container max-w-7xl mx-auto px-4 pb-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-destructive/10 text-destructive border border-destructive/20 rounded-lg p-3 text-sm"
          >
            <strong>Error:</strong> {error}
          </motion.div>
        </section>
      )}

      {/* ── Results — Screaming Frog-style sidebar layout ── */}
      {hasResults && (
        <>
          <ResultsShell
            results={results}
            domain={domain}
            parsedUrls={parsedUrls}
            crawlSource={crawlSource}
            lastInput={lastInput}
            isLoading={isLoading}
            isPaused={phase === "paused"}
            flags={activeConfig}
            onClearCrawl={clearCrawl}
            onOpenConfig={() => setConfigOpen(true)}
            onOpenNewCrawl={() => setNewCrawlOpen(true)}
            onPause={pause}
            onResume={resume}
          />

          {/* Floating progress overlay during incremental crawls */}
          {isLoading && (
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100vw-2rem)] max-w-md rounded-lg border border-border bg-card shadow-lg p-3">
              <CrawlProgress phase={phase} source={crawlSource} processed={processedUrls} total={totalUrls} />
            </div>
          )}
        </>
      )}

      {/* ── Config dialog (incremental when results exist) ── */}
      <CrawlConfigDialog
        open={configOpen}
        onOpenChange={setConfigOpen}
        config={config}
        onChange={setConfig}
        mode={hasResults ? "incremental" : "initial"}
        crawledFlags={crawledFlags as CrawlConfig}
        onExtend={handleExtend}
      />

      {/* ── New crawl dialog (re-uses CrawlForm) ── */}
      <Dialog open={newCrawlOpen} onOpenChange={setNewCrawlOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:w-full sm:max-w-xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base">Start a new crawl</DialogTitle>
          </DialogHeader>
          <p className="text-[11px] text-muted-foreground -mt-2">
            Starting a new crawl will clear your current results.
          </p>
          <CrawlForm
            config={config}
            onOpenConfig={() => setConfigOpen(true)}
            onCrawl={(url, c) => { clearCrawl(); handleCrawl(url, c); }}
            onCrawlUrls={(urls, c) => { clearCrawl(); handleCrawlUrls(urls, c); }}
            onSpiderSite={(url, c) => { clearCrawl(); handleSpiderSite(url, c); }}
            isLoading={isLoading}
            isPaused={phase === "paused"}
            onReset={reset}
            onPause={pause}
            onResume={resume}
          />
        </DialogContent>
      </Dialog>

      {/* ── Back to top ── */}
      {showTop && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="fixed bottom-6 right-6 z-50"
        >
          <Button
            size="icon"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="h-9 w-9 rounded-full shadow-md"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
        </motion.div>
      )}
    </div>
  );
};

export default Index;
