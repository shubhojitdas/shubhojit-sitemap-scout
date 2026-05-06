import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Heading1, Heading2, Heading3, Image as ImageIcon, Code, Bot, Link2,
  Languages, LinkIcon, Zap, Share2, FileText, Settings2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

export interface CrawlConfig {
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
  jsRenderedLinks: boolean;
  includeSocialTags: boolean;
  userAgent: string;
}

export const USER_AGENT_PRESETS: { label: string; value: string }[] = [
  { label: "Sitemap Scout (Default)", value: "Mozilla/5.0 (compatible; SitemapCrawlerPro/1.0)" },
  { label: "Googlebot Desktop", value: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" },
  { label: "Googlebot Mobile", value: "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" },
  { label: "Bingbot", value: "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)" },
  { label: "Chrome Desktop", value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36" },
  { label: "Chrome Mobile", value: "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36" },
  { label: "Safari Desktop", value: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15" },
];

export const DEFAULT_CRAWL_CONFIG: CrawlConfig = {
  includeTitle: false,
  includeDesc: false,
  includeH1: false,
  includeH2: false,
  includeH3: false,
  includeImages: false,
  includeSchemas: false,
  includeRobots: false,
  includeCanonical: false,
  includeHreflangs: false,
  includeInternalLinks: false,
  jsRenderedLinks: false,
  includeSocialTags: false,
  userAgent: USER_AGENT_PRESETS[0].value,
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  config: CrawlConfig;
  onChange: (c: CrawlConfig) => void;
  /** Mode: "initial" — user hasn't crawled yet. "incremental" — crawl exists, offer add-fields/refresh flow. */
  mode?: "initial" | "incremental";
  /** Flags that have been crawled at least once on the current dataset. Greyed out by default in incremental mode. */
  crawledFlags?: CrawlConfig;
  /** Called when user submits an incremental extract — receives only the fields to (re)extract. */
  onExtend?: (extraOpts: Partial<CrawlConfig>) => void;
}

interface ToggleDef {
  key: keyof CrawlConfig;
  label: string;
  icon: React.ReactNode;
  desc?: string;
  /** If set, this toggle is hidden when its parent key is false. */
  parent?: keyof CrawlConfig;
}

const GROUPS: { title: string; items: ToggleDef[] }[] = [
  {
    title: "Content",
    items: [
      { key: "includeTitle", label: "Meta Title", icon: <FileText className="h-3.5 w-3.5" /> },
      { key: "includeDesc", label: "Meta Description", icon: <FileText className="h-3.5 w-3.5" /> },
      { key: "includeRobots", label: "Meta Robots", icon: <Bot className="h-3.5 w-3.5" /> },
      { key: "includeCanonical", label: "Canonical", icon: <Link2 className="h-3.5 w-3.5" /> },
    ],
  },
  {
    title: "Headings",
    items: [
      { key: "includeH1", label: "H1 Tags", icon: <Heading1 className="h-3.5 w-3.5" /> },
      { key: "includeH2", label: "H2 Tags", icon: <Heading2 className="h-3.5 w-3.5" /> },
      { key: "includeH3", label: "H3 Tags", icon: <Heading3 className="h-3.5 w-3.5" /> },
    ],
  },
  {
    title: "Media",
    items: [
      { key: "includeImages", label: "Image Alt Texts", icon: <ImageIcon className="h-3.5 w-3.5" /> },
    ],
  },
  {
    title: "Structured Data",
    items: [
      { key: "includeSchemas", label: "Schema Markup", icon: <Code className="h-3.5 w-3.5" /> },
      { key: "includeHreflangs", label: "Hreflang", icon: <Languages className="h-3.5 w-3.5" /> },
    ],
  },
  {
    title: "Links",
    items: [
      { key: "includeInternalLinks", label: "Internal Links", icon: <LinkIcon className="h-3.5 w-3.5" /> },
      { key: "jsRenderedLinks", label: "JS Rendered (slower)", icon: <Zap className="h-3.5 w-3.5" />, parent: "includeInternalLinks" },
    ],
  },
  {
    title: "Social",
    items: [
      { key: "includeSocialTags", label: "OG & Twitter Tags", icon: <Share2 className="h-3.5 w-3.5" /> },
    ],
  },
];

const EMPTY_FLAGS: CrawlConfig = {
  includeTitle: false, includeDesc: false, includeH1: false, includeH2: false, includeH3: false,
  includeImages: false, includeSchemas: false, includeRobots: false, includeCanonical: false,
  includeHreflangs: false, includeInternalLinks: false, jsRenderedLinks: false, includeSocialTags: false,
  userAgent: USER_AGENT_PRESETS[0].value,
};

export function CrawlConfigDialog({
  open, onOpenChange, config, onChange,
  mode = "initial", crawledFlags = EMPTY_FLAGS, onExtend,
}: Props) {
  const isIncremental = mode === "incremental";

  // In incremental mode the user freely picks any fields to (re)extract.
  // Previously-crawled fields are NOT greyed — they're just badged so the user
  // knows clicking them will overwrite stored values for the same URL set.
  const [extraSelection, setExtraSelection] = useState<CrawlConfig>(EMPTY_FLAGS);

  useEffect(() => {
    if (open && isIncremental) setExtraSelection(EMPTY_FLAGS);
  }, [open, isIncremental]);

  const setInitial = (key: keyof CrawlConfig, val: boolean) => {
    const next = { ...config, [key]: val };
    if (key === "includeInternalLinks" && !val) next.jsRenderedLinks = false;
    onChange(next);
  };

  const setExtra = (key: keyof CrawlConfig, val: boolean) => {
    const next = { ...extraSelection, [key]: val };
    if (key === "includeInternalLinks" && !val) next.jsRenderedLinks = false;
    setExtraSelection(next);
  };

  const initialEnabled = Object.values(config).filter(Boolean).length;
  const extraEnabled = Object.values(extraSelection).filter(Boolean).length;
  const overwriteCount = (Object.entries(extraSelection) as [keyof CrawlConfig, boolean][])
    .filter(([k, v]) => v && crawledFlags[k]).length;

  const handleExtend = () => {
    if (extraEnabled === 0) return;
    onExtend?.({ ...extraSelection });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:w-full sm:max-w-2xl max-h-[85vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Settings2 className="h-4 w-4" />
            {isIncremental ? "Extract more data" : "Crawl Configuration"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {isIncremental ? (
              <>
                Pick any fields to (re)extract from your existing crawl. Already-crawled
                fields are marked — selecting them will refresh their values.
              </>
            ) : (
              <>Choose which SEO data to extract. {initialEnabled} option{initialEnabled === 1 ? "" : "s"} enabled.</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {GROUPS.map((group) => (
            <div key={group.title}>
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {group.title}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {group.items
                  .filter((it) => !it.parent || (isIncremental ? extraSelection[it.parent] : config[it.parent]))
                  .map((it) => {
                    const alreadyCrawled = isIncremental && crawledFlags[it.key];
                    const checked = isIncremental ? !!extraSelection[it.key] : !!config[it.key];

                    return (
                      <Label
                        key={it.key}
                        htmlFor={`cfg-${it.key}`}
                        className={`flex items-center gap-2 px-3 py-2 rounded-md border text-xs font-medium cursor-pointer transition-colors ${
                          checked
                            ? "border-foreground/40 bg-muted"
                            : "border-border hover:border-foreground/30 hover:bg-muted/50"
                        }`}
                      >
                        <Checkbox
                          id={`cfg-${it.key}`}
                          checked={checked}
                          onCheckedChange={(v) =>
                            isIncremental ? setExtra(it.key, !!v) : setInitial(it.key, !!v)
                          }
                        />
                        <span className="text-muted-foreground">{it.icon}</span>
                        <span className="flex-1 truncate">{it.label}</span>
                        {alreadyCrawled && (
                          <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted-foreground/15 text-muted-foreground">
                            crawled
                          </span>
                        )}
                      </Label>
                    );
                  })}
              </div>
            </div>
          ))}

          {isIncremental && overwriteCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-md border border-warning/30 bg-warning/10 p-2.5 text-[11px] text-warning"
            >
              {overwriteCount} previously-crawled field{overwriteCount === 1 ? "" : "s"} will be refreshed and overwritten for the same URL set.
            </motion.div>
          )}

          {/* User-Agent selector — only for initial crawls */}
          {!isIncremental && (
            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Crawler Identity
              </h4>
              <select
                value={USER_AGENT_PRESETS.some((p) => p.value === config.userAgent) ? config.userAgent : "__custom__"}
                onChange={(e) => {
                  if (e.target.value === "__custom__") return;
                  onChange({ ...config, userAgent: e.target.value });
                }}
                className="w-full h-9 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {USER_AGENT_PRESETS.map((p) => (
                  <option key={p.label} value={p.value}>{p.label}</option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground mt-1.5">
                Choose how the crawler identifies itself. Use Googlebot to see what Google sees, or a browser UA to bypass basic bot detection.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 flex-col-reverse sm:flex-row">
          {isIncremental ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setExtraSelection(EMPTY_FLAGS)}>
                Reset
              </Button>
              <Button
                size="sm"
                onClick={handleExtend}
                disabled={extraEnabled === 0}
                className="gap-1.5"
              >
                Extract {extraEnabled} field{extraEnabled === 1 ? "" : "s"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => onChange(DEFAULT_CRAWL_CONFIG)}>
                Reset
              </Button>
              <Button size="sm" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
