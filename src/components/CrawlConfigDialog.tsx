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

export function CrawlConfigDialog({ open, onOpenChange, config, onChange }: Props) {
  const set = (key: keyof CrawlConfig, val: boolean) => {
    const next = { ...config, [key]: val };
    if (key === "includeInternalLinks" && !val) next.jsRenderedLinks = false;
    onChange(next);
  };

  const enabledCount = Object.values(config).filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Crawl Configuration
          </DialogTitle>
          <DialogDescription>
            Choose which SEO data to extract. {enabledCount} option{enabledCount === 1 ? "" : "s"} enabled.
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
                  .filter((it) => !it.parent || config[it.parent])
                  .map((it) => {
                    const checked = !!config[it.key];
                    return (
                      <Label
                        key={it.key}
                        htmlFor={`cfg-${it.key}`}
                        className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer text-xs font-medium transition-colors ${
                          checked
                            ? "border-foreground/40 bg-muted"
                            : "border-border hover:border-foreground/30 hover:bg-muted/50"
                        }`}
                      >
                        <Checkbox
                          id={`cfg-${it.key}`}
                          checked={checked}
                          onCheckedChange={(v) => set(it.key, !!v)}
                        />
                        <span className="text-muted-foreground">{it.icon}</span>
                        <span>{it.label}</span>
                      </Label>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => onChange(DEFAULT_CRAWL_CONFIG)}>
            Reset
          </Button>
          <Button size="sm" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
