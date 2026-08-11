# Sitebulb-style Reporting Layer

Goal: add the presentation/guidance layer Sitebulb wins on, reusing the audit data we already extract. No changes to crawling, parsing, or any existing panel logic.

## What we already have (no new work needed)

- Rule-based issue engine with plain-English "why this matters" + "how to fix" for every finding (`src/lib/seo-issues.ts`, 545 lines, severity already critical/warning/info).
- Issue browser with severity filters and affected-URL lists (`SeoIssuesView`).
- Visual crawl maps: site structure graph + internal link graph, both openable in a new tab with PNG / interactive HTML export.
- Duplicates, link equity (inbound/outbound scoring), rel-attribute audit, response-code breakdown, overview stats.
- AI Insights (BYOK) for narrative interpretation.
- Crawl session already persisted in IndexedDB (`sitemap-scout-crawl-store`), so snapshots are cheap to add.

## What Sitebulb has that we don't — and the verdict

| Sitebulb feature | Decision |
| --- | --- |
| Audit health score (overall + per category) | Build — pure derivation from existing issues |
| Prioritized hints ("fix this first") | Build — score existing issues by severity x affected-page share |
| Client-ready PDF report | Build — print-optimised report route, browser "Save as PDF" (no new heavy deps) |
| Crawl comparison (two snapshots side by side) | Build — snapshot the score/issue summary only, not full page rows |
| Page screenshots during crawl | Skip — needs headless rendering per URL; heavy cost, out of scope |
| Cloud crawling / multi-user workspaces | Skip — separate infrastructure project |

## What gets built

### 1. Audit scoring + prioritisation (`src/lib/audit-report.ts`, new)
Pure functions over the existing `SeoIssue[]` and `CrawlResult[]`:
- Category scores (Indexability, Meta, Headings, Content/Images, Links, International, Structured Data) 0-100, penalised by severity weight x share of affected pages.
- Overall health score = weighted average, mapped to a grade band (Excellent / Good / Needs work / Critical).
- Priority score per issue = severity weight x affected-page share, giving an ordered "Fix first" list.

### 2. Report view (`src/components/AuditReport.tsx`, new)
New sidebar entry "Audit Report" under Overview, rendered in `ResultsShell`:
- Header: site, crawl date, URLs crawled, overall score dial + grade.
- Category score bars.
- "Fix these first" — top 10 prioritised hints, each with impact, affected count, why, and fix (reusing existing copy).
- Compact summary tables: response codes, indexability, top duplicate clusters.
- Comparison strip when a previous snapshot exists (see 4).
- Buttons: "Download PDF" and "Save snapshot".

### 3. PDF export
A print stylesheet plus a dedicated `/app/report` print route that renders the same `AuditReport` in a light, paginated, logo-headed layout and calls `window.print()`. Optional "Prepared for [client name]" field for white-labelling. No new PDF library.

### 4. Audit comparison (`src/lib/audit-snapshots.ts`, new)
- "Save snapshot" writes a small record (domain, timestamp, URL count, scores, per-issue counts) to a new IndexedDB store in the existing database — full page rows are not duplicated.
- Report shows delta vs. the latest snapshot for the same domain: score change, issues resolved, issues introduced.
- Snapshot list with delete; capped (e.g. last 10 per domain).

## Technical notes

- All new code is additive: three new files plus one sidebar item, one `ResultsShell` case, one route. `seo-issues.ts`, `use-crawler.ts` crawl logic, and every existing panel stay unchanged (a new IndexedDB object store is added via a version bump that preserves the existing session store).
- Scoring is deterministic and derived — no extra network calls, no AI dependency, no crawl slowdown.
- Styling uses existing semantic tokens; the print layout is the only place with a light-on-white variant, scoped to `@media print`.
