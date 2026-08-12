import type { CrawlResult } from "./crawl-api";
import type { PrioritisedIssue } from "./audit-report";

/** CSV helpers for the audit report — no dependencies, no cap on rows. */

function esc(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\r\n");
}

export function download(filename: string, content: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob(["\uFEFF" + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** One row per affected URL per issue. */
export function buildIssueUrlCsv(
  issues: PrioritisedIssue[],
  results: CrawlResult[]
): string {
  const statusByUrl = new Map(results.map((r) => [r.url, r.statusCode]));
  const rows: unknown[][] = [];
  for (const issue of issues) {
    for (const url of issue.urls) {
      rows.push([
        url,
        statusByUrl.get(url) ?? "",
        issue.severity,
        issue.category,
        issue.group,
        issue.title,
        issue.priority,
        issue.fix,
      ]);
    }
  }
  return toCsv(
    ["URL", "Status code", "Severity", "Category", "Group", "Issue", "Impact", "How to fix"],
    rows
  );
}

/** One row per crawled URL with the fields we already extract. */
export function buildPageSummaryCsv(results: CrawlResult[]): string {
  const rows = results.map((r) => [
    r.url,
    r.statusCode,
    r.title ?? "",
    (r.title ?? "").length,
    r.description ?? "",
    (r.description ?? "").length,
    (r.h1s ?? []).join(" | "),
    (r.h1s ?? []).length,
    r.canonical ?? "",
    r.canonicalStatus ?? "",
    r.robots ?? "",
    (r.images ?? []).length,
    (r.images ?? []).filter((i) => !i.alt?.trim()).length,
    (r.internalLinks ?? []).filter((l) => l.isInternal).length,
    (r.schemas ?? []).join(" | "),
    (r.hreflangs ?? []).length,
    r.hopCount ?? 0,
    r.finalUrl ?? "",
  ]);
  return toCsv(
    [
      "URL", "Status code", "Title", "Title length", "Meta description", "Description length",
      "H1", "H1 count", "Canonical", "Canonical status", "Meta robots",
      "Images", "Images missing alt", "Internal links out", "Schema types", "Hreflang entries",
      "Redirect hops", "Final URL",
    ],
    rows
  );
}

export function safeFileStem(domain: string): string {
  const base = (domain || "crawl").replace(/^https?:\/\//, "").replace(/[^a-z0-9.-]+/gi, "-");
  const date = new Date().toISOString().slice(0, 10);
  return `${base}-audit-${date}`;
}
