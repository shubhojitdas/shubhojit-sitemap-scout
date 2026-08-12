import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle, AlertTriangle, Info, Printer, Gauge, ListChecks,
  ShieldCheck, ChevronDown, Download, Layers, Link2Off, CornerDownRight,
  FolderTree, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { buildAuditReport, type PrioritisedIssue } from "@/lib/audit-report";
import {
  computeClickDepth, findOrphanPages, analyseRedirectChains, buildDirectoryRollup,
} from "@/lib/audit-insights";
import {
  buildIssueUrlCsv, buildPageSummaryCsv, download, safeFileStem,
} from "@/lib/audit-export";
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

/* ── Section visibility ─────────────────────────────────────────────────── */

const SECTIONS = [
  { key: "categories", label: "Category scores" },
  { key: "priorities", label: "Fix these first" },
  { key: "responses", label: "Response codes" },
  { key: "indexability", label: "Indexability" },
  { key: "duplicates", label: "Duplicate clusters" },
  { key: "depth", label: "Crawl depth" },
  { key: "orphans", label: "Orphan pages" },
  { key: "redirects", label: "Redirect chains" },
  { key: "structure", label: "Site structure" },
  { key: "appendix", label: "URL appendix" },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

const ALL_ON = SECTIONS.reduce(
  (acc, s) => ({ ...acc, [s.key]: true }),
  {} as Record<SectionKey, boolean>
);

const CAP_OPTIONS = [10, 20, 50] as const;

export function AuditReport({ results, domain, flags, crawlCompletedAt, lastCrawledAt }: Props) {
  const report = useMemo(() => buildAuditReport(results, flags), [results, flags]);
  const depth = useMemo(() => computeClickDepth(results), [results]);
  const orphan = useMemo(() => findOrphanPages(results), [results]);
  const chains = useMemo(() => analyseRedirectChains(results), [results]);
  const directories = useMemo(() => buildDirectoryRollup(results, depth.depths), [results, depth]);

  const [preparedFor, setPreparedFor] = useState("");
  const [show, setShow] = useState<Record<SectionKey, boolean>>(ALL_ON);
  const [cap, setCap] = useState<number>(20);

  const dupTitles = useMemo(
    () => (flags.includeTitle ? findDuplicateGroups(results, "title").slice(0, 5) : []),
    [results, flags.includeTitle]
  );

  const crawlDate = crawlCompletedAt ?? lastCrawledAt ?? null;
  const hasLinks = flags.includeInternalLinks && orphan.hasLinkData;

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
    window.setTimeout(cleanup, 2000);
  };

  const stem = safeFileStem(domain);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-4"
    >
      {/* ── Report options (never printed) ───────────────────────────── */}
      <div className="no-print rounded-lg border border-border bg-card p-3 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-end gap-2">
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
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground block">
              URLs per issue in PDF
            </label>
            <div className="flex gap-1 mt-1">
              {CAP_OPTIONS.map((n) => (
                <Button
                  key={n}
                  size="sm"
                  variant={cap === n ? "default" : "outline"}
                  className="h-9 px-3 text-xs tabular-nums"
                  onClick={() => setCap(n)}
                >
                  {n}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handlePrint} className="h-9 gap-2 text-xs">
              <Printer className="h-3.5 w-3.5" />
              Download PDF
            </Button>
            <Button
              variant="outline"
              className="h-9 gap-2 text-xs"
              onClick={() => download(`${stem}-issues-by-url.csv`, buildIssueUrlCsv(report.issues, results))}
            >
              <Download className="h-3.5 w-3.5" />
              Issues CSV
            </Button>
            <Button
              variant="outline"
              className="h-9 gap-2 text-xs"
              onClick={() => download(`${stem}-pages.csv`, buildPageSummaryCsv(results))}
            >
              <FileText className="h-3.5 w-3.5" />
              Pages CSV
            </Button>
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
            Sections included in the PDF
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {SECTIONS.map((s) => (
              <label key={s.key} className="flex items-center gap-1.5 text-xs cursor-pointer">
                <Checkbox
                  checked={show[s.key]}
                  onCheckedChange={(v) => setShow((prev) => ({ ...prev, [s.key]: v === true }))}
                />
                {s.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* ── Printable report ──────────────────────────────────────────── */}
      <div data-print-root className="space-y-4">
        {/* Header */}
        <div data-atomic className="rounded-lg border border-border bg-card p-4 sm:p-5">
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
        {show.categories && (
          <Section icon={Gauge} title="Category health scores">
            <div className="grid gap-3 sm:grid-cols-2 mt-3">
              {report.categories.map((c) => (
                <div key={c.category} data-atomic>
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
          </Section>
        )}

        {/* Prioritised hints */}
        {show.priorities && (
          <Section icon={ListChecks} title="Fix these first">
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
                  <PriorityRow key={issue.id} rank={i + 1} issue={issue} cap={cap} />
                ))}
              </ol>
            )}
          </Section>
        )}

        {/* Summary tables */}
        {(show.responses || show.indexability) && (
          <div className="grid gap-4 sm:grid-cols-2">
            {show.responses && (
              <SummaryTable title="Response codes" rows={report.responseBreakdown} total={report.totalPages} />
            )}
            {show.indexability && (
              <SummaryTable title="Indexability" rows={report.indexability} total={report.totalPages} />
            )}
          </div>
        )}

        {/* Crawl depth */}
        {show.depth && (
          <Section icon={Layers} title="Crawl depth (clicks from homepage)">
            {!hasLinks ? (
              <NoLinkData />
            ) : (
              <>
                <p className="text-xs text-muted-foreground mt-1">
                  Measured from {depth.rootUrl ?? "the shallowest crawled URL"} · average depth{" "}
                  <span className="tabular-nums font-medium text-foreground">{depth.averageDepth}</span> ·
                  deepest <span className="tabular-nums font-medium text-foreground">{depth.maxDepth}</span>
                </p>
                <table className="w-full mt-2 text-xs">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="py-1 font-medium">Depth</th>
                      <th className="py-1 font-medium">Pages</th>
                      <th className="py-1 font-medium w-1/2">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {depth.distribution.map((d) => (
                      <tr key={d.depth} data-atomic className="border-t border-border/60">
                        <td className="py-1.5 tabular-nums">
                          {d.depth === 0 ? "0 (home)" : d.depth}
                        </td>
                        <td className="py-1.5 tabular-nums">{d.count.toLocaleString()}</td>
                        <td className="py-1.5">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden print:hidden">
                              <div
                                className={`h-full rounded-full ${d.depth > 3 ? "bg-warning" : "bg-primary"}`}
                                style={{ width: `${(d.count / Math.max(1, results.length)) * 100}%` }}
                              />
                            </div>
                            <span className="tabular-nums text-muted-foreground">
                              {Math.round((d.count / Math.max(1, results.length)) * 100)}%
                            </span>
                          </div>
                        </td>

                      </tr>
                    ))}
                  </tbody>
                </table>
                {depth.deepPages.length > 0 && (
                  <UrlList
                    label={`${depth.deepPages.length} page${depth.deepPages.length === 1 ? "" : "s"} deeper than 3 clicks`}
                    urls={depth.deepPages.map((p) => `${p.url} — depth ${p.depth}`)}
                    cap={cap}
                  />
                )}
                {depth.unreachable.length > 0 && (
                  <UrlList
                    label={`${depth.unreachable.length} crawled page${depth.unreachable.length === 1 ? "" : "s"} not reachable via internal links`}
                    urls={depth.unreachable}
                    cap={cap}
                  />
                )}
              </>
            )}
          </Section>
        )}

        {/* Orphans */}
        {show.orphans && (
          <Section icon={Link2Off} title="Orphan & thinly linked pages">
            {!hasLinks ? (
              <NoLinkData />
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3 mt-2 text-xs">
                  <Stat label="Orphans (0 inbound)" value={orphan.orphans.length} tone="text-destructive" />
                  <Stat label="Indexable orphans" value={orphan.criticalOrphans.length} tone="text-destructive" />
                  <Stat label="1–2 inbound links" value={orphan.lowLink.length} tone="text-warning" />
                </div>
                {orphan.criticalOrphans.length > 0 && (
                  <UrlList label="Indexable orphans — highest value fix" urls={orphan.criticalOrphans} cap={cap} />
                )}
                {orphan.lowLink.length > 0 && (
                  <UrlList
                    label="Thinly linked pages"
                    urls={orphan.lowLink.map((p) => `${p.url} — ${p.inbound} inbound`)}
                    cap={cap}
                  />
                )}
              </>
            )}
          </Section>
        )}

        {/* Redirect chains */}
        {show.redirects && (
          <Section icon={CornerDownRight} title="Redirect chains & loops">
            {chains.rows.length === 0 ? (
              <p className="text-xs text-muted-foreground mt-2">
                No redirects were detected in this crawl.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-3 mt-2 text-xs">
                  <Stat label="Redirecting URLs" value={chains.rows.length} tone="text-warning" />
                  <Stat label="2+ hop chains" value={chains.longChains.length} tone="text-warning" />
                  <Stat label="Loops" value={chains.loops.length} tone="text-destructive" />
                  <Stat label="Links to redirects" value={chains.linksToRedirects.length} tone="text-muted-foreground" />
                </div>
                <ul className="mt-3 space-y-2">
                  {chains.rows.slice(0, cap).map((row) => (
                    <li key={row.url} data-atomic className="text-[11px] border-t border-border/60 pt-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium break-all">{row.url}</span>
                        {row.loop && (
                          <Badge variant="outline" className="h-4 px-1.5 text-[10px] text-destructive">
                            loop
                          </Badge>
                        )}
                        {row.endsInError && (
                          <Badge variant="outline" className="h-4 px-1.5 text-[10px] text-destructive">
                            ends {row.finalStatus}
                          </Badge>
                        )}
                        <span className="text-muted-foreground ml-auto tabular-nums">
                          {row.hopCount} hop{row.hopCount === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="text-muted-foreground mt-0.5 break-all">
                        {row.hops.map((h, i) => (
                          <span key={`${h.url}-${i}`}>
                            {i > 0 && " → "}
                            <span className="tabular-nums">{h.status}</span> {h.url}
                          </span>
                        ))}
                        {" → "}
                        <span className="tabular-nums">{row.finalStatus}</span> {row.finalUrl}
                      </div>
                    </li>
                  ))}
                </ul>
                {chains.rows.length > cap && (
                  <p className="text-[10px] text-muted-foreground mt-2">
                    +{(chains.rows.length - cap).toLocaleString()} more redirecting URLs — see the Pages CSV export.
                  </p>
                )}
              </>
            )}
          </Section>
        )}

        {/* Site structure */}
        {show.structure && (
          <Section icon={FolderTree} title="Site structure by directory">
            <table className="w-full mt-2 text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 font-medium">Section</th>
                  <th className="py-1 font-medium text-right">URLs</th>
                  <th className="py-1 font-medium text-right">2xx</th>
                  <th className="py-1 font-medium text-right">3xx</th>
                  <th className="py-1 font-medium text-right">4xx/5xx</th>
                  <th className="py-1 font-medium text-right">Noindex</th>
                  <th className="py-1 font-medium text-right">No title</th>
                  <th className="py-1 font-medium text-right">Avg depth</th>
                </tr>
              </thead>
              <tbody>
                {directories.map((d) => (
                  <tr key={d.segment} data-atomic className="border-t border-border/60">
                    <td className="py-1.5 font-medium break-all">{d.segment}</td>
                    <td className="py-1.5 text-right tabular-nums">{d.urls.toLocaleString()}</td>
                    <td className="py-1.5 text-right tabular-nums">{d.ok}</td>
                    <td className="py-1.5 text-right tabular-nums">{d.redirects}</td>
                    <td className={`py-1.5 text-right tabular-nums ${d.errors ? "text-destructive" : ""}`}>
                      {d.errors}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{d.noindex}</td>
                    <td className="py-1.5 text-right tabular-nums">{d.missingTitle}</td>
                    <td className="py-1.5 text-right tabular-nums">{d.avgDepth ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {/* Duplicates */}
        {show.duplicates && dupTitles.length > 0 && (
          <Section icon={AlertTriangle} title="Top duplicate title clusters">
            <ul className="mt-3 space-y-2">
              {dupTitles.map((g) => (
                <li key={`${g.kind}-${g.value}`} data-atomic className="text-xs">
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
          </Section>
        )}

        {/* URL appendix */}
        {show.appendix && report.issues.length > 0 && (
          <Section icon={FileText} title="Appendix — affected URLs by issue">
            <p className="text-xs text-muted-foreground mt-1">
              Up to {cap} URLs shown per issue. Export the Issues CSV for the complete, uncapped list.
            </p>
            <div className="mt-3 space-y-3">
              {report.issues.map((issue) => (
                <div key={issue.id} data-atomic className="border-t border-border/60 pt-2">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-normal">
                      {issue.category}
                    </Badge>
                    <span className={`text-[10px] uppercase ${SEV_TONE[issue.severity]}`}>
                      {issue.severity}
                    </span>
                    <span className="font-medium">{issue.title}</span>
                  </div>
                  <ul className="mt-1 space-y-0.5">
                    {issue.urls.slice(0, cap).map((u) => (
                      <li key={u} className="text-[10px] text-muted-foreground break-all">{u}</li>
                    ))}
                  </ul>
                  {issue.urls.length > cap && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      +{(issue.urls.length - cap).toLocaleString()} more URLs — see the Issues CSV export.
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        <p className="text-[10px] text-muted-foreground text-center">
          Generated by SEO Sitemap Scout · scores are derived from the fields included in this crawl.
        </p>
      </div>
    </motion.div>
  );
}

/* ── Building blocks ───────────────────────────────────────────────────── */

function scoreBarClass(score: number): string {
  if (score >= 90) return "bg-success";
  if (score >= 75) return "bg-primary";
  if (score >= 50) return "bg-warning";
  return "bg-destructive";
}

function Section({
  icon: Icon, title, children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2" data-keep-with-next>
        <Icon className="h-3.5 w-3.5 text-primary" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div data-atomic className="rounded-md border border-border/60 p-2">
      <div className={`text-base font-semibold tabular-nums ${tone}`}>{value.toLocaleString()}</div>
      <div className="text-[10px] text-muted-foreground leading-tight">{label}</div>
    </div>
  );
}

function NoLinkData() {
  return (
    <p className="text-xs text-muted-foreground mt-2">
      Enable “Internal links” in crawl settings to generate this report.
    </p>
  );
}

function UrlList({ label, urls, cap }: { label: string; urls: string[]; cap: number }) {
  const [open, setOpen] = useState(false);
  const shown = open ? urls : urls.slice(0, cap);
  const extra = urls.length - cap;
  return (
    <div className="mt-3" data-atomic>
      <div className="text-xs font-medium">{label}</div>
      {/* Screen: expandable */}
      <ul className="mt-1 space-y-0.5 print:hidden">
        {shown.map((u) => (
          <li key={u} className="text-[10px] text-muted-foreground break-all">{u}</li>
        ))}
      </ul>
      {/* Print: always capped */}
      <ul className="hidden print:block mt-1 space-y-0.5">
        {urls.slice(0, cap).map((u) => (
          <li key={u} className="text-[10px] text-muted-foreground break-all">{u}</li>
        ))}
      </ul>
      {extra > 0 && (
        <>
          <button
            onClick={() => setOpen((v) => !v)}
            className="no-print text-[10px] text-primary hover:underline mt-1"
          >
            {open ? "Show fewer" : `Show all ${urls.length.toLocaleString()}`}
          </button>
          <p className="hidden print:block text-[10px] text-muted-foreground mt-1">
            +{extra.toLocaleString()} more URLs — see the CSV export.
          </p>
        </>
      )}
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

function PriorityRow({ rank, issue, cap }: { rank: number; issue: PrioritisedIssue; cap: number }) {
  const [open, setOpen] = useState(rank <= 3);
  const [urlsOpen, setUrlsOpen] = useState(false);
  const Icon = SEV_ICON[issue.severity];
  const shown = urlsOpen ? issue.urls : issue.urls.slice(0, cap);

  return (
    <li data-atomic className="rounded-md border border-border bg-background/40 overflow-hidden">
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
          {issue.urls.length > 0 && (
            <div>
              <div className="font-semibold">Affected URLs</div>
              <ul className="mt-1 space-y-0.5 print:hidden">
                {shown.map((u) => (
                  <li key={u} className="text-[10px] text-muted-foreground break-all">{u}</li>
                ))}
              </ul>
              <ul className="hidden print:block mt-1 space-y-0.5">
                {issue.urls.slice(0, cap).map((u) => (
                  <li key={u} className="text-[10px] text-muted-foreground break-all">{u}</li>
                ))}
              </ul>
              {issue.urls.length > cap && (
                <>
                  <button
                    onClick={() => setUrlsOpen((v) => !v)}
                    className="no-print text-[10px] text-primary hover:underline mt-1"
                  >
                    {urlsOpen ? "Show fewer" : `Show all ${issue.urls.length.toLocaleString()}`}
                  </button>
                  <p className="hidden print:block text-[10px] text-muted-foreground mt-1">
                    +{(issue.urls.length - cap).toLocaleString()} more URLs — see the Issues CSV export.
                  </p>
                </>
              )}
            </div>
          )}
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
      <h3 className="text-sm font-semibold" data-keep-with-next>{title}</h3>
      <table className="w-full mt-2 text-xs">
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} data-atomic className="border-t border-border/60">
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
