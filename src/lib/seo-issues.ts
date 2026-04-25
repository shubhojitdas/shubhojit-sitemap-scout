import type { CrawlResult } from "./crawl-api";

/**
 * Static, rule-based SEO issue detector. No AI involved — every rule is a
 * pure function over CrawlResult[]. New SEO fields can plug in by
 * registering an entry in `RULES` keyed by the corresponding flag name so
 * issues only surface for fields the user actually crawled.
 */

export type IssueSeverity = "critical" | "warning" | "info";

export interface SeoIssue {
  /** Stable id for React keys + filtering. */
  id: string;
  /** Which crawl flag must be true for this rule to run. */
  flag: keyof FieldFlags;
  /** Human-readable group label (e.g. "Meta Titles"). */
  group: string;
  /** The actual problem in one short sentence. */
  title: string;
  /** Why it matters for SEO — kept short and beginner-friendly. */
  why: string;
  /** Concrete fix recommendation. */
  fix: string;
  severity: IssueSeverity;
  /** Affected URL list (for the "View URLs" expander). */
  urls: string[];
  /** Convenience count = urls.length. */
  count: number;
}

export interface FieldFlags {
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

/** Filter to OK-status pages so we don't penalize 4xx/5xx for missing meta. */
function ok(results: CrawlResult[]): CrawlResult[] {
  return results.filter((r) => r.statusCode >= 200 && r.statusCode < 300);
}

type Rule = (results: CrawlResult[]) => SeoIssue[];

const RULES: Partial<Record<keyof FieldFlags, Rule>> = {
  includeTitle: (results) => {
    const list = ok(results);
    const issues: SeoIssue[] = [];

    const missing = list.filter((r) => !r.title?.trim());
    if (missing.length) {
      issues.push({
        id: "title-missing",
        flag: "includeTitle",
        group: "Meta Titles",
        title: `${missing.length} page${missing.length === 1 ? "" : "s"} missing a meta title`,
        why: "The <title> tag is the single most-weighted on-page SEO element. Without it, Google generates one from page content — usually less compelling — and your CTR in search results drops.",
        fix: "Add a unique, keyword-rich <title> tag (50–60 characters) to the <head> of every page. It should describe the page's primary topic and ideally include your brand.",
        severity: "critical",
        urls: missing.map((r) => r.url),
        count: missing.length,
      });
    }

    const tooLong = list.filter((r) => r.title && r.title.length > 60);
    if (tooLong.length) {
      issues.push({
        id: "title-too-long",
        flag: "includeTitle",
        group: "Meta Titles",
        title: `${tooLong.length} title${tooLong.length === 1 ? "" : "s"} longer than 60 characters`,
        why: "Google truncates titles around 580 pixels (~60 characters). Anything beyond is replaced with an ellipsis, hiding important keywords and brand signals from searchers.",
        fix: "Shorten titles to 50–60 characters. Front-load the most important keyword and trim filler words like 'Welcome to' or 'Home page of'.",
        severity: "warning",
        urls: tooLong.map((r) => r.url),
        count: tooLong.length,
      });
    }

    const tooShort = list.filter((r) => r.title && r.title.length > 0 && r.title.length < 30);
    if (tooShort.length) {
      issues.push({
        id: "title-too-short",
        flag: "includeTitle",
        group: "Meta Titles",
        title: `${tooShort.length} title${tooShort.length === 1 ? "" : "s"} shorter than 30 characters`,
        why: "Very short titles waste valuable SERP real estate and often miss target keywords, hurting both ranking and click-through.",
        fix: "Expand titles to 50–60 characters by adding qualifiers, location, or your brand. Make sure they uniquely describe the page's intent.",
        severity: "warning",
        urls: tooShort.map((r) => r.url),
        count: tooShort.length,
      });
    }

    // Duplicate titles across pages
    const titleMap = new Map<string, string[]>();
    for (const r of list) {
      const t = r.title?.trim();
      if (!t) continue;
      const key = t.toLowerCase();
      if (!titleMap.has(key)) titleMap.set(key, []);
      titleMap.get(key)!.push(r.url);
    }
    const dupUrls: string[] = [];
    for (const urls of titleMap.values()) if (urls.length > 1) dupUrls.push(...urls);
    if (dupUrls.length) {
      issues.push({
        id: "title-duplicate",
        flag: "includeTitle",
        group: "Meta Titles",
        title: `${dupUrls.length} page${dupUrls.length === 1 ? "" : "s"} share duplicate titles`,
        why: "Duplicate titles confuse search engines about which page to rank for a given query. They also weaken topical authority by spreading link equity across competing pages.",
        fix: "Make every <title> unique. Differentiate templated pages by including a category, product name, or other distinguishing attribute.",
        severity: "warning",
        urls: dupUrls,
        count: dupUrls.length,
      });
    }

    return issues;
  },

  includeDesc: (results) => {
    const list = ok(results);
    const issues: SeoIssue[] = [];

    const missing = list.filter((r) => !r.description?.trim());
    if (missing.length) {
      issues.push({
        id: "desc-missing",
        flag: "includeDesc",
        group: "Meta Descriptions",
        title: `${missing.length} page${missing.length === 1 ? "" : "s"} missing a meta description`,
        why: "Without a meta description, Google auto-generates a snippet from page content, which is rarely as persuasive as a hand-written one. Lower-quality snippets reduce click-through rates.",
        fix: "Write a compelling 120–160 character description for every important page. Include a primary keyword and a clear value proposition or call to action.",
        severity: "critical",
        urls: missing.map((r) => r.url),
        count: missing.length,
      });
    }

    const tooLong = list.filter((r) => r.description && r.description.length > 160);
    if (tooLong.length) {
      issues.push({
        id: "desc-too-long",
        flag: "includeDesc",
        group: "Meta Descriptions",
        title: `${tooLong.length} description${tooLong.length === 1 ? "" : "s"} longer than 160 characters`,
        why: "Google truncates descriptions around 920 pixels (~160 characters). Anything beyond is cut off, often hiding your call-to-action or key benefit.",
        fix: "Trim each description to 120–160 characters. Lead with the most persuasive copy so nothing important is lost if Google truncates.",
        severity: "warning",
        urls: tooLong.map((r) => r.url),
        count: tooLong.length,
      });
    }

    const tooShort = list.filter((r) => r.description && r.description.length > 0 && r.description.length < 70);
    if (tooShort.length) {
      issues.push({
        id: "desc-too-short",
        flag: "includeDesc",
        group: "Meta Descriptions",
        title: `${tooShort.length} description${tooShort.length === 1 ? "" : "s"} shorter than 70 characters`,
        why: "Short descriptions leave ranking and CTR opportunity on the table. They often fail to fully describe the page's value, leading users to skip the result.",
        fix: "Expand descriptions to 120–160 characters with benefits, keywords, and a clear next step (e.g. 'Learn more', 'Shop now').",
        severity: "info",
        urls: tooShort.map((r) => r.url),
        count: tooShort.length,
      });
    }

    return issues;
  },

  includeH1: (results) => {
    const list = ok(results);
    const issues: SeoIssue[] = [];

    const missing = list.filter((r) => (r.h1s ?? []).length === 0);
    if (missing.length) {
      issues.push({
        id: "h1-missing",
        flag: "includeH1",
        group: "H1 Tags",
        title: `${missing.length} page${missing.length === 1 ? "" : "s"} missing an H1`,
        why: "The H1 acts as the page's main headline for both users and search engines. Without it, Google has weaker signals about what the page is primarily about.",
        fix: "Add a single, descriptive <h1> at the top of each page that matches the page's intent and includes the primary keyword.",
        severity: "critical",
        urls: missing.map((r) => r.url),
        count: missing.length,
      });
    }

    const multi = list.filter((r) => (r.h1s ?? []).length > 1);
    if (multi.length) {
      issues.push({
        id: "h1-multiple",
        flag: "includeH1",
        group: "H1 Tags",
        title: `${multi.length} page${multi.length === 1 ? "" : "s"} have multiple H1s`,
        why: "While modern HTML5 allows multiple H1s, search engines and screen readers still expect one primary heading per page. Multiple H1s dilute keyword focus and accessibility.",
        fix: "Keep one <h1> per page. Convert additional H1s to <h2> or <h3> based on their semantic role in the content hierarchy.",
        severity: "warning",
        urls: multi.map((r) => r.url),
        count: multi.length,
      });
    }

    return issues;
  },

  includeH2: (results) => {
    const list = ok(results);
    const noH2 = list.filter((r) => (r.h2s ?? []).length === 0);
    if (!noH2.length) return [];
    return [{
      id: "h2-missing",
      flag: "includeH2",
      group: "H2 Tags",
      title: `${noH2.length} page${noH2.length === 1 ? "" : "s"} have no H2 sub-headings`,
      why: "H2s break long content into scannable sections that improve readability and dwell time. They also give search engines secondary topical signals.",
      fix: "Add 2–6 descriptive <h2> tags per long-form page to outline major sections. Use natural language that includes related keywords.",
      severity: "info",
      urls: noH2.map((r) => r.url),
      count: noH2.length,
    }];
  },

  includeImages: (results) => {
    const list = ok(results);
    const issues: SeoIssue[] = [];

    const urlsMissingAlt: string[] = [];
    let totalMissing = 0;
    for (const r of list) {
      const missingForPage = (r.images ?? []).filter((i) => !i.alt).length;
      if (missingForPage > 0) {
        urlsMissingAlt.push(r.url);
        totalMissing += missingForPage;
      }
    }
    if (urlsMissingAlt.length) {
      issues.push({
        id: "img-alt-missing",
        flag: "includeImages",
        group: "Images",
        title: `${totalMissing} image${totalMissing === 1 ? "" : "s"} missing alt text across ${urlsMissingAlt.length} page${urlsMissingAlt.length === 1 ? "" : "s"}`,
        why: "Alt text is essential for accessibility (screen readers) and helps search engines understand image content, powering Google Image traffic and improving overall page relevance.",
        fix: "Add a concise, descriptive alt attribute to every meaningful <img>. Decorative images can use alt=\"\" so screen readers skip them.",
        severity: "warning",
        urls: urlsMissingAlt,
        count: urlsMissingAlt.length,
      });
    }

    return issues;
  },

  includeRobots: (results) => {
    const list = ok(results);
    const noindex = list.filter((r) => /noindex/i.test(r.robots ?? ""));
    if (!noindex.length) return [];
    return [{
      id: "robots-noindex",
      flag: "includeRobots",
      group: "Meta Robots",
      title: `${noindex.length} page${noindex.length === 1 ? "" : "s"} are blocked by noindex`,
      why: "A 'noindex' meta robots tag tells search engines not to include the page in results. If it's set on a page you want to rank, it will silently destroy organic traffic.",
      fix: "Review each URL. If the page should rank, remove or change the robots meta tag to 'index, follow'. If it's intentional (login pages, thank-you pages), no action needed.",
      severity: "critical",
      urls: noindex.map((r) => r.url),
      count: noindex.length,
    }];
  },

  includeCanonical: (results) => {
    const list = ok(results);
    const issues: SeoIssue[] = [];

    const missing = list.filter((r) => r.canonicalStatus === "Missing");
    if (missing.length) {
      issues.push({
        id: "canonical-missing",
        flag: "includeCanonical",
        group: "Canonicals",
        title: `${missing.length} page${missing.length === 1 ? "" : "s"} have no canonical tag`,
        why: "Without a canonical, Google decides on its own which URL to index when duplicates exist (e.g. tracking parameters, www vs non-www). This can split ranking signals across versions.",
        fix: "Add a self-referencing <link rel=\"canonical\" href=\"…\"> to the <head> of every page, pointing to the clean preferred URL.",
        severity: "warning",
        urls: missing.map((r) => r.url),
        count: missing.length,
      });
    }

    const canonicalised = list.filter((r) => r.canonicalStatus === "Canonicalised");
    if (canonicalised.length) {
      issues.push({
        id: "canonical-away",
        flag: "includeCanonical",
        group: "Canonicals",
        title: `${canonicalised.length} page${canonicalised.length === 1 ? "" : "s"} canonicalize to a different URL`,
        why: "These pages tell Google to rank a different URL instead. If unintentional, you're handing your ranking signals to the wrong page.",
        fix: "Verify each canonical target is the correct preferred version. If the current page should rank on its own, change the canonical to be self-referencing.",
        severity: "info",
        urls: canonicalised.map((r) => r.url),
        count: canonicalised.length,
      });
    }

    return issues;
  },

  includeSchemas: (results) => {
    const list = ok(results);
    const noSchema = list.filter((r) => (r.schemas ?? []).length === 0);
    if (!noSchema.length) return [];
    return [{
      id: "schema-missing",
      flag: "includeSchemas",
      group: "Schema Markup",
      title: `${noSchema.length} page${noSchema.length === 1 ? "" : "s"} have no structured data`,
      why: "Schema.org JSON-LD unlocks rich results in Google: stars for products, prices, FAQ accordions, breadcrumb trails, recipe cards, and more. Pages without it lose these visual SERP advantages.",
      fix: "Add JSON-LD structured data appropriate to each page type — Article, Product, FAQPage, BreadcrumbList, Organization, etc. Use Google's Rich Results Test to validate.",
      severity: "info",
      urls: noSchema.map((r) => r.url),
      count: noSchema.length,
    }];
  },

  includeSocialTags: (results) => {
    const list = ok(results);
    const noOg = list.filter((r) => !Array.isArray(r.socialTags) || r.socialTags.length === 0);
    if (!noOg.length) return [];
    return [{
      id: "social-missing",
      flag: "includeSocialTags",
      group: "Open Graph & Twitter",
      title: `${noOg.length} page${noOg.length === 1 ? "" : "s"} missing Open Graph / Twitter tags`,
      why: "Without OG and Twitter Card tags, links shared on Facebook, LinkedIn, Slack, X, and iMessage fall back to a generic title and no preview image — drastically reducing engagement.",
      fix: "Add og:title, og:description, og:image, twitter:card, twitter:title and twitter:image tags to the <head>. Image should be 1200×630 for best results.",
      severity: "warning",
      urls: noOg.map((r) => r.url),
      count: noOg.length,
    }];
  },

  includeInternalLinks: (results) => {
    const list = ok(results);
    const orphan = list.filter((r) => (r.internalLinks ?? []).length === 0);
    if (!orphan.length) return [];
    return [{
      id: "internal-orphan",
      flag: "includeInternalLinks",
      group: "Internal Links",
      title: `${orphan.length} page${orphan.length === 1 ? "" : "s"} have zero outbound internal links`,
      why: "Pages with no internal links are dead-ends for both crawlers and users. They limit how PageRank flows through your site and reduce the chance of further engagement.",
      fix: "Add 3–10 contextual internal links from each page to related content — related products, supporting blog posts, category pages, etc.",
      severity: "warning",
      urls: orphan.map((r) => r.url),
      count: orphan.length,
    }];
  },

  includeHreflangs: () => [], // hreflang correctness needs cross-page validation; out of scope for v1
};

// ─── Universal rules (always run, not gated on a single flag) ─────────────
function runUniversalRules(results: CrawlResult[]): SeoIssue[] {
  const issues: SeoIssue[] = [];

  const c4xx = results.filter((r) => r.statusCode >= 400 && r.statusCode < 500);
  if (c4xx.length) {
    issues.push({
      id: "status-4xx",
      flag: "includeTitle", // placeholder; not flag-gated
      group: "Response Codes",
      title: `${c4xx.length} URL${c4xx.length === 1 ? "" : "s"} returned 4xx errors`,
      why: "4xx pages waste crawl budget, leak link equity, and create dead-ends for users. Google eventually drops them from the index, taking any rankings with them.",
      fix: "Either restore the missing content, 301-redirect the URL to its closest live equivalent, or remove inbound internal links pointing to it.",
      severity: "critical",
      urls: c4xx.map((r) => r.url),
      count: c4xx.length,
    });
  }

  const c5xx = results.filter((r) => r.statusCode >= 500);
  if (c5xx.length) {
    issues.push({
      id: "status-5xx",
      flag: "includeTitle",
      group: "Response Codes",
      title: `${c5xx.length} URL${c5xx.length === 1 ? "" : "s"} returned 5xx server errors`,
      why: "5xx errors signal an unstable site to Google. Persistent server errors can cause your pages to be deprioritized or temporarily de-indexed.",
      fix: "Investigate server logs for the failing URLs. Common causes: timeouts, database errors, misconfigured rewrites, or memory limits.",
      severity: "critical",
      urls: c5xx.map((r) => r.url),
      count: c5xx.length,
    });
  }

  const tempRedirects = results.filter((r) => {
    const chain = r.redirectChain ?? [];
    return chain.some((h) => h.type === "http" && (h.status === 302 || h.status === 307));
  });
  if (tempRedirects.length) {
    issues.push({
      id: "redirect-temporary",
      flag: "includeTitle",
      group: "Redirects",
      title: `${tempRedirects.length} URL${tempRedirects.length === 1 ? "" : "s"} use temporary (302/307) redirects`,
      why: "Temporary redirects don't pass full link equity to the destination and tell Google the move isn't permanent — so it keeps the original URL in its index.",
      fix: "If the move is permanent, change the redirect to 301 (or 308) at the server / CDN level so ranking signals consolidate on the new URL.",
      severity: "warning",
      urls: tempRedirects.map((r) => r.url),
      count: tempRedirects.length,
    });
  }

  const slow = results.filter((r) => parseFloat(r.fetchTime || "0") > 3);
  if (slow.length) {
    issues.push({
      id: "perf-slow",
      flag: "includeTitle",
      group: "Performance",
      title: `${slow.length} URL${slow.length === 1 ? "" : "s"} took longer than 3 s to respond`,
      why: "Slow server responses delay every other Core Web Vital and hurt both rankings and conversions. Google's own data shows bounce rate jumps 32% when load time goes from 1s to 3s.",
      fix: "Investigate slow endpoints — common fixes are database indexing, caching (Redis/CDN), reducing server-side rendering work, and upgrading hosting.",
      severity: "warning",
      urls: slow.map((r) => r.url),
      count: slow.length,
    });
  }

  return issues;
}

export function analyzeSeoIssues(results: CrawlResult[], flags: FieldFlags): SeoIssue[] {
  const issues: SeoIssue[] = [];

  for (const [flag, rule] of Object.entries(RULES) as [keyof FieldFlags, Rule][]) {
    if (!flags[flag]) continue;
    if (!rule) continue;
    issues.push(...rule(results));
  }

  issues.push(...runUniversalRules(results));

  // Sort: critical → warning → info, then by impact (count desc).
  const sevWeight: Record<IssueSeverity, number> = { critical: 0, warning: 1, info: 2 };
  issues.sort((a, b) => {
    const s = sevWeight[a.severity] - sevWeight[b.severity];
    return s !== 0 ? s : b.count - a.count;
  });

  return issues;
}
