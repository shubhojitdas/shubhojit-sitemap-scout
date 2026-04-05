import { useCrawler } from "@/hooks/use-crawler";
import { CrawlForm } from "@/components/CrawlForm";
import { CrawlProgress } from "@/components/CrawlProgress";
import { StatsCards } from "@/components/StatsCards";
import { ResultsTable } from "@/components/ResultsTable";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LinkGraph } from "@/components/LinkGraph";
import { motion } from "framer-motion";
import { ArrowUp, Linkedin, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect, lazy, Suspense } from "react";

const Index = () => {
  const { phase, results, totalUrls, processedUrls, error, crawl, crawlUrls, pause, resume, reset, includeTitle, includeDesc, includeH2, includeH3, parsedUrls } = useCrawler();
  const [showTop, setShowTop] = useState(false);
  const [domain, setDomain] = useState("");
  const [includeH1, setIncludeH1] = useState(false);
  const [includeImages, setIncludeImages] = useState(false);
  const [includeSchemas, setIncludeSchemas] = useState(false);
  const [includeRobots, setIncludeRobots] = useState(false);
  const [localIncludeTitle, setLocalIncludeTitle] = useState(true);
  const [localIncludeDesc, setLocalIncludeDesc] = useState(true);
  const [showLinkGraph, setShowLinkGraph] = useState(false);

  useEffect(() => {
    const handleScroll = () => setShowTop(window.scrollY > 400);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleCrawl = (url: string, withTitle: boolean, withDesc: boolean, withH1: boolean, withH2: boolean, withH3: boolean, withImages: boolean, withSchemas: boolean, withRobots: boolean) => {
    try {
      const parsed = new URL(url.startsWith("http") ? url : "https://" + url);
      setDomain(parsed.hostname);
    } catch {
      setDomain("unknown");
    }
    setIncludeH1(withH1);
    setIncludeImages(withImages);
    setIncludeSchemas(withSchemas);
    setIncludeRobots(withRobots);
    setLocalIncludeTitle(withTitle);
    setLocalIncludeDesc(withDesc);
    crawl(url, withTitle, withDesc, withH1, withH2, withH3, withImages, withSchemas, withRobots);
  };

  const handleCrawlUrls = (urls: string[], withTitle: boolean, withDesc: boolean, withH1: boolean, withH2: boolean, withH3: boolean, withImages: boolean, withSchemas: boolean, withRobots: boolean) => {
    setIncludeH1(withH1);
    setIncludeImages(withImages);
    setIncludeSchemas(withSchemas);
    setIncludeRobots(withRobots);
    setLocalIncludeTitle(withTitle);
    setLocalIncludeDesc(withDesc);
    crawlUrls(urls, withTitle, withDesc, withH1, withH2, withH3, withImages, withSchemas, withRobots);
  };

  const isLoading = phase === "parsing" || phase === "crawling" || phase === "paused";

  return (
    <div className="min-h-screen bg-background">

      {/* ── Header ── */}
      <header className="border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container max-w-5xl mx-auto flex items-center justify-between h-12 px-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm tracking-tight text-foreground">Sitemap Scout</span>
          </div>
          <div className="flex items-center gap-0.5">
            <ThemeToggle />
            <a href="https://www.linkedin.com/in/shubhojitdas/" target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground">
                <Linkedin className="h-3.5 w-3.5" />
              </Button>
            </a>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section
        className="relative flex flex-col justify-center overflow-hidden"
        style={{ minHeight: 'calc(100vh - 48px)' }}
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
              SEO Metadata Extractor
            </h1>
            <p className="text-[11px] text-muted-foreground/50 mt-1 tracking-wide">by Shubhojit Das</p>
            <p className="text-muted-foreground text-sm sm:text-[15px] mt-2.5 max-w-md mx-auto leading-relaxed">
              Crawl any sitemap and extract titles, descriptions, H1 tags &amp; image alt texts.
              Export to CSV in seconds.
            </p>
          </motion.div>

          <motion.div
            className="w-full max-w-xl"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
          >
            <div className="rounded-xl border border-border bg-card p-4 card-elevated">
              <CrawlForm onCrawl={handleCrawl} onCrawlUrls={handleCrawlUrls} isLoading={isLoading} isPaused={phase === "paused"} onReset={reset} onPause={pause} onResume={resume} />
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

      {/* ── Progress ── */}
      <section className="container max-w-5xl mx-auto pb-4 px-4">
        <CrawlProgress phase={phase} processed={processedUrls} total={totalUrls} />
      </section>

      {/* ── Error ── */}
      {error && (
        <section className="container max-w-5xl mx-auto px-4 pb-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-destructive/10 text-destructive border border-destructive/20 rounded-lg p-3 text-sm"
          >
            <strong>Error:</strong> {error}
          </motion.div>
        </section>
      )}

      {/* ── Results ── */}
      {results.length > 0 && (
        <section className="container max-w-6xl mx-auto px-4 pb-16 space-y-6">
          <StatsCards results={results} includeTitle={localIncludeTitle} includeDesc={localIncludeDesc} includeH1={includeH1} includeH2={includeH2} includeH3={includeH3} includeImages={includeImages} includeSchemas={includeSchemas} includeRobots={includeRobots} />

          {/* Link Graph Toggle */}
          <div className="flex items-center gap-2">
            <Button
              variant={showLinkGraph ? "default" : "outline"}
              size="sm"
              onClick={() => setShowLinkGraph(!showLinkGraph)}
              className="gap-1.5"
            >
              <Network className="h-3.5 w-3.5" />
              {showLinkGraph ? "Hide Link Graph" : "Visual Link Graph"}
            </Button>
            {showLinkGraph && (
              <span className="text-[11px] text-muted-foreground">
                Visualising {parsedUrls.length > 0 ? parsedUrls.length : results.length} URLs
              </span>
            )}
          </div>

          {/* Link Graph */}
          {showLinkGraph && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <LinkGraph urls={parsedUrls.length > 0 ? parsedUrls : results.map(r => r.url)} />
            </motion.div>
          )}

          <ResultsTable results={results} domain={domain} includeTitle={localIncludeTitle} includeDesc={localIncludeDesc} includeH1={includeH1} includeH2={includeH2} includeH3={includeH3} includeImages={includeImages} includeSchemas={includeSchemas} includeRobots={includeRobots} />
        </section>
      )}

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
