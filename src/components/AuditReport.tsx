import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Printer, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

/* ── Tone helpers (report palette) ─────────────────────────────────────── */

function toneForScore(score: number): "good" | "lime" | "warn" | "crit" {
  if (score >= 90) return "good";
  if (score >= 75) return "lime";
  if (score >= 50) return "warn";
  return "crit";
}

const SEV_TAG = { critical: "crit", warning: "warn", info: "info" } as const;

/* ── Section visibility ─────────────────────────────────────────────────── */

const SECTIONS = [
  { key: "summary", label: "Executive summary" },
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
    () => (flags.includeTitle ? findDuplicateGroups(results, "title").slice(0, 6) : []),
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
  const dateLabel = crawlDate
    ? new Date(crawlDate).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })
    : "—";

  /* Running section counter so numbering stays contiguous when toggled off. */
  let n = 0;
  const num = () => String(++n).padStart(2, "0");

  const errorPages = report.responseBreakdown
    .filter((r) => /4xx|5xx|error/i.test(r.label))
    .reduce((a, r) => a + r.count, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-4"
    >
      {/* ── Report options (never printed) ───────────────────────────── */}
      <div className="no-print rounded-lg border border-border bg-card p-3 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-end gap-3">
          <div className="flex-1 min-w-0">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Prepared for (optional)
            </label>
            <Input
              value={preparedFor}
              onChange={(e) => setPreparedFor(e.target.value)}
              placeholder="Client or team name — printed on the report cover"
              className="h-9 text-xs mt-1"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground block">
              URLs per issue in PDF
            </label>
            <div className="flex gap-1 mt-1">
              {CAP_OPTIONS.map((c) => (
                <Button
                  key={c}
                  size="sm"
                  variant={cap === c ? "default" : "outline"}
                  className="h-9 px-3 text-xs tabular-nums"
                  onClick={() => setCap(c)}
                >
                  {c}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handlePrint} className="h-9 gap-2 text-xs">
              <Printer className="h-3.5 w-3.5" />
              Download PDF (A4)
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
            Sections included in the report
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

      {/* ── The document ─────────────────────────────────────────────── */}
      <div data-print-root data-report-root>
        {/* Masthead */}
        <header className="rpt-masthead" data-atomic>
          <div className="rpt-page relative z-10">
            <div className="rpt-eyebrow rpt-mono">Technical SEO Audit · Client Briefing</div>
            <h2 className="rpt-title rpt-serif">
              {domain || "Crawled URLs"}
              <br />
              <em>Site Health &amp; Visibility Review</em>
            </h2>
            <div className="rpt-meta">
              <div>
                <div className="k rpt-mono">Prepared for</div>
                <div className="v">{preparedFor.trim() || "—"}</div>
              </div>
              <div>
                <div className="k rpt-mono">Crawl date</div>
                <div className="v">{dateLabel}</div>
              </div>
              <div>
                <div className="k rpt-mono">Pages analysed</div>
                <div className="v">{report.totalPages.toLocaleString()} URLs</div>
              </div>
              <div>
                <div className="k rpt-mono">Prepared by</div>
                <div className="v">Sitemap Scout</div>
              </div>
            </div>
          </div>
        </header>

        {/* Grade band */}
        <div className="rpt-band" data-atomic>
          <div className="rpt-page rpt-band-inner">
            <ScoreDial score={report.overallScore} grade={report.grade} />
            <div className="rpt-sevs">
              <Sev tone="crit" count={report.counts.critical} label="Critical" />
              <Sev tone="warn" count={report.counts.warning} label="Warnings" />
              <Sev tone="info" count={report.counts.info} label="Informational" />
            </div>
          </div>
        </div>

        <div className="rpt-page">
          {/* Executive summary */}
          {show.summary && (
            <Section num={num()} title="Executive Summary">
              <div className="rpt-two grid gap-6 mt-5 lg:grid-cols-[1.25fr_1fr]">
                <div>
                  <p className="text-[15px] sm:text-base leading-relaxed">
                    Across{" "}
                    <strong className="font-semibold">{report.totalPages.toLocaleString()} crawled URLs</strong>,
                    this site scores{" "}
                    <strong className="font-semibold">{report.overallScore}/100</strong> ({report.grade}) with{" "}
                    <strong className="font-semibold">{report.counts.critical} critical</strong> and{" "}
                    {report.counts.warning} warning-level findings. The weakest areas are{" "}
                    {report.categories
                      .filter((c) => !c.notAudited)
                      .slice(-2)
                      .map((c) => c.category)
                      .join(" and ") || "not determined"}
                    .
                  </p>
                  <div
                    className="mt-5 p-4 sm:p-5"
                    style={{
                      background: "hsl(var(--rpt-raised))",
                      border: "1px solid hsl(var(--rpt-line))",
                      borderLeft: "3px solid hsl(var(--rpt-lime))",
                    }}
                    data-atomic
                  >
                    <div className="rpt-h">How to read this report</div>
                    <p className="text-sm rpt-soft">
                      Findings are ranked by severity and by how much of the site each one touches, so the
                      first items in “Priority Remediation” are the highest-leverage work. Category scores
                      only reflect the fields included in this crawl — anything not crawled is marked as
                      such rather than scored.
                    </p>
                  </div>
                </div>
                <div style={{ background: "hsl(var(--rpt-raised))", border: "1px solid hsl(var(--rpt-line))" }}>
                  <StatRow k="Total issues detected" v={report.issues.length} />
                  <StatRow k="Critical findings" v={report.counts.critical} tone="crit" />
                  <StatRow k="4xx / 5xx responses" v={errorPages} tone={errorPages ? "crit" : "good"} />
                  {hasLinks && <StatRow k="Orphaned pages" v={orphan.orphans.length} tone="warn" />}
                  <StatRow k="Redirecting URLs" v={chains.rows.length} tone={chains.rows.length ? "warn" : "good"} />
                </div>
              </div>
            </Section>
          )}

          {/* Category scores */}
          {show.categories && (
            <Section num={num()} title="Category Health Scores">
              <p className="rpt-sub">
                Each score weights the issues found in that category by the share of pages affected.
              </p>
              <div className="rpt-hair mt-5">
                {report.categories.map((c) => {
                  const tone = toneForScore(c.score);
                  return (
                    <div key={c.category} className="rpt-cell" data-atomic>
                      <div className="rpt-cat rpt-mono">{c.category}</div>
                      <div className="flex items-baseline gap-1.5 mt-3 mb-3">
                        <span className={`rpt-score rpt-serif ${c.notAudited ? "rpt-soft" : `t-${tone}`}`}>
                          {c.notAudited ? "—" : c.score}
                        </span>
                        {!c.notAudited && <span className="rpt-score-max">/100</span>}
                      </div>
                      <div className="rpt-meter print:hidden">
                        <i
                          className={c.notAudited ? "f-mute" : `f-${tone}`}
                          style={{ width: `${c.notAudited ? 0 : c.score}%` }}
                        />
                      </div>
                      <div className="text-xs rpt-soft mt-2.5">
                        {c.notAudited
                          ? "Not crawled — enable this field in crawl settings."
                          : `${c.issueCount} issue${c.issueCount === 1 ? "" : "s"}${
                              c.criticalCount ? ` · ${c.criticalCount} critical` : ""
                            }`}
                      </div>
                    </div>
                  );
                })}
                <div
                  className="rpt-cell flex items-center justify-center no-print"
                  style={{ background: "hsl(var(--rpt-paper))" }}
                >
                  <p className="text-xs rpt-soft text-center">
                    Scores reflect field coverage weighted by pages affected, per the crawl of {dateLabel}.
                  </p>
                </div>
              </div>
            </Section>
          )}

          {/* Priority remediation */}
          {show.priorities && (
            <Section num={num()} title="Priority Remediation">
              <p className="rpt-sub">
                Ranked by severity and breadth of impact across the crawled site.
              </p>
              {report.topPriorities.length === 0 ? (
                <p className="mt-4 text-sm t-good">
                  No issues detected across the crawled fields.
                </p>
              ) : (
                <div className="mt-5">
                  {report.topPriorities.map((issue, i) => (
                    <FixItem key={issue.id} rank={i + 1} issue={issue} cap={cap} />
                  ))}
                </div>
              )}
            </Section>
          )}

          {/* Response codes / indexability */}
          {(show.responses || show.indexability) && (
            <Section num={num()} title="Crawl Response & Indexability">
              <div className="grid gap-8 mt-5 md:grid-cols-2">
                {show.responses && (
                  <MiniTable title="Response codes" rows={report.responseBreakdown} total={report.totalPages} />
                )}
                {show.indexability && (
                  <MiniTable title="Indexability" rows={report.indexability} total={report.totalPages} />
                )}
              </div>
            </Section>
          )}

          {/* Crawl depth */}
          {show.depth && (
            <Section num={num()} title="Crawl Depth">
              {!hasLinks ? (
                <NoLinkData />
              ) : (
                <>
                  <p className="rpt-sub">
                    Clicks from {depth.rootUrl ?? "the shallowest crawled URL"} · average depth{" "}
                    {depth.averageDepth} · deepest {depth.maxDepth}.
                  </p>
                  <div className="rpt-scroll mt-5">
                    <table className="rpt-table">
                      <thead>
                        <tr>
                          <th>Depth</th>
                          <th className="num">Pages</th>
                          <th className="num">Share</th>
                        </tr>
                      </thead>
                      <tbody>
                        {depth.distribution.map((d) => {
                          const pct = Math.round((d.count / Math.max(1, results.length)) * 100);
                          return (
                            <tr key={d.depth}>
                              <td className="rpt-mono">
                                <span className={`rpt-dot ${d.depth > 3 ? "f-warn" : "f-lime"}`} />
                                {d.depth === 0 ? "0 — homepage" : `${d.depth} click${d.depth === 1 ? "" : "s"}`}
                              </td>
                              <td className="num rpt-serif" style={{ fontSize: 16 }}>
                                {d.count.toLocaleString()}
                              </td>
                              <td className="num rpt-soft">{pct}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
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
            <Section num={num()} title="Orphan & Thinly Linked Pages">
              {!hasLinks ? (
                <NoLinkData />
              ) : (
                <>
                  <div className="rpt-hair cols3 mt-5">
                    <Callout n={orphan.orphans.length} label="Orphans (0 inbound links)" tone="crit" />
                    <Callout n={orphan.criticalOrphans.length} label="Indexable orphans" tone="crit" />
                    <Callout n={orphan.lowLink.length} label="Only 1–2 inbound links" tone="warn" />
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
            <Section num={num()} title="Redirect Chains & Loops">
              {chains.rows.length === 0 ? (
                <p className="rpt-sub">No redirects were detected in this crawl.</p>
              ) : (
                <>
                  <div className="rpt-hair mt-5">
                    <Callout n={chains.rows.length} label="Redirecting URLs" tone="warn" />
                    <Callout n={chains.longChains.length} label="Chains of 2+ hops" tone="warn" />
                    <Callout n={chains.loops.length} label="Loops" tone="crit" />
                    <Callout n={chains.linksToRedirects.length} label="Internal links to redirects" tone="info" />
                  </div>
                  <div className="mt-5">
                    {chains.rows.slice(0, cap).map((row) => (
                      <div
                        key={row.url}
                        data-atomic
                        className="py-3"
                        style={{ borderTop: "1px solid hsl(var(--rpt-line-soft))" }}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="rpt-mono text-xs break-all font-medium">{row.url}</span>
                          {row.loop && <span className="rpt-tag crit">loop</span>}
                          {row.endsInError && <span className="rpt-tag crit">ends {row.finalStatus}</span>}
                          <span className="rpt-mono text-[11px] rpt-soft ml-auto">
                            {row.hopCount} hop{row.hopCount === 1 ? "" : "s"}
                          </span>
                        </div>
                        <div className="rpt-mono text-[11px] rpt-soft mt-1 break-all">
                          {row.hops.map((h, i) => (
                            <span key={`${h.url}-${i}`}>
                              {i > 0 && " → "}
                              {h.status} {h.url}
                            </span>
                          ))}
                          {" → "}
                          {row.finalStatus} {row.finalUrl}
                        </div>
                      </div>
                    ))}
                  </div>
                  {chains.rows.length > cap && (
                    <p className="rpt-note-inline">
                      +{(chains.rows.length - cap).toLocaleString()} more redirecting URLs in the Pages CSV export.
                    </p>
                  )}
                </>
              )}
            </Section>
          )}

          {/* Site structure */}
          {show.structure && (
            <Section num={num()} title="Site Structure by Directory">
              <p className="rpt-sub">Where the problems concentrate, rolled up by first path segment.</p>
              <div className="rpt-scroll mt-5">
                <table className="rpt-table">
                  <thead>
                    <tr>
                      <th>Section</th>
                      <th className="num">URLs</th>
                      <th className="num">2xx</th>
                      <th className="num">3xx</th>
                      <th className="num">4xx/5xx</th>
                      <th className="num">Noindex</th>
                      <th className="num">No title</th>
                      <th className="num">Avg depth</th>
                    </tr>
                  </thead>
                  <tbody>
                    {directories.map((d) => (
                      <tr key={d.segment}>
                        <td className="rpt-mono break-all">{d.segment}</td>
                        <td className="num">{d.urls.toLocaleString()}</td>
                        <td className="num">{d.ok}</td>
                        <td className="num">{d.redirects}</td>
                        <td className={`num ${d.errors ? "t-crit font-semibold" : ""}`}>{d.errors}</td>
                        <td className="num">{d.noindex}</td>
                        <td className="num">{d.missingTitle}</td>
                        <td className="num">{d.avgDepth ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* Duplicates */}
          {show.duplicates && dupTitles.length > 0 && (
            <Section num={num()} title="Duplicate Title Clusters">
              <p className="rpt-sub">
                Pages competing with each other for the same snippet and keyword intent.
              </p>
              <div className="rpt-scroll mt-5">
                <table className="rpt-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Title</th>
                      <th className="num">Pages</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dupTitles.map((g) => (
                      <tr key={`${g.kind}-${g.value}`}>
                        <td>
                          <span className={`rpt-tag ${g.kind === "exact" ? "crit" : "warn"}`}>
                            {g.kind === "exact" ? "Exact" : "Near"}
                          </span>
                        </td>
                        <td className="break-words">{g.value || "(empty)"}</td>
                        <td className="num">{g.urls.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* URL appendix */}
          {show.appendix && report.issues.length > 0 && (
            <Section num={num()} title="Appendix — Affected URLs by Issue">
              <p className="rpt-sub">Up to {cap} URLs per issue; the full list lives in the CSV exports.</p>
              <div className="mt-5 space-y-5">
                {report.issues.map((issue) => (
                  <div key={issue.id} data-atomic>
                    <div className="flex items-center gap-2 flex-wrap" data-keep-with-next>
                      <span className={`rpt-tag ${SEV_TAG[issue.severity]}`}>{issue.severity}</span>
                      <span className="rpt-tag cat">{issue.category}</span>
                      <span className="rpt-app-title text-sm font-medium">{issue.title}</span>
                      <span className="rpt-mono text-[11px] rpt-soft ml-auto">
                        {issue.urls.length.toLocaleString()} URLs
                      </span>
                    </div>
                    <ul className="rpt-urls mt-2 print:hidden">
                      {issue.urls.slice(0, cap).map((u) => (
                        <li key={u}>{u}</li>
                      ))}
                    </ul>
                    <PrintUrlTable label={`Affected URLs — ${issue.title}`} urls={issue.urls.slice(0, cap)} />
                    {issue.urls.length > cap && (
                      <p className="rpt-note-inline">
                        +{(issue.urls.length - cap).toLocaleString()} more URLs in the Issues CSV export.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* Closing panel */}
        <div className="rpt-panel" data-atomic>
          <div className="rpt-page">
            <h3 className="rpt-serif" style={{ fontSize: 21 }}>Full dataset &amp; affected URLs</h3>
            <p className="mt-2">
              This briefing summarises the highest-impact findings. The complete list of all{" "}
              {report.totalPages.toLocaleString()} URLs, every affected page per issue, and the raw crawl
              data are available as CSV exports from the report screen in Sitemap Scout — share those with
              the technical team alongside this document.
            </p>
          </div>
        </div>

        <div className="rpt-page">
          <footer className="rpt-footer">
            <span>{domain || "Crawled URLs"}</span>
            <span>Crawled {dateLabel}</span>
            <span>Generated by Sitemap Scout</span>
          </footer>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Building blocks ───────────────────────────────────────────────────── */

function Section({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <section className="rpt-section">
      <div className="rpt-shead" data-keep-with-next>
        <span className="rpt-num rpt-mono">{num}</span>
        <h3 className="rpt-stitle rpt-serif">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function Sev({ tone, count, label }: { tone: "crit" | "warn" | "info"; count: number; label: string }) {
  return (
    <div className={`rpt-sev ${tone} flex items-baseline gap-2`}>
      <span className="n rpt-serif">{count.toLocaleString()}</span>
      <span className="l rpt-mono">{label}</span>
    </div>
  );
}

function StatRow({ k, v, tone }: { k: string; v: number; tone?: "crit" | "warn" | "good" }) {
  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-3"
      style={{ borderBottom: "1px solid hsl(var(--rpt-line-soft))" }}
      data-atomic
    >
      <span className="text-[13.5px] rpt-soft">{k}</span>
      <span className={`rpt-serif ${tone ? `t-${tone}` : ""}`} style={{ fontSize: 20 }}>
        {v.toLocaleString()}
      </span>
    </div>
  );
}

function Callout({ n, label, tone }: { n: number; label: string; tone: "crit" | "warn" | "info" }) {
  return (
    <div className="rpt-cell text-center" data-atomic>
      <div className={`rpt-serif t-${tone}`} style={{ fontSize: 34, lineHeight: 1 }}>
        {n.toLocaleString()}
      </div>
      <div className="text-xs rpt-soft mt-1.5">{label}</div>
    </div>
  );
}

function MiniTable({
  title, rows, total,
}: { title: string; rows: { label: string; count: number }[]; total: number }) {
  return (
    <div>
      <div className="rpt-h" data-keep-with-next>{title}</div>
      <table className="rpt-table">
        <thead>
          <tr>
            <th>Item</th>
            <th className="num">Pages</th>
            <th className="num">Share</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td>{r.label}</td>
              <td className="num rpt-serif" style={{ fontSize: 16 }}>{r.count.toLocaleString()}</td>
              <td className="num rpt-soft">
                {total > 0 ? `${Math.round((r.count / total) * 100)}%` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NoLinkData() {
  return (
    <p className="rpt-sub">Enable “Internal links” in crawl settings to generate this section.</p>
  );
}

function UrlList({ label, urls, cap }: { label: string; urls: string[]; cap: number }) {
  const [open, setOpen] = useState(false);
  const extra = urls.length - cap;
  return (
    <div className="mt-5" data-atomic>
      <div className="rpt-h print:hidden" data-keep-with-next>{label}</div>
      {/* Screen: expandable */}
      <ul className="rpt-urls print:hidden">
        {(open ? urls : urls.slice(0, cap)).map((u) => (
          <li key={u}>{u}</li>
        ))}
      </ul>
      {/* Print: capped, header repeats on every continuation page */}
      <PrintUrlTable label={label} urls={urls.slice(0, cap)} />
      {extra > 0 && (
        <>
          <button
            onClick={() => setOpen((v) => !v)}
            className="no-print rpt-mono text-[11px] t-lime hover:underline mt-2"
          >
            {open ? "Show fewer" : `Show all ${urls.length.toLocaleString()}`}
          </button>
          <p className="hidden print:block rpt-note-inline">
            +{extra.toLocaleString()} more URLs in the CSV export.
          </p>
        </>
      )}
    </div>
  );
}

/** Print-only URL list rendered as a table so its heading repeats on every
 *  continuation page and individual URL rows never split across pages. */
function PrintUrlTable({ label, urls }: { label: string; urls: string[] }) {
  if (urls.length === 0) return null;
  return (
    <table className="rpt-url-table hidden print:table">
      <thead>
        <tr>
          <th className="rpt-h">{label}</th>
        </tr>
      </thead>
      <tbody>
        {urls.map((u) => (
          <tr key={u}>
            <td>{u}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ScoreDial({ score, grade }: { score: number; grade: string }) {
  const r = 30;
  const circumference = 2 * Math.PI * r;
  const dash = (score / 100) * circumference;
  const tone = toneForScore(score);
  return (
    <div className="flex items-center gap-4">
      <div className="relative h-[84px] w-[84px] flex-shrink-0">
        <svg viewBox="0 0 84 84" className="h-full w-full -rotate-90">
          <circle cx="42" cy="42" r={r} fill="none" strokeWidth="7" stroke="hsl(var(--rpt-line))" />
          <circle
            cx="42" cy="42" r={r} fill="none" strokeWidth="7" strokeLinecap="butt"
            className={`t-${tone} stroke-current`}
            strokeDasharray={`${dash} ${circumference - dash}`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`rpt-serif t-${tone}`} style={{ fontSize: 26 }}>{score}</span>
        </div>
      </div>
      <div>
        <div className="rpt-cat rpt-mono">Overall health</div>
        <div className={`rpt-serif t-${tone}`} style={{ fontSize: 24, lineHeight: 1.15 }}>{grade}</div>
      </div>
    </div>
  );
}

function FixItem({ rank, issue, cap }: { rank: number; issue: PrioritisedIssue; cap: number }) {
  const [urlsOpen, setUrlsOpen] = useState(false);
  return (
    <div className="rpt-fix" data-atomic>
      <div className="rpt-rank rpt-serif">{String(rank).padStart(2, "0")}</div>
      <div className="min-w-0">
        {/* Head + guidance stay on one page so a title never ends a page alone. */}
        <div className="rpt-fix-keep">
          <div className="rpt-fix-head" data-keep-with-next>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className={`rpt-tag ${SEV_TAG[issue.severity]}`}>{issue.severity}</span>
              <span className="rpt-tag cat">{issue.category}</span>
            </div>
            <h4 className="rpt-fix-title rpt-serif">{issue.title}</h4>
            <div className="rpt-fix-scope rpt-mono mt-1.5">
              {issue.count.toLocaleString()} page{issue.count === 1 ? "" : "s"} ·{" "}
              {Math.round(issue.share * 100)}% of the site · impact {issue.priority}/100
            </div>
            <div className="rpt-meter mt-2 print:hidden" style={{ maxWidth: 180 }}>
              <i className="f-lime" style={{ width: `${issue.priority}%` }} />
            </div>
          </div>

          <div className="rpt-fix-body">
            <div>
              <div className="rpt-h">Why it matters</div>
              <p>{issue.why}</p>
            </div>
            <div>
              <div className="rpt-h">Recommended action</div>
              <p>{issue.fix}</p>
            </div>
          </div>
        </div>

        {issue.urls.length > 0 && (
          <div className="mt-4">
            <div className="rpt-h print:hidden">Affected URLs</div>
            <ul className="rpt-urls print:hidden">
              {(urlsOpen ? issue.urls : issue.urls.slice(0, cap)).map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
            <PrintUrlTable label="Affected URLs" urls={issue.urls.slice(0, cap)} />
            {issue.urls.length > cap && (
              <>
                <button
                  onClick={() => setUrlsOpen((v) => !v)}
                  className="no-print rpt-mono text-[11px] t-lime hover:underline mt-2"
                >
                  {urlsOpen ? "Show fewer" : `Show all ${issue.urls.length.toLocaleString()}`}
                </button>
                <p className="hidden print:block rpt-note-inline">
                  +{(issue.urls.length - cap).toLocaleString()} more URLs in the Issues CSV export.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
