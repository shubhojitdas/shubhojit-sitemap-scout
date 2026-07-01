import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Bot, Share2, Languages, Wrench, Eraser } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RobotsTxtPanel } from "@/components/RobotsTxtPanel";
import { SocialTagGenerator } from "@/components/SocialTagGenerator";
import { HreflangGenerator } from "@/components/HreflangGenerator";
import { useToast } from "@/hooks/use-toast";

/**
 * Home-page Standalone Tools section.
 *
 * Gives users one-click access to the three utilities that don't require
 * a full crawl: Robots.txt tester, OG/Twitter generator + visualizer, and
 * Hreflang generator.
 *
 * UX requirements honored here:
 *  - Tab contents stay mounted (forceMount + data-state hide) so switching
 *    tabs NEVER drops user input. State only resets when the user clicks
 *    "Clear" on that tab.
 *  - Each tab has its own explicit "Clear" button (bumps a per-tab key
 *    to force a fresh remount of the underlying tool).
 *  - A beforeunload listener warns the user before they accidentally
 *    refresh or close the tab once they've started entering data here.
 */
export function StandaloneTools() {
  const { toast } = useToast();
  const [tab, setTab] = useState<"robots" | "social" | "hreflang">("robots");

  // Robots tab state
  const [robotsDomainInput, setRobotsDomainInput] = useState("");
  const [robotsDomain, setRobotsDomain] = useState("");
  const [robotsKey, setRobotsKey] = useState(0);

  // Per-tool reset keys for the Social + Hreflang generators
  const [socialKey, setSocialKey] = useState(0);
  const [hreflangKey, setHreflangKey] = useState(0);

  // Dirty tracking — set true on the first user input inside the section
  // so we can warn before an accidental refresh wipes generated data.
  const [dirty, setDirty] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Most modern browsers ignore the custom string but still show their
      // native confirmation dialog when returnValue is set.
      e.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

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
    if (d) {
      setRobotsDomain(d);
      setRobotsKey((k) => k + 1);
    }
  };

  const clearRobots = () => {
    setRobotsDomainInput("");
    setRobotsDomain("");
    setRobotsKey((k) => k + 1);
    toast({ title: "Robots tester cleared" });
  };

  const clearSocial = () => {
    setSocialKey((k) => k + 1);
    toast({ title: "OG / Twitter generator cleared" });
  };

  const clearHreflang = () => {
    setHreflangKey((k) => k + 1);
    toast({ title: "Hreflang generator cleared" });
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="container max-w-5xl mx-auto px-4 pt-10 pb-20"
    >
      {/* Section header — GSAP-style: tight, high-contrast, single green accent */}
      <div className="text-center mb-8">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/[0.06] text-[10.5px] font-mono uppercase tracking-[0.14em] text-primary mb-4"
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary"></span>
          </span>
          <Wrench className="h-3 w-3" />
          Standalone tools · no crawl required
        </motion.div>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
          Quick <span className="iridescent-text">tools</span>
        </h2>
        <p className="text-sm text-muted-foreground mt-3 max-w-xl mx-auto leading-relaxed">
          Test your robots.txt, generate or preview OG &amp; Twitter tags, and build
          hreflang clusters — all without running a full crawl. Your input
          persists when switching tabs.
        </p>
      </div>

      <div
        ref={sectionRef}
        onInputCapture={() => { if (!dirty) setDirty(true); }}
        className="relative rounded-2xl border border-border/70 bg-card/60 backdrop-blur-xl p-4 sm:p-6 overflow-hidden card-lift"
      >
        {/* Soft green ambient glow — matches GSAP hero glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full blur-3xl opacity-30 transition-opacity duration-700"
          style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.55), transparent 65%)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -right-16 h-64 w-64 rounded-full blur-3xl opacity-20 transition-opacity duration-700"
          style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.4), transparent 65%)" }}
        />

        <div className="relative">
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList className="grid w-full grid-cols-3 mb-5 h-11 p-1 bg-muted/40 border border-border/50">
              <TabsTrigger
                value="robots"
                className="press-tuck text-xs sm:text-sm gap-1.5 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-[0_6px_20px_-10px_hsl(var(--primary)/0.55)] font-medium"
              >
                <Bot className="h-3.5 w-3.5 transition-transform duration-300 group-data-[state=active]:scale-110" />
                <span className="hidden sm:inline">Robots.txt Tester</span>
                <span className="sm:hidden">Robots</span>
              </TabsTrigger>
              <TabsTrigger
                value="social"
                className="press-tuck text-xs sm:text-sm gap-1.5 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-[0_6px_20px_-10px_hsl(var(--primary)/0.55)] font-medium"
              >
                <Share2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">OG &amp; Twitter</span>
                <span className="sm:hidden">Social</span>
              </TabsTrigger>
              <TabsTrigger
                value="hreflang"
                className="press-tuck text-xs sm:text-sm gap-1.5 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-[0_6px_20px_-10px_hsl(var(--primary)/0.55)] font-medium"
              >
                <Languages className="h-3.5 w-3.5" />
                Hreflang
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="robots"
              forceMount
              className="mt-0 data-[state=inactive]:hidden"
            >
              <motion.div
                key="tab-robots"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="mb-4 flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                    Load a live robots.txt or paste rules below
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearRobots}
                    className="press-tuck h-7 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                  >
                    <Eraser className="h-3 w-3" /> Clear
                  </Button>
                </div>
                <div className="mb-5 rounded-xl border border-border/60 bg-background/40 p-4 card-lift">
                  <label className="text-[10.5px] font-mono font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Domain
                  </label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      value={robotsDomainInput}
                      onChange={(e) => setRobotsDomainInput(e.target.value)}
                      placeholder="example.com"
                      className="h-10 text-sm bg-background/60"
                      onKeyDown={(e) => { if (e.key === "Enter") loadRobots(); }}
                    />
                    <Button
                      onClick={loadRobots}
                      size="sm"
                      className="press-tuck h-10 px-5 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-[0_6px_20px_-10px_hsl(var(--primary)/0.7)]"
                    >
                      Load
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    Optional — paste rules manually below to test any robots.txt.
                  </p>
                </div>
                <RobotsTxtPanel key={robotsKey} results={[]} domain={robotsDomain} />
              </motion.div>
            </TabsContent>

            <TabsContent
              value="social"
              forceMount
              className="mt-0 data-[state=inactive]:hidden"
            >
              <motion.div
                key="tab-social"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="mb-4 flex items-center justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSocial}
                    className="press-tuck h-7 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                  >
                    <Eraser className="h-3 w-3" /> Clear
                  </Button>
                </div>
                <SocialTagGenerator key={socialKey} results={[]} />
              </motion.div>
            </TabsContent>

            <TabsContent
              value="hreflang"
              forceMount
              className="mt-0 data-[state=inactive]:hidden"
            >
              <motion.div
                key="tab-hreflang"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="mb-4 flex items-center justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearHreflang}
                    className="press-tuck h-7 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                  >
                    <Eraser className="h-3 w-3" /> Clear
                  </Button>
                </div>
                <HreflangGenerator key={hreflangKey} />
              </motion.div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </motion.section>
  );
}
