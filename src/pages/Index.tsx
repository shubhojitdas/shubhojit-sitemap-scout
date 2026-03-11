import { useCrawler } from "@/hooks/use-crawler";
import { CrawlForm } from "@/components/CrawlForm";
import { CrawlProgress } from "@/components/CrawlProgress";
import { StatsCards } from "@/components/StatsCards";
import { ResultsTable } from "@/components/ResultsTable";
import { ThemeToggle } from "@/components/ThemeToggle";
import { motion } from "framer-motion";
import { Globe, ArrowUp, Linkedin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

const Index = () => {
  const { phase, results, totalUrls, processedUrls, error, crawl, crawlUrls, reset } = useCrawler();
  const [showTop, setShowTop] = useState(false);
  const [domain, setDomain] = useState("");

  useEffect(() => {
    const handleScroll = () => setShowTop(window.scrollY > 400);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleCrawl = (url: string) => {
    try {
      const parsed = new URL(url.startsWith("http") ? url : "https://" + url);
      setDomain(parsed.hostname);
    } catch {
      setDomain("unknown");
    }
    crawl(url);
  };

  const isLoading = phase === "parsing" || phase === "crawling";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container max-w-6xl mx-auto flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Globe className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm tracking-tight">Shubhojit's Sitemap Scout</span>
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

      {/* Hero */}
      <section className="container max-w-6xl mx-auto px-4 pt-16 pb-10">
        <motion.div
          className="text-center space-y-4 mb-10"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
            <span className="gradient-text">Sitemap Crawler</span>
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto">
            Extract all URLs with meta titles & descriptions from any sitemap.xml — like Screaming Frog, in your browser.
          </p>
        </motion.div>

        <CrawlForm onCrawl={handleCrawl} isLoading={isLoading} onReset={reset} />
      </section>

      {/* Progress */}
      <section className="container max-w-6xl mx-auto px-4 pb-6">
        <CrawlProgress phase={phase} processed={processedUrls} total={totalUrls} />
      </section>

      {/* Error */}
      {error &&
      <section className="container max-w-6xl mx-auto px-4 pb-6">
          <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-destructive/10 text-destructive border border-destructive/20 rounded-lg p-4 text-sm">

            <strong>Error:</strong> {error}
          </motion.div>
        </section>
      }

      {/* Results */}
      {results.length > 0 &&
      <section className="container max-w-6xl mx-auto px-4 pb-16 space-y-6">
          <StatsCards results={results} />
          <ResultsTable results={results} domain={domain} />
        </section>
      }

      {/* Back to top */}
      {showTop &&
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="fixed bottom-6 right-6 z-50">

          <Button
          size="icon"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="h-10 w-10 rounded-full shadow-lg">

            <ArrowUp className="h-4 w-4" />
          </Button>
        </motion.div>
      }
    </div>);

};

export default Index;