import { useCrawler } from "@/hooks/use-crawler";
import { CrawlForm } from "@/components/CrawlForm";
import { CrawlProgress } from "@/components/CrawlProgress";
import { StatsCards } from "@/components/StatsCards";
import { ResultsTable } from "@/components/ResultsTable";
import { ThemeToggle } from "@/components/ThemeToggle";
import { motion } from "framer-motion";
import { Globe, ArrowUp, Linkedin, Zap, Shield, BarChart3, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

const BADGES = [
  { icon: Zap, label: "Lightning fast" },
  { icon: Shield, label: "No login needed" },
  { icon: BarChart3, label: "CSV export" },
];

const Index = () => {
  const { phase, results, totalUrls, processedUrls, error, crawl, crawlUrls, reset } = useCrawler();
  const [showTop, setShowTop] = useState(false);
  const [domain, setDomain] = useState("");
  const [includeH1, setIncludeH1] = useState(false);

  useEffect(() => {
    const handleScroll = () => setShowTop(window.scrollY > 400);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleCrawl = (url: string, withH1: boolean) => {
    try {
      const parsed = new URL(url.startsWith("http") ? url : "https://" + url);
      setDomain(parsed.hostname);
    } catch {
      setDomain("unknown");
    }
    setIncludeH1(withH1);
    crawl(url, withH1);
  };

  const handleCrawlUrls = (urls: string[], withH1: boolean) => {
    setIncludeH1(withH1);
    crawlUrls(urls, withH1);
  };

  const isLoading = phase === "parsing" || phase === "crawling";

  return (
    <div className="min-h-screen bg-background">

      {/* ── Header ── */}
      <header className="border-b border-border/40 bg-card/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container max-w-6xl mx-auto flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shadow-[0_0_12px_hsl(var(--primary)/0.5)]">
              <Globe className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm tracking-tight">Sitemap Scout</span>
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 ml-1">
              FREE TOOL
            </span>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <a href="https://www.linkedin.com/in/shubhojitdas/" target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
                <Linkedin className="h-4 w-4" />
              </Button>
            </a>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden flex flex-col justify-center" style={{ minHeight: 'calc(100vh - 56px)' }}>
        {/* Background layers */}
        <div className="absolute inset-0 bg-hero-gradient pointer-events-none" />
        <div className="absolute inset-0 hero-dots pointer-events-none opacity-30" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-primary/8 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative container max-w-3xl mx-auto px-4 py-8 flex flex-col gap-5">

          {/* Badge + Headline stacked tightly */}
          <motion.div
            className="text-center space-y-3"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          >
            <div className="flex justify-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/25 bg-primary/8 text-primary text-[11px] font-semibold tracking-wide">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary"></span>
                </span>
                NOW WITH H1 TAG EXTRACTION
              </div>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.1]">
              <span className="gradient-text">SEO Metadata</span>
              {" "}
              <span className="text-foreground">at Your Fingertips</span>
            </h1>

            <p className="text-muted-foreground text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
              Extract every URL with its Meta Title, Description &amp; H1 — straight from any live sitemap.{" "}
              <span className="text-foreground/60 font-medium">Like Screaming Frog, but in your browser.</span>
            </p>

            {/* Feature pills — compact inline */}
            <div className="flex flex-wrap justify-center gap-2 pt-1">
              {BADGES.map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full bg-card border border-border/60 text-muted-foreground shadow-sm"
                >
                  <Icon className="h-3 w-3 text-primary" />
                  {label}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Form card */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.4 }}
          >
            <div className="relative w-full max-w-2xl mx-auto rounded-2xl border border-border/60 bg-card/95 backdrop-blur-sm shadow-[0_8px_40px_hsl(var(--primary)/0.12),0_2px_8px_hsl(230_25%_10%/0.08)] p-5">
              <div className="absolute inset-x-0 top-0 h-px rounded-t-2xl bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
              <CrawlForm onCrawl={handleCrawl} onCrawlUrls={handleCrawlUrls} isLoading={isLoading} onReset={reset} />
            </div>
          </motion.div>

          {/* Trust row */}
          <motion.div
            className="flex flex-wrap justify-center items-center gap-x-5 gap-y-1.5 text-[11px] text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {["Sitemap index support", "Bulk URL paste", "CSV / Excel upload", "Built by Shubhojit Das"].map((item) => (
              <span key={item} className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />
                {item}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Progress ── */}
      <section className="container max-w-6xl mx-auto pb-6 text-muted-foreground px-[24px]">
        <CrawlProgress phase={phase} processed={processedUrls} total={totalUrls} />
      </section>

      {/* ── Error ── */}
      {error && (
        <section className="container max-w-6xl mx-auto px-4 pb-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-destructive/10 text-destructive border border-destructive/20 rounded-lg p-4 text-sm"
          >
            <strong>Error:</strong> {error}
          </motion.div>
        </section>
      )}

      {/* ── Results ── */}
      {results.length > 0 && (
        <section className="container max-w-6xl mx-auto px-4 pb-16 space-y-6">
          <StatsCards results={results} includeH1={includeH1} />
          <ResultsTable results={results} domain={domain} includeH1={includeH1} />
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
            className="h-10 w-10 rounded-full shadow-lg"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        </motion.div>
      )}
    </div>
  );
};

export default Index;
