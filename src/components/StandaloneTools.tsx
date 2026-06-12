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
          hreflang clusters — all without running a full crawl. Your input
          persists when switching tabs; use <strong>Clear</strong> to reset a tool.
        </p>
      </div>

      <div
        ref={sectionRef}
        // Mark the section dirty on the first real user input so we can
        // warn before refresh. Stays dirty until the page reloads.
        onInputCapture={() => { if (!dirty) setDirty(true); }}
        className="rounded-xl border border-border bg-card p-3 sm:p-5 card-elevated"
      >
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

          {/* forceMount keeps each tool mounted so its internal state (entered
              URLs, generated tags, edited rules) is preserved when the user
              switches tabs. Inactive tabs are hidden via the data-state attr. */}

          <TabsContent
            value="robots"
            forceMount
            className="mt-0 data-[state=inactive]:hidden"
          >
            <div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[11px] text-muted-foreground">
                Load a live robots.txt or paste rules manually below.
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={clearRobots}
                className="h-7 text-[11px] gap-1"
              >
                <Eraser className="h-3 w-3" /> Clear robots tester
              </Button>
            </div>
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
            <RobotsTxtPanel key={robotsKey} results={[]} domain={robotsDomain} />
          </TabsContent>

          <TabsContent
            value="social"
            forceMount
            className="mt-0 data-[state=inactive]:hidden"
          >
            <div className="mb-3 flex items-center justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={clearSocial}
                className="h-7 text-[11px] gap-1"
              >
                <Eraser className="h-3 w-3" /> Clear OG / Twitter generator
              </Button>
            </div>
            <SocialTagGenerator key={socialKey} results={[]} />
          </TabsContent>

          <TabsContent
            value="hreflang"
            forceMount
            className="mt-0 data-[state=inactive]:hidden"
          >
            <div className="mb-3 flex items-center justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={clearHreflang}
                className="h-7 text-[11px] gap-1"
              >
                <Eraser className="h-3 w-3" /> Clear hreflang generator
              </Button>
            </div>
            <HreflangGenerator key={hreflangKey} />
          </TabsContent>
        </Tabs>
      </div>
    </motion.section>
  );
}
