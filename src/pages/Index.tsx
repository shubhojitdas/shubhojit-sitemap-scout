import { useCrawler } from "@/hooks/use-crawler";
import { CrawlForm } from "@/components/CrawlForm";
import { CrawlProgress } from "@/components/CrawlProgress";
import { ResultsShell } from "@/components/ResultsShell";
import { CrawlConfigDialog, DEFAULT_CRAWL_CONFIG, type CrawlConfig } from "@/components/CrawlConfigDialog";
import { motion } from "framer-motion";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

const Index = () => {
  const {
    phase, crawlSource, results, totalUrls, processedUrls, error,
    crawl, crawlUrls, spiderSite, pause, resume, reset, clearCrawl,
    parsedUrls,
  } = useCrawler();

  const [showTop, setShowTop] = useState(false);
  const [domain, setDomain] = useState("");
  const [config, setConfig] = useState<CrawlConfig>(DEFAULT_CRAWL_CONFIG);
  const [activeConfig, setActiveConfig] = useState<CrawlConfig>(DEFAULT_CRAWL_CONFIG);
  const [configOpen, setConfigOpen] = useState(false);

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
    crawl(url, c.includeTitle, c.includeDesc, c.includeH1, c.includeH2, c.includeH3, c.includeImages, c.includeSchemas, c.includeRobots, c.includeCanonical, c.includeHreflangs, c.includeInternalLinks, c.jsRenderedLinks, c.includeSocialTags);
  };

  const handleSpiderSite = (url: string, c: CrawlConfig) => {
    setDomainFromUrl(url);
    setActiveConfig(c);
    spiderSite(url, c.includeTitle, c.includeDesc, c.includeH1, c.includeH2, c.includeH3, c.includeImages, c.includeSchemas, c.includeRobots, c.includeCanonical, c.includeHreflangs, c.includeInternalLinks, c.jsRenderedLinks, c.includeSocialTags);
  };

  const handleCrawlUrls = (urls: string[], c: CrawlConfig) => {
    if (urls[0]) setDomainFromUrl(urls[0]);
    setActiveConfig(c);
    crawlUrls(urls, c.includeTitle, c.includeDesc, c.includeH1, c.includeH2, c.includeH3, c.includeImages, c.includeSchemas, c.includeRobots, c.includeCanonical, c.includeHreflangs, c.includeInternalLinks, c.jsRenderedLinks, c.includeSocialTags);
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
              <div className="rounded-xl border border-border bg-card p-4 card-elevated">
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

      {/* ── Compact crawl bar (when results exist) ── */}
      {hasResults && (
        <section className="border-b border-border bg-card/40">
          <div className="container max-w-7xl mx-auto px-4 py-3">
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
        </section>
      )}

      {/* ── Progress ── */}
      <section className="container max-w-7xl mx-auto px-4">
        <CrawlProgress phase={phase} source={crawlSource} processed={processedUrls} total={totalUrls} />
      </section>

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

      {/* ── Results ── Screaming Frog-style sidebar layout */}
      {hasResults && (
        <ResultsShell
          results={results}
          domain={domain}
          parsedUrls={parsedUrls}
          crawlSource={crawlSource}
          flags={activeConfig}
          onClearCrawl={clearCrawl}
        />
      )}

      {/* ── Config dialog ── */}
      <CrawlConfigDialog
        open={configOpen}
        onOpenChange={setConfigOpen}
        config={config}
        onChange={setConfig}
      />

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
