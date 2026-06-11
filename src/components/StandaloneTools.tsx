import { useState } from "react";
import { motion } from "framer-motion";
import { Bot, Share2, Languages, Wrench } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RobotsTxtPanel } from "@/components/RobotsTxtPanel";
import { SocialTagGenerator } from "@/components/SocialTagGenerator";
import { HreflangGenerator } from "@/components/HreflangGenerator";

/**
 * Home-page Standalone Tools section.
 *
 * Gives users one-click access to the three utilities that don't require
 * a full crawl: Robots.txt tester, OG/Twitter generator + visualizer, and
 * Hreflang generator. Each tool is rendered with empty crawl context so
 * they work fully standalone (no crawl results needed).
 */
export function StandaloneTools() {
  const [tab, setTab] = useState<"robots" | "social" | "hreflang">("robots");
  const [robotsDomainInput, setRobotsDomainInput] = useState("");
  const [robotsDomain, setRobotsDomain] = useState("");

  const normalizeDomain = (raw: string): string => {
    const v = raw.trim();
    if (!v) return "";
    try {
      const u = new URL(v.startsWith("http") ? v : "https://" + v);
      return u.hostname;
    } catch {
      return v.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    }
  };

  const loadRobots = () => {
    const d = normalizeDomain(robotsDomainInput);
    if (d) setRobotsDomain(d);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.4 }}
      className="container max-w-5xl mx-auto px-4 pt-6 pb-16"
    >
      <div className="text-center mb-5">
        <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground mb-2">
          <Wrench className="h-3 w-3" />
          Standalone SEO tools — no crawl required
        </div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
          Quick tools
        </h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-xl mx-auto">
          Test your robots.txt, generate or preview OG &amp; Twitter tags, and build
          hreflang clusters — all without running a full crawl.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-3 sm:p-5 card-elevated">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="robots" className="text-xs sm:text-sm gap-1.5">
              <Bot className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Robots.txt Tester</span>
              <span className="sm:hidden">Robots</span>
            </TabsTrigger>
            <TabsTrigger value="social" className="text-xs sm:text-sm gap-1.5">
              <Share2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">OG &amp; Twitter</span>
              <span className="sm:hidden">Social</span>
            </TabsTrigger>
            <TabsTrigger value="hreflang" className="text-xs sm:text-sm gap-1.5">
              <Languages className="h-3.5 w-3.5" />
              Hreflang
            </TabsTrigger>
          </TabsList>

          <TabsContent value="robots" className="mt-0">
            <div className="mb-4 rounded-lg border border-border bg-muted/20 p-3">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Domain to fetch robots.txt from
              </label>
              <div className="flex gap-2 mt-1.5">
                <Input
                  value={robotsDomainInput}
                  onChange={(e) => setRobotsDomainInput(e.target.value)}
                  placeholder="example.com"
                  className="h-9 text-sm"
                  onKeyDown={(e) => { if (e.key === "Enter") loadRobots(); }}
                />
                <Button onClick={loadRobots} size="sm" className="h-9">
                  Load
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Optional — you can also paste rules manually below to test any robots.txt.
              </p>
            </div>
            <RobotsTxtPanel key={robotsDomain || "blank"} results={[]} domain={robotsDomain} />
          </TabsContent>

          <TabsContent value="social" className="mt-0">
            <SocialTagGenerator results={[]} />
          </TabsContent>

          <TabsContent value="hreflang" className="mt-0">
            <HreflangGenerator />
          </TabsContent>
        </Tabs>
      </div>
    </motion.section>
  );
}
