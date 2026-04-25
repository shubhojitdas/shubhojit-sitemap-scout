import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle, AlertCircle, Info, ChevronDown, CheckCircle2,
  Lightbulb, Wrench, ExternalLink, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { analyzeSeoIssues, type SeoIssue, type IssueSeverity } from "@/lib/seo-issues";
import type { CrawlResult } from "@/lib/crawl-api";

interface FieldFlags {
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
  includeSocialTags: boolean;
}

interface Props {
  results: CrawlResult[];
  flags: FieldFlags;
}

const SEV_META: Record<IssueSeverity, { label: string; icon: React.ComponentType<{ className?: string }>; tone: string; ring: string; bg: string }> = {
  critical: {
    label: "Critical",
    icon: AlertCircle,
    tone: "text-destructive",
    ring: "ring-destructive/30",
    bg: "bg-destructive/10",
  },
  warning: {
    label: "Warning",
    icon: AlertTriangle,
    tone: "text-warning",
    ring: "ring-warning/30",
    bg: "bg-warning/10",
  },
  info: {
    label: "Info",
    icon: Info,
    tone: "text-muted-foreground",
    ring: "ring-border",
    bg: "bg-muted/40",
  },
};

export function SeoIssuesView({ results, flags }: Props) {
  const issues = useMemo(() => analyzeSeoIssues(results, flags), [results, flags]);
  const [search, setSearch] = useState("");
  const [activeSev, setActiveSev] = useState<"all" | IssueSeverity>("all");

  const counts = useMemo(() => {
    const c = { critical: 0, warning: 0, info: 0 };
    for (const i of issues) c[i.severity]++;
    return c;
  }, [issues]);

  const filtered = issues.filter((i) => {
    if (activeSev !== "all" && i.severity !== activeSev) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!i.title.toLowerCase().includes(q) && !i.group.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  if (results.length === 0) {
    return (
      <div className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
        No crawl data yet — start a crawl to surface SEO issues.
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* ── Summary chips ─────────────────────────────────────────────── */}
      <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
        <SummaryChip
          label="All issues"
          value={issues.length}
          active={activeSev === "all"}
          onClick={() => setActiveSev("all")}
          icon={Lightbulb}
        />
        <SummaryChip
          label="Critical"
          value={counts.critical}
          active={activeSev === "critical"}
          onClick={() => setActiveSev("critical")}
          icon={AlertCircle}
          tone="text-destructive"
        />
        <SummaryChip
          label="Warnings"
          value={counts.warning}
          active={activeSev === "warning"}
          onClick={() => setActiveSev("warning")}
          icon={AlertTriangle}
          tone="text-warning"
        />
        <SummaryChip
          label="Info / opportunities"
          value={counts.info}
          active={activeSev === "info"}
          onClick={() => setActiveSev("info")}
          icon={Info}
        />
      </div>

      {/* ── Search ─────────────────────────────────────────────────────── */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter issues by name or category…"
          className="h-9 pl-8 text-xs"
        />
      </div>

      {/* ── Issue list ─────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center">
          <CheckCircle2 className="h-8 w-8 text-success mx-auto mb-2" />
          <p className="text-sm font-medium">
            {issues.length === 0
              ? "No SEO issues detected — great work!"
              : "No issues match your filters."}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {issues.length === 0
              ? "Every selected SEO field looks healthy across the crawled pages."
              : "Try clearing the search or switching severity."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((issue) => (
            <IssueCard key={issue.id} issue={issue} />
          ))}
        </div>
      )}
    </motion.div>
  );
}

function SummaryChip({
  label, value, active, onClick, icon: Icon, tone,
}: {
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  tone?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-lg border p-3 transition-all ${
        active
          ? "border-foreground/40 bg-card shadow-sm"
          : "border-border bg-card hover:border-foreground/20"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`h-3.5 w-3.5 ${tone ?? "text-muted-foreground"}`} />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="text-xl font-semibold tabular-nums">{value.toLocaleString()}</div>
    </button>
  );
}

function IssueCard({ issue }: { issue: SeoIssue }) {
  const [open, setOpen] = useState(false);
  const meta = SEV_META[issue.severity];
  const Icon = meta.icon;

  return (
    <div className={`rounded-lg border border-border bg-card overflow-hidden`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-3 p-3 sm:p-4 text-left hover:bg-muted/30 transition-colors"
      >
        <div className={`flex-shrink-0 h-8 w-8 rounded-md flex items-center justify-center ${meta.bg} ring-1 ${meta.ring}`}>
          <Icon className={`h-4 w-4 ${meta.tone}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal">
              {issue.group}
            </Badge>
            <Badge
              className={`text-[10px] h-4 px-1.5 font-normal ${meta.bg} ${meta.tone} border-transparent`}
            >
              {meta.label}
            </Badge>
          </div>
          <h4 className="text-sm font-medium leading-snug">{issue.title}</h4>
        </div>
        <ChevronDown
          className={`flex-shrink-0 h-4 w-4 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-border"
          >
            <div className="p-3 sm:p-4 space-y-3 bg-muted/20">
              <ExplainBlock
                icon={<Lightbulb className="h-3.5 w-3.5" />}
                title="Why this matters"
                body={issue.why}
              />
              <ExplainBlock
                icon={<Wrench className="h-3.5 w-3.5" />}
                title="How to fix"
                body={issue.fix}
              />
              <UrlList urls={issue.urls} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ExplainBlock({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-foreground/70 mb-1">
        {icon}
        {title}
      </div>
      <p className="text-xs leading-relaxed text-foreground/85">{body}</p>
    </div>
  );
}

function UrlList({ urls }: { urls: string[] }) {
  const [showAll, setShowAll] = useState(false);
  if (!urls.length) return null;
  const preview = showAll ? urls : urls.slice(0, 5);
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-foreground/70">
          Affected URLs ({urls.length})
        </div>
        {urls.length > 5 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px]"
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll ? "Show fewer" : `Show all ${urls.length}`}
          </Button>
        )}
      </div>
      <ScrollArea className={showAll ? "h-[200px]" : "max-h-none"}>
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
