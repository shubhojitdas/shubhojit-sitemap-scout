import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle, AlertTriangle, Info, Printer, Gauge, ListChecks,
  ShieldCheck, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { buildAuditReport, type PrioritisedIssue } from "@/lib/audit-report";
import { findDuplicateGroups } from "@/lib/duplicates";
import type { FieldFlags } from "@/lib/seo-issues";
import type { CrawlResult } from "@/lib/crawl-api";

interface Props {
  results: CrawlResult[];
  domain: string;
  flags: FieldFlags;
  crawlCompletedAt?: string | null;
  lastCrawledAt?: string | null;
}

const SEV_ICON = {
  critical: AlertCircle,
  warning: AlertTriangle,
  info: Info,
} as const;

const SEV_TONE = {
  critical: "text-destructive",
  warning: "text-warning",
  info: "text-muted-foreground",
} as const;

function toneForScore(score: number): string {
  if (score >= 90) return "text-success";
  if (score >= 75) return "text-primary";
  if (score >= 50) return "text-warning";
  return "text-destructive";
}

export function AuditReport({ results, domain, flags, crawlCompletedAt, lastCrawledAt }: Props) {
  const report = useMemo(() => buildAuditReport(results, flags), [results, flags]);
  const [preparedFor, setPreparedFor] = useState("");

  const dupTitles = useMemo(
    () => (flags.includeTitle ? findDuplicateGroups(results, "title").slice(0, 5) : []),
    [results, flags.includeTitle]
  );

  const crawlDate = crawlCompletedAt ?? lastCrawledAt ?? null;

  if (results.length === 0) {
    return (
      <div className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
        No crawl data yet — run a crawl to generate an audit report.
      </div>
    );
  }

  const handlePrint = () => {
    document.body.classList.add("print-report");
    const cleanup = () => {
      document.body.classList.remove("print-report");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
    // Safety net for browsers that don't fire afterprint reliably.
    window.setTimeout(cleanup, 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-4"
    >
      {/* ── Report controls (never printed) ───────────────────────────── */}
      <div className="no-print flex flex-col sm:flex-row sm:items-end gap-2 rounded-lg border border-border bg-card p-3">
        <div className="flex-1 min-w-0">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Prepared for (optional)
          </label>
          <Input
            value={preparedFor}
            onChange={(e) => setPreparedFor(e.target.value)}
            placeholder="Client or team name — printed on the report header"
            className="h-9 text-xs mt-1"
          />
        </div>
        <Button onClick={handlePrint} className="h-9 gap-2 text-xs">
          <Printer className="h-3.5 w-3.5" />
          Download PDF
        </Button>
      </div>

      {/* ── Printable report ──────────────────────────────────────────── */}
      <div data-print-root className="space-y-4">
        {/* Header */}
        <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Technical SEO Audit Report
              </div>
              <h2 className="text-xl font-semibold tracking-tight mt-1 truncate">
                {domain || "Crawled URLs"}
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                {report.totalPages.toLocaleString()} URLs analysed
                {crawlDate ? ` · crawled ${new Date(crawlDate).toLocaleString()}` : ""}
              </p>
              {preparedFor.trim() && (
                <p className="text-xs mt-1">
                  Prepared for <span className="font-medium">{preparedFor.trim()}</span>
                </p>
              )}
            </div>

            <div className="flex items-center gap-4">
              <ScoreDial score={report.overallScore} />
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Health grade
                </div>
                <div className={`text-lg font-semibold ${toneForScore(report.overallScore)}`}>
                  {report.grade}
                </div>
                <div className="flex gap-2 mt-1.5 text-[11px]">
                  <span className="text-destructive">{report.counts.critical} critical</span>
                  <span className="text-warning">{report.counts.warning} warnings</span>
                  <span className="text-muted-foreground">{report.counts.info} info</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Category scores */}
        <section className="rounded-lg border border-border bg-card p-4">
          <SectionTitle icon={Gauge} title="Category health scores" />
          <div className="grid gap-3 sm:grid-cols-2 mt-3">
            {report.categories.map((c) => (
              <div key={c.category}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium">{c.category}</span>
                  {c.notAudited ? (
                    <span className="text-[10px] text-muted-foreground">Not crawled</span>
                  ) : (
                    <span className={`tabular-nums font-semibold ${toneForScore(c.score)}`}>
                      {c.score}
                    </span>
                  )}
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      c.notAudited ? "bg-muted-foreground/25" : scoreBarClass(c.score)
                    }`}
                    style={{
                      width: `${c.notAudited ? 0 : c.score}%`,
                      transition: "width 700ms cubic-bezier(0.22, 1, 0.36, 1)",
                    }}
                  />
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  {c.notAudited
                    ? "Enable this field in crawl settings to score it."
                    : `${c.issueCount} issue${c.issueCount === 1 ? "" : "s"}${
                        c.criticalCount ? ` · ${c.criticalCount} critical` : ""
                      }`}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Prioritised hints */}
        <section className="rounded-lg border border-border bg-card p-4">
          <SectionTitle icon={ListChecks} title="Fix these first" />
          <p className="text-xs text-muted-foreground mt-1">
            Ranked by severity and how much of the site each problem touches.
          </p>
          {report.topPriorities.length === 0 ? (
            <div className="flex items-center gap-2 text-sm mt-3">
              <ShieldCheck className="h-4 w-4 text-success" />
              No issues detected across the crawled fields.
            </div>
          ) : (
            <ol className="mt-3 space-y-2">
              {report.topPriorities.map((issue, i) => (
                <PriorityRow key={issue.id} rank={i + 1} issue={issue} />
              ))}
            </ol>
          )}
        </section>

        {/* Summary tables */}
        <div className="grid gap-4 sm:grid-cols-2">
          <SummaryTable title="Response codes" rows={report.responseBreakdown} total={report.totalPages} />
          <SummaryTable title="Indexability" rows={report.indexability} total={report.totalPages} />
        </div>

        {dupTitles.length > 0 && (
          <section className="rounded-lg border border-border bg-card p-4">
            <SectionTitle icon={AlertTriangle} title="Top duplicate title clusters" />
            <ul className="mt-3 space-y-2">
              {dupTitles.map((g) => (
                <li key={`${g.kind}-${g.value}`} className="text-xs">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-normal">
                      {g.kind === "exact" ? "Exact" : "Near"}
                    </Badge>
                    <span className="font-medium truncate">{g.value || "(empty)"}</span>
                    <span className="text-muted-foreground tabular-nums ml-auto">
                      {g.urls.length} pages
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="text-[10px] text-muted-foreground text-center">
          Generated by SEO Sitemap Scout · scores are derived from the fields included in this crawl.
        </p>
      </div>
    </motion.div>
  );
}

function scoreBarClass(score: number): string {
  if (score >= 90) return "bg-success";
  if (score >= 75) return "bg-primary";
  if (score >= 50) return "bg-warning";
  return "bg-destructive";
}

function SectionTitle({
  icon: Icon, title,
}: { icon: React.ComponentType<{ className?: string }>; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-primary" />
      <h3 className="text-sm font-semibold">{title}</h3>
    </div>
  );
}

function ScoreDial({ score }: { score: number }) {
  const r = 26;
  const circumference = 2 * Math.PI * r;
  const dash = (score / 100) * circumference;
  return (
    <div className="relative h-[68px] w-[68px] flex-shrink-0">
      <svg viewBox="0 0 68 68" className="h-full w-full -rotate-90">
        <circle cx="34" cy="34" r={r} fill="none" strokeWidth="6" className="stroke-muted" />
        <circle
          cx="34" cy="34" r={r} fill="none" strokeWidth="6" strokeLinecap="round"
          className={`${toneForScore(score)} stroke-current`}
          strokeDasharray={`${dash} ${circumference - dash}`}
          style={{ transition: "stroke-dasharray 900ms cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-lg font-semibold tabular-nums ${toneForScore(score)}`}>{score}</span>
      </div>
    </div>
  );
}

function PriorityRow({ rank, issue }: { rank: number; issue: PrioritisedIssue }) {
  const [open, setOpen] = useState(rank <= 3);
  const Icon = SEV_ICON[issue.severity];
  return (
    <li className="rounded-md border border-border bg-background/40 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-3 p-3 text-left hover:bg-muted/30 transition-colors"
      >
        <span className="text-[11px] font-semibold tabular-nums text-muted-foreground w-4 pt-0.5">
          {rank}
        </span>
        <Icon className={`h-4 w-4 flex-shrink-0 mt-0.5 ${SEV_TONE[issue.severity]}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-normal">
              {issue.category}
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              impact {issue.priority}/100 · {issue.count.toLocaleString()} page
              {issue.count === 1 ? "" : "s"} ({Math.round(issue.share * 100)}%)
            </span>
          </div>
          <h4 className="text-sm font-medium leading-snug">{issue.title}</h4>
        </div>
        <ChevronDown
          className={`no-print h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      <div className={open ? "block" : "hidden print:block"}>
        <div className="px-3 pb-3 pl-[52px] space-y-2 text-xs">
          <p className="text-foreground/85 leading-relaxed">
            <span className="font-semibold">Why it matters: </span>
            {issue.why}
          </p>
          <p className="text-foreground/85 leading-relaxed">
            <span className="font-semibold">How to fix: </span>
            {issue.fix}
          </p>
        </div>
      </div>
    </li>
  );
}

function SummaryTable({
  title, rows, total,
}: { title: string; rows: { label: string; count: number }[]; total: number }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <table className="w-full mt-2 text-xs">
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-border/60">
              <td className="py-1.5">{r.label}</td>
              <td className="py-1.5 text-right tabular-nums font-medium">
                {r.count.toLocaleString()}
              </td>
              <td className="py-1.5 text-right tabular-nums text-muted-foreground w-14">
                {total > 0 ? `${Math.round((r.count / total) * 100)}%` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
