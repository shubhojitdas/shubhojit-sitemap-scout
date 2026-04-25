import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileCode2,
  Download,
  Copy,
  CheckCircle2,
  FolderTree,
  Globe,
  Search,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import type { CrawlResult } from "@/lib/crawl-api";
import { buildSitemap, downloadSitemap } from "@/lib/sitemap-generator";

interface SitemapGeneratorProps {
  results: CrawlResult[];
  domain: string;
}

export function SitemapGenerator({ results, domain }: SitemapGeneratorProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const { xml, entries, stats } = useMemo(
    () => buildSitemap(results, { fallbackLastmodToday: true }),
    [results],
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(xml);
      setCopied(true);
      toast.success("Sitemap XML copied");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Couldn't copy — try downloading instead");
    }
  };

  const handleDownload = () => {
    downloadSitemap(xml, domain);
    toast.success("sitemap.xml downloaded");
  };

  const sitemapUrl = `https://${domain || "yourdomain.com"}/sitemap.xml`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Button
            variant="default"
            size="sm"
            className="gap-1.5 relative overflow-hidden group"
          >
            <Sparkles className="h-3.5 w-3.5 transition-transform group-hover:rotate-12" />
            Generate sitemap.xml
            <span className="ml-1 inline-flex items-center justify-center rounded-md bg-primary-foreground/15 px-1.5 py-0.5 text-[10px] font-semibold">
              {stats.included}
            </span>
          </Button>
        </motion.div>
      </DialogTrigger>

      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] sm:w-full sm:max-w-2xl max-h-[90vh] overflow-hidden border-border/60 bg-background/95 backdrop-blur-xl p-0 flex flex-col">
        <DialogHeader className="px-4 sm:px-6 pt-5 pb-3 border-b border-border/60 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <FileCode2 className="h-5 w-5 text-primary" />
            Your sitemap.xml is ready
          </DialogTitle>
          <DialogDescription className="text-xs">
            Clean, Google-ready XML — only valid 2xx URLs, permanent redirects
            resolved to their final destination, no noise.
          </DialogDescription>
        </DialogHeader>

        {/* Stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-4 sm:px-6 py-3 border-b border-border/60 bg-muted/30 flex-shrink-0">
          <Stat label="Included" value={stats.included} accent />
          <Stat label="4xx / 5xx" value={stats.droppedNon2xx} />
          <Stat label="Temp redirects" value={stats.droppedTemporaryRedirect} />
          <Stat label="Duplicates" value={stats.droppedDuplicate} />
        </div>

        <Tabs defaultValue="preview" className="w-full flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="px-4 sm:px-6 pt-3 flex-shrink-0">
            <TabsList className="h-8 grid grid-cols-2 w-full">
              <TabsTrigger value="preview" className="text-xs h-6">
                XML Preview
              </TabsTrigger>
              <TabsTrigger value="install" className="text-xs h-6">
                How to install
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="preview" className="px-4 sm:px-6 pb-4 mt-3 flex-1 min-h-0 overflow-hidden flex flex-col">
            <div className="flex-1 min-h-[200px] rounded-md border border-border/60 bg-muted/20 overflow-auto">
              <pre className="text-[11px] leading-relaxed p-3 font-mono whitespace-pre-wrap break-all text-foreground/85 m-0">
                {xml}
              </pre>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground flex-shrink-0">
              Showing all {entries.length} URLs · UTF-8 · sitemap protocol 0.9
            </p>
          </TabsContent>

          <TabsContent value="install" className="px-4 sm:px-6 pb-4 mt-3 flex-1 min-h-0 overflow-hidden">
            <div className="h-full overflow-y-auto pr-1">
              <ol className="space-y-3">
                <Step
                  index={1}
                  icon={<Download className="h-3.5 w-3.5" />}
                  title="Download the file"
                  body="Click 'Download' below — this saves a sitemap.xml to your computer."
                />
                <Step
                  index={2}
                  icon={<FolderTree className="h-3.5 w-3.5" />}
                  title="Upload to your site root"
                  body={
                    <>
                      Place the file in the <strong>root directory</strong> of
                      your website so it's reachable at{" "}
                      <code className="px-1 py-0.5 rounded bg-muted text-[10px] break-all">
                        {sitemapUrl}
                      </code>
                      . Use FTP, your hosting file manager, or your CMS uploader.
                    </>
                  }
                />
                <Step
                  index={3}
                  icon={<Globe className="h-3.5 w-3.5" />}
                  title="Reference it in robots.txt"
                  body={
                    <>
                      Add this line to your{" "}
                      <code className="px-1 py-0.5 rounded bg-muted text-[10px]">
                        robots.txt
                      </code>
                      :
                      <pre className="mt-1.5 px-2 py-1.5 rounded bg-muted text-[10px] font-mono break-all whitespace-pre-wrap">
                        Sitemap: {sitemapUrl}
                      </pre>
                    </>
                  }
                />
                <Step
                  index={4}
                  icon={<Search className="h-3.5 w-3.5" />}
                  title="Submit to Google Search Console"
                  body={
                    <>
                      Open{" "}
                      <a
                        href="https://search.google.com/search-console/sitemaps"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-foreground"
                      >
                        Search Console → Sitemaps
                      </a>
                      , paste{" "}
                      <code className="px-1 py-0.5 rounded bg-muted text-[10px]">
                        sitemap.xml
                      </code>{" "}
                      and hit Submit. Google usually picks it up within minutes.
                    </>
                  }
                />
              </ol>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex items-center justify-end gap-2 px-4 sm:px-6 py-3 border-t border-border/60 bg-muted/20 flex-wrap flex-shrink-0">
          <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
            <AnimatePresence mode="wait" initial={false}>
              {copied ? (
                <motion.span
                  key="ok"
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  className="flex items-center gap-1.5"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Copied
                </motion.span>
              ) : (
                <motion.span
                  key="copy"
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  className="flex items-center gap-1.5"
                >
                  <Copy className="h-3.5 w-3.5" /> Copy XML
                </motion.span>
              )}
            </AnimatePresence>
          </Button>
          <Button size="sm" onClick={handleDownload} className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            Download sitemap.xml
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="text-center">
      <div
        className={`text-base font-semibold tabular-nums ${
          accent ? "text-primary" : "text-foreground"
        }`}
      >
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function Step({
  index,
  icon,
  title,
  body,
}: {
  index: number;
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <motion.li
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06, duration: 0.25 }}
      className="flex gap-3"
    >
      <div className="flex-shrink-0 flex flex-col items-center">
        <div className="h-6 w-6 rounded-full border border-border bg-background flex items-center justify-center text-[10px] font-semibold text-foreground">
          {index}
        </div>
      </div>
      <div className="flex-1 pb-1">
        <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          {icon}
          {title}
        </div>
        <div className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          {body}
        </div>
      </div>
    </motion.li>
  );
}
