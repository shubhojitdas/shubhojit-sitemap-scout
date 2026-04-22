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
  Languages, LinkIcon, Zap, Share2, FileText, Settings2, AlertTriangle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

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
}

export const DEFAULT_CRAWL_CONFIG: CrawlConfig = {
  includeTitle: true,
  includeDesc: true,
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
};

export function CrawlConfigDialog({
  open, onOpenChange, config, onChange,
  mode = "initial", crawledFlags = EMPTY_FLAGS, onExtend,
}: Props) {
  const isIncremental = mode === "incremental";

  // In incremental mode, build a separate "selection" that defaults to nothing
  // and lets the user opt into newly-added fields, plus opt into RE-crawling
  // already-crawled fields (with a warning).
  const [extraSelection, setExtraSelection] = useState<CrawlConfig>(EMPTY_FLAGS);
  const [recrawlExisting, setRecrawlExisting] = useState(false);

  // Reset incremental selection whenever the dialog opens fresh.
  useEffect(() => {
    if (open && isIncremental) {
      setExtraSelection(EMPTY_FLAGS);
      setRecrawlExisting(false);
    }
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
  const recrawlingCount = recrawlExisting
    ? (Object.entries(extraSelection) as [keyof CrawlConfig, boolean][])
        .filter(([k, v]) => v && crawledFlags[k]).length
    : 0;
  const newFieldsCount = (Object.entries(extraSelection) as [keyof CrawlConfig, boolean][])
    .filter(([k, v]) => v && !crawledFlags[k]).length;

  const handleExtend = () => {
    if (extraEnabled === 0) return;
    // If recrawlExisting is OFF, strip out any flags that were already crawled.
    const finalSelection: Partial<CrawlConfig> = { ...extraSelection };
    if (!recrawlExisting) {
      for (const k of Object.keys(crawledFlags) as (keyof CrawlConfig)[]) {
        if (crawledFlags[k]) finalSelection[k] = false;
      }
    }
    onExtend?.(finalSelection);
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
                Pick additional fields to extract from your existing {Object.keys(crawledFlags).length}-field crawl.
                Already-crawled fields are greyed out — toggle{" "}
                <strong>Re-crawl existing fields</strong> below if you want to refresh them too.
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
                  .filter((it) => !it.parent || (isIncremental ? extraSelection[it.parent] || crawledFlags[it.parent] : config[it.parent]))
                  .map((it) => {
                    const alreadyCrawled = isIncremental && crawledFlags[it.key];
                    const greyedOut = alreadyCrawled && !recrawlExisting;
                    const checked = isIncremental ? !!extraSelection[it.key] : !!config[it.key];

                    return (
                      <Label
                        key={it.key}
                        htmlFor={`cfg-${it.key}`}
                        className={`flex items-center gap-2 px-3 py-2 rounded-md border text-xs font-medium transition-colors ${
                          greyedOut
                            ? "border-border bg-muted/30 opacity-50 cursor-not-allowed"
                            : checked
                              ? "border-foreground/40 bg-muted cursor-pointer"
                              : "border-border hover:border-foreground/30 hover:bg-muted/50 cursor-pointer"
                        }`}
                      >
                        <Checkbox
                          id={`cfg-${it.key}`}
                          checked={checked}
                          disabled={greyedOut}
                          onCheckedChange={(v) =>
                            isIncremental ? setExtra(it.key, !!v) : setInitial(it.key, !!v)
                          }
                        />
                        <span className="text-muted-foreground">{it.icon}</span>
                        <span className="flex-1 truncate">{it.label}</span>
                        {alreadyCrawled && (
                          <span className="text-[9px] uppercase tracking-wider text-muted-foreground/70">
                            crawled
                          </span>
                        )}
                      </Label>
                    );
                  })}
              </div>
            </div>
          ))}

          {/* Re-crawl toggle (incremental only) */}
          {isIncremental && (
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <Label className="flex items-start gap-2 cursor-pointer">
                <Checkbox
                  checked={recrawlExisting}
                  onCheckedChange={(v) => setRecrawlExisting(!!v)}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="text-xs font-medium">Re-crawl existing fields too</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Allows you to refresh fields that were already extracted. Selected
                    fields will overwrite their stored values for the same set of URLs.
                  </div>
                </div>
              </Label>
              <AnimatePresence>
                {recrawlingCount > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-2 flex items-start gap-1.5 rounded bg-warning/10 border border-warning/30 p-2 text-[11px] text-warning"
                  >
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>
                      {recrawlingCount} previously-crawled field{recrawlingCount === 1 ? "" : "s"} will be overwritten with fresh data. The URL list stays the same.
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 flex-col-reverse sm:flex-row">
          {isIncremental ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setExtraSelection(EMPTY_FLAGS);
                  setRecrawlExisting(false);
                }}
              >
                Reset
              </Button>
              <Button
                size="sm"
                onClick={handleExtend}
                disabled={extraEnabled === 0 || (newFieldsCount === 0 && recrawlingCount === 0)}
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
