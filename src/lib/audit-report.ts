import type { CrawlResult } from "./crawl-api";
import { analyzeSeoIssues, type FieldFlags, type SeoIssue, type IssueSeverity } from "./seo-issues";
import { buildInsightIssues } from "./audit-insights";

/**
 * Derives an audit health score, per-category scores and a prioritised
 * "fix first" list from the existing rule-based issue engine.
 * Pure + deterministic — no network calls, no AI, no crawl changes.
 */

export type AuditCategory =
  | "Indexability"
  | "On-page Meta"
  | "Headings"
  | "Content & Media"
  | "Internal Links"
  | "Structured Data"
  | "Social Sharing";

export const AUDIT_CATEGORIES: AuditCategory[] = [
  "Indexability",
  "On-page Meta",
  "Headings",
  "Content & Media",
  "Internal Links",
  "Structured Data",
  "Social Sharing",
];

/** Maps an issue's `group` label onto a scored audit category. */
const GROUP_TO_CATEGORY: Record<string, AuditCategory> = {
  "Response Codes": "Indexability",
  Redirects: "Indexability",
  Canonicals: "Indexability",
  "Meta Robots": "Indexability",
  "Meta Titles": "On-page Meta",
  "Meta Descriptions": "On-page Meta",
  "H1 Tags": "Headings",
  "H2 Tags": "Headings",
  "H3 Tags": "Headings",
  Images: "Content & Media",
  Performance: "Content & Media",
  "Internal Links": "Internal Links",
  "Schema Markup": "Structured Data",
  "Open Graph & Twitter": "Social Sharing",
};

export function categoryOf(group: string): AuditCategory {
  return GROUP_TO_CATEGORY[group] ?? "Content & Media";
}

/** Penalty weight per severity — how much a fully site-wide issue costs. */
const SEVERITY_WEIGHT: Record<IssueSeverity, number> = {
  critical: 55,
  warning: 25,
  info: 8,
};

export type Grade = "Excellent" | "Good" | "Needs work" | "Critical";

export function gradeFor(score: number): Grade {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 50) return "Needs work";
  return "Critical";
}

export interface PrioritisedIssue extends SeoIssue {
  category: AuditCategory;
  /** Share of crawled pages affected, 0–1. */
  share: number;
  /** 0–100 impact score used for ordering. */
  priority: number;
}

export interface CategoryScore {
  category: AuditCategory;
  score: number;
  grade: Grade;
  issueCount: number;
  criticalCount: number;
  /** True when no rule in this category could run (field not crawled). */
  notAudited: boolean;
}

export interface AuditReportData {
  overallScore: number;
  grade: Grade;
  totalPages: number;
  issues: PrioritisedIssue[];
  categories: CategoryScore[];
  counts: Record<IssueSeverity, number>;
  /** Top prioritised issues, highest impact first. */
  topPriorities: PrioritisedIssue[];
  responseBreakdown: { label: string; count: number }[];
  indexability: { label: string; count: number }[];
}

/** Which categories are auditable given the flags the user actually crawled. */
function auditedCategories(flags: FieldFlags): Set<AuditCategory> {
  const set = new Set<AuditCategory>(["Indexability"]);
  if (flags.includeTitle || flags.includeDesc) set.add("On-page Meta");
  if (flags.includeH1 || flags.includeH2 || flags.includeH3) set.add("Headings");
  if (flags.includeImages) set.add("Content & Media");
  if (flags.includeInternalLinks) set.add("Internal Links");
  if (flags.includeSchemas) set.add("Structured Data");
  if (flags.includeSocialTags) set.add("Social Sharing");
  return set;
}

function scoreFromPenalty(penalty: number): number {
  return Math.max(0, Math.min(100, Math.round(100 - penalty)));
}

export function buildAuditReport(results: CrawlResult[], flags: FieldFlags): AuditReportData {
  const totalPages = Math.max(1, results.length);
  const raw = [
    ...analyzeSeoIssues(results, flags),
    ...buildInsightIssues(results, flags.includeInternalLinks),
  ];

  const issues: PrioritisedIssue[] = raw.map((i) => {
    const share = Math.min(1, i.count / totalPages);
    const priority = Math.round(SEVERITY_WEIGHT[i.severity] * (0.35 + 0.65 * share) * (100 / 55));
    return { ...i, category: categoryOf(i.group), share, priority };
  });

  const counts: Record<IssueSeverity, number> = { critical: 0, warning: 0, info: 0 };
  for (const i of issues) counts[i.severity]++;

  const audited = auditedCategories(flags);

  const categories: CategoryScore[] = AUDIT_CATEGORIES.map((category) => {
    const mine = issues.filter((i) => i.category === category);
    const penalty = mine.reduce((sum, i) => sum + SEVERITY_WEIGHT[i.severity] * i.share, 0);
    return {
      category,
      score: scoreFromPenalty(penalty),
      grade: gradeFor(scoreFromPenalty(penalty)),
      issueCount: mine.length,
      criticalCount: mine.filter((i) => i.severity === "critical").length,
      notAudited: !audited.has(category),
    };
  });

  const scored = categories.filter((c) => !c.notAudited);
  const overallScore = scored.length
    ? Math.round(scored.reduce((s, c) => s + c.score, 0) / scored.length)
    : 100;

  const topPriorities = [...issues]
    .sort((a, b) => b.priority - a.priority || b.count - a.count)
    .slice(0, 10);

  const c2xx = results.filter((r) => r.statusCode >= 200 && r.statusCode < 300).length;
  const c3xx = results.filter(
    (r) => (r.redirectChain?.length ?? 0) > 0 || (r.statusCode >= 300 && r.statusCode < 400)
  ).length;
  const c4xx = results.filter((r) => r.statusCode >= 400 && r.statusCode < 500).length;
  const c5xx = results.filter((r) => r.statusCode >= 500).length;

  const responseBreakdown = [
    { label: "2xx Success", count: c2xx },
    { label: "3xx Redirects", count: c3xx },
    { label: "4xx Client errors", count: c4xx },
    { label: "5xx Server errors", count: c5xx },
  ];

  const noindex = results.filter((r) => (r.robots ?? "").toLowerCase().includes("noindex")).length;
  const nofollow = results.filter((r) => (r.robots ?? "").toLowerCase().includes("nofollow")).length;
  const canonicalised = results.filter((r) => r.canonicalStatus === "Canonicalised").length;
  const missingCanonical = results.filter((r) => r.canonicalStatus === "Missing").length;

  const indexability = [
    { label: "Indexable pages", count: Math.max(0, c2xx - noindex) },
    { label: "Noindex", count: noindex },
    { label: "Nofollow", count: nofollow },
    { label: "Canonicalised away", count: canonicalised },
    { label: "Missing canonical", count: missingCanonical },
  ];

  return {
    overallScore,
    grade: gradeFor(overallScore),
    totalPages: results.length,
    issues,
    categories,
    counts,
    topPriorities,
    responseBreakdown,
    indexability,
  };
}
