# Audit Report v2 — deeper data, cleaner PDFs

Goal: give the report the URL-level depth users are asking for, kill the wasted PDF pages, and add four more Sitebulb-style reports built purely from data we already crawl. No crawl, parsing, or existing-panel logic changes.

## 1. Fix the PDF page bloat

The current print CSS marks every top-level block `break-inside: avoid`, so any section that doesn't fit the remaining space pushes a whole new page and leaves large blank gaps. Changes:

- Allow long sections (priority list, appendix, tables) to flow across pages; keep `break-inside: avoid` only on small atomic blocks (a single hint card, a single table row, a score bar).
- Keep headings with their content (`break-after: avoid`), repeat table headers on continued pages.
- Print root switches from absolute positioning to normal flow so page breaks are computed correctly.
- Tighter print typography and spacing (smaller card padding, no rounded borders/shadows, denser tables) — roughly 40% less vertical space per section.
- Hide interactive-only chrome (accordion chevrons, filter controls, hover states) in print.

## 2. Report options (on-screen, never printed)

A single options bar above the report:

- "Prepared for" (already exists).
- Section checkboxes — all ON by default, user can opt out: Category scores, Fix these first, Response codes, Indexability, Duplicate clusters, Crawl depth, Orphan pages, Redirect chains, Site structure, URL appendix.
- Appendix cap selector: 10 / 20 / 50 URLs per issue (default 20).
- Buttons: **Download PDF**, **Export CSV** (full, uncapped URL-level data).

## 3. URL-level detail

- Every hint in "Fix these first" gets an expandable URL list on screen, and prints up to the chosen cap with "+N more URLs — see CSV export".
- New **Affected URLs appendix** section at the end of the report: one compact block per issue (issue name, severity, affected count, capped URL list).
- **CSV export**: one row per affected URL per issue — `url, issue, severity, category, group, status code, detail` — plus a second file section for the per-URL summary (status, title, description, H1, canonical, robots, word-free fields we already have). No cap, no new deps.

## 4. Four new reports (all derived from existing crawl data)

### Crawl depth / click depth
BFS from the homepage (or shallowest crawled URL) across internal links: depth distribution bar list, count of pages deeper than 3 clicks, deepest sample URLs. Pages unreachable via internal links are reported separately (feeds orphan detection).

### Orphan & low-link pages
Pages with zero inbound internal links, and pages with 1–2 inbound links, using the existing inbound counts from `link-analysis.ts`. Flags orphans that are 2xx and indexable as the highest-value fix.

### Redirect chains & loops
From the existing `redirectChain` data: chains of 2+ hops, loops (repeated URL in the chain), redirects ending in 4xx/5xx, and internal links that point at a redirecting URL. Shows hop-by-hop path for the worst offenders.

### Site structure by directory
Rolls URLs up by first (and optionally second) path segment: URL count, 2xx/3xx/4xx split, noindex count, issues per section, average click depth. Gives the "which part of the site is broken" view.

Each of these also contributes to scoring: crawl depth and orphans feed the Internal Links category; redirect chains feed Indexability. Weighting stays the same style as today (severity x share of pages).

## 5. Technical notes

- New pure module `src/lib/audit-insights.ts`: `computeClickDepth`, `findOrphanPages`, `analyseRedirectChains`, `buildDirectoryRollup`. Deterministic, memoised in the component, no network calls.
- New `src/lib/audit-export.ts`: CSV builders + download helper (reuses existing blob-download pattern).
- `src/lib/audit-report.ts`: extend `buildAuditReport` to attach the new insight-derived penalties and expose `affectedUrls` per issue (already available from `analyzeSeoIssues`).
- `src/components/AuditReport.tsx` split into small subcomponents (`ReportOptions`, `PriorityRow`, `UrlAppendix`, `DepthReport`, `OrphanReport`, `RedirectChainReport`, `StructureReport`) so the file stays manageable.
- `src/index.css`: rewrite only the `@media print` block; screen tokens untouched.
- Untouched: `use-crawler.ts`, edge functions, IndexedDB storage, `seo-issues.ts` rules, every existing panel and sidebar entry apart from the report view.

## 6. Not doing (needs infra or cost)

Crawl-to-crawl comparison (no crawl history storage), page screenshots (needs headless rendering per URL), cloud crawling / multi-user workspaces, Core Web Vitals field data (requires a paid/quota'd API).
