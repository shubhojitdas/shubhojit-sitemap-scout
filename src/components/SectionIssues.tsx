import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle, AlertTriangle, Info, CheckCircle2,
  Lightbulb, Wrench, ChevronDown, ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  analyzeSeoIssues, type SeoIssue, type IssueSeverity, type FieldFlags,
} from "@/lib/seo-issues";
import type { CrawlResult } from "@/lib/crawl-api";
import type { SectionKey } from "@/components/SectionVisualization";

/**
 * Compact issue panel rendered directly under the per-section pie chart
 * (SectionVisualization). It surfaces only the rules tied to the field the
 * user is currently looking at, so audits stay focused.
 *
 * Reuses the same rule engine as the global SEO Issues view — no AI, just
 * static rules over crawl data — so behaviour stays consistent.
 */

const SECTION_TO_FLAG: Partial<Record<SectionKey, keyof FieldFlags>> = {
  "page-titles": "includeTitle",
  "meta-description": "includeDesc",
  h1: "includeH1",
  h2: "includeH2",
  h3: "includeH3",
  images: "includeImages",
  schema: "includeSchemas",
  "meta-robots": "includeRobots",
  canonicals: "includeCanonical",
  hreflang: "includeHreflangs",
  "internal-links": "includeInternalLinks",
  social: "includeSocialTags",
};

const SEV_META: Record<IssueSeverity, { label: string; icon: typeof AlertCircle; tone: string; bg: string; ring: string }> = {
  critical: { label: "Critical", icon: AlertCircle,    tone: "text-destructive",        bg: "bg-destructive/10", ring: "ring-destructive/30" },
  warning:  { label: "Warning",  icon: AlertTriangle,  tone: "text-warning",            bg: "bg-warning/10",     ring: "ring-warning/30" },
  info:     { label: "Tip",      icon: Info,           tone: "text-muted-foreground",   bg: "bg-muted/40",       ring: "ring-border" },
};

interface Props {
  view: SectionKey;
  results: CrawlResult[];
}

export function SectionIssues({ view, results }: Props) {
  const flag = SECTION_TO_FLAG[view];

  // Build a flags object with only this section's flag enabled, so the rule
  // engine evaluates exactly the rules tied to this field.
  const issues = useMemo(() => {
    if (!flag) return [];
    const onlyThisFlag: FieldFlags = {
      includeTitle: false, includeDesc: false, includeH1: false, includeH2: false, includeH3: false,
      includeImages: false, includeSchemas: false, includeRobots: false, includeCanonical: false,
      includeHreflangs: false, includeInternalLinks: false, includeSocialTags: false,
      [flag]: true,
    };
    // Filter further: drop universal-rule issues that aren't tied to this field.
    return analyzeSeoIssues(results, onlyThisFlag).filter((i) => i.flag === flag);
  }, [flag, results]);

  if (!flag) return null;

  if (issues.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-3 flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
        <div>
          <p className="text-xs font-medium">No issues detected for this field</p>
          <p className="text-[11px] text-muted-foreground">
            Every crawled page meets the recommended best practices for this section.
          </p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-lg border border-border bg-card overflow-hidden"
    >
      <div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center gap-2">
        <Lightbulb className="h-3.5 w-3.5 text-warning" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/80">
          Issues &amp; recommendations
        </span>
        <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal ml-auto">
          {issues.length} {issues.length === 1 ? "finding" : "findings"}
        </Badge>
      </div>
      <div className="divide-y divide-border">
        {issues.map((issue) => (
          <IssueRow key={issue.id} issue={issue} />
        ))}
      </div>
    </motion.div>
  );
}

function IssueRow({ issue }: { issue: SeoIssue }) {
  const [open, setOpen] = useState(false);
  const meta = SEV_META[issue.severity];
  const Icon = meta.icon;

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors"
      >
        <div className={`flex-shrink-0 h-7 w-7 rounded-md flex items-center justify-center ${meta.bg} ring-1 ${meta.ring}`}>
          <Icon className={`h-3.5 w-3.5 ${meta.tone}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <Badge className={`text-[10px] h-4 px-1.5 font-normal ${meta.bg} ${meta.tone} border-transparent`}>
              {meta.label}
            </Badge>
          </div>
          <h4 className="text-xs font-medium leading-snug">{issue.title}</h4>
        </div>
        <ChevronDown
          className={`flex-shrink-0 h-3.5 w-3.5 text-muted-foreground transition-transform mt-1 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 space-y-2.5 bg-muted/20">
              <Block icon={<Lightbulb className="h-3 w-3" />} title="Why this matters" body={issue.why} />
              <Block icon={<Wrench className="h-3 w-3" />}    title="How to fix"        body={issue.fix} />
              <UrlList urls={issue.urls} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Block({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-foreground/70 mb-1">
        {icon}
        {title}
      </div>
      <p className="text-[11px] leading-relaxed text-foreground/85">{body}</p>
    </div>
  );
}

function UrlList({ urls }: { urls: string[] }) {
  const [showAll, setShowAll] = useState(false);
  if (!urls.length) return null;
  const preview = showAll ? urls : urls.slice(0, 5);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-foreground/70">
          Affected URLs ({urls.length})
        </div>
        {urls.length > 5 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 text-[10px] px-1.5"
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll ? "Show fewer" : `Show all ${urls.length}`}
          </Button>
        )}
      </div>
      <ScrollArea className={showAll ? "h-[160px]" : "max-h-none"}>
        <ul className="space-y-1">
          {preview.map((u) => (
            <li key={u}>
              <a
                href={u}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-1.5 text-[11px] text-foreground/80 hover:text-foreground hover:underline truncate"
              >
                <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-60 group-hover:opacity-100" />
                <span className="truncate font-mono">{u}</span>
              </a>
            </li>
          ))}
        </ul>
      </ScrollArea>
    </div>
  );
}
