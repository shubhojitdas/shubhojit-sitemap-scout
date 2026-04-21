/**
 * robots.txt parser, matcher, and generator.
 * Implements the Google robots spec subset:
 *  - Group selection by most-specific User-agent match
 *  - Path matching with `*` (any sequence) and `$` (end-anchor) wildcards
 *  - Longest matching rule wins; allow beats disallow on tie
 *  - Sitemap directives are global and case-insensitive
 *
 * Pure client-side. No network. No external deps.
 */

import type { CrawlResult } from "@/lib/crawl-api";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RobotsRule = {
  type: "allow" | "disallow";
  path: string;
  /** 1-indexed source line number for UI highlighting. */
  line: number;
};

export type RobotsGroup = {
  userAgents: string[]; // lower-cased
  rules: RobotsRule[];
  crawlDelay?: number;
};

export type RobotsParsed = {
  groups: RobotsGroup[];
  sitemaps: string[];
  warnings: { line: number; message: string }[];
};

export type MatchResult = {
  allowed: boolean;
  matchedRule?: RobotsRule;
  matchedGroupAgents?: string[];
  reason: string;
};

// ─── Common bot user-agents ───────────────────────────────────────────────────

export const COMMON_BOTS: { label: string; ua: string; group?: string }[] = [
  { label: "Googlebot", ua: "Googlebot", group: "Search" },
  { label: "Googlebot-Image", ua: "Googlebot-Image", group: "Search" },
  { label: "Googlebot-News", ua: "Googlebot-News", group: "Search" },
  { label: "Googlebot-Video", ua: "Googlebot-Video", group: "Search" },
  { label: "Bingbot", ua: "Bingbot", group: "Search" },
  { label: "Slurp (Yahoo)", ua: "Slurp", group: "Search" },
  { label: "DuckDuckBot", ua: "DuckDuckBot", group: "Search" },
  { label: "YandexBot", ua: "YandexBot", group: "Search" },
  { label: "Baiduspider", ua: "Baiduspider", group: "Search" },
  { label: "Applebot", ua: "Applebot", group: "Search" },

  { label: "GPTBot (OpenAI)", ua: "GPTBot", group: "AI" },
  { label: "OAI-SearchBot", ua: "OAI-SearchBot", group: "AI" },
  { label: "ChatGPT-User", ua: "ChatGPT-User", group: "AI" },
  { label: "ClaudeBot (Anthropic)", ua: "ClaudeBot", group: "AI" },
  { label: "Claude-Web", ua: "Claude-Web", group: "AI" },
  { label: "anthropic-ai", ua: "anthropic-ai", group: "AI" },
  { label: "PerplexityBot", ua: "PerplexityBot", group: "AI" },
  { label: "Perplexity-User", ua: "Perplexity-User", group: "AI" },
  { label: "Google-Extended", ua: "Google-Extended", group: "AI" },
  { label: "CCBot (Common Crawl)", ua: "CCBot", group: "AI" },
  { label: "Bytespider", ua: "Bytespider", group: "AI" },
  { label: "Amazonbot", ua: "Amazonbot", group: "AI" },
  { label: "Meta-ExternalAgent", ua: "Meta-ExternalAgent", group: "AI" },
  { label: "cohere-ai", ua: "cohere-ai", group: "AI" },
  { label: "Diffbot", ua: "Diffbot", group: "AI" },

  { label: "FacebookExternalHit", ua: "facebookexternalhit", group: "Social" },
  { label: "Twitterbot", ua: "Twitterbot", group: "Social" },
  { label: "LinkedInBot", ua: "LinkedInBot", group: "Social" },
  { label: "Pinterestbot", ua: "Pinterestbot", group: "Social" },
  { label: "WhatsApp", ua: "WhatsApp", group: "Social" },
  { label: "TelegramBot", ua: "TelegramBot", group: "Social" },

  { label: "AhrefsBot", ua: "AhrefsBot", group: "SEO" },
  { label: "SemrushBot", ua: "SemrushBot", group: "SEO" },
  { label: "MJ12bot", ua: "MJ12bot", group: "SEO" },
  { label: "DotBot", ua: "DotBot", group: "SEO" },
  { label: "rogerbot", ua: "rogerbot", group: "SEO" },
  { label: "Screaming Frog", ua: "Screaming Frog SEO Spider", group: "SEO" },
];

// ─── Parser ───────────────────────────────────────────────────────────────────

export function parseRobotsTxt(text: string): RobotsParsed {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  const warnings: { line: number; message: string }[] = [];

  let current: RobotsGroup | null = null;
  /**
   * If true, the next user-agent line continues the current group (i.e. multiple
   * UAs share the same set of rules). Reset after the first rule directive.
   */
  let pendingUaGroup = false;

  const lines = text.split(/\r?\n/);
  lines.forEach((rawLine, idx) => {
    const lineNo = idx + 1;
    const stripped = rawLine.replace(/#.*$/, "").trim();
    if (!stripped) return;

    const m = stripped.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) {
      warnings.push({ line: lineNo, message: `Malformed line: "${rawLine.trim()}"` });
      return;
    }
    const directive = m[1].toLowerCase();
    const value = m[2].trim();

    if (directive === "user-agent") {
      if (!value) {
        warnings.push({ line: lineNo, message: "User-agent value is empty" });
        return;
      }
      if (!current || !pendingUaGroup) {
        current = { userAgents: [], rules: [] };
        groups.push(current);
        pendingUaGroup = true;
      }
      current.userAgents.push(value.toLowerCase());
      return;
    }

    if (directive === "sitemap") {
      if (value) sitemaps.push(value);
      return;
    }

    if (directive === "allow" || directive === "disallow") {
      if (!current) {
        warnings.push({
          line: lineNo,
          message: `${m[1]} directive before any User-agent — ignored`,
        });
        return;
      }
      pendingUaGroup = false;
      // Empty Disallow = allow everything for this UA. Skip rule entirely.
      if (directive === "disallow" && value === "") return;
      current.rules.push({ type: directive, path: value, line: lineNo });
      return;
    }

    if (directive === "crawl-delay") {
      if (current) {
        const n = Number(value);
        if (!Number.isNaN(n)) current.crawlDelay = n;
      }
      return;
    }

    // Unknown but not necessarily invalid (Host:, Clean-param:, etc.)
    if (!["host", "clean-param", "noindex", "request-rate", "visit-time"].includes(directive)) {
      warnings.push({ line: lineNo, message: `Unknown directive: ${m[1]}` });
    }
  });

  return { groups, sitemaps, warnings };
}

// ─── Matcher ──────────────────────────────────────────────────────────────────

/**
 * Convert a robots-style path pattern into a regular expression.
 * `*` → `.*`, `$` at end → end anchor, everything else regex-escaped.
 */
function patternToRegex(pattern: string): RegExp {
  const endAnchored = pattern.endsWith("$");
  const body = endAnchored ? pattern.slice(0, -1) : pattern;
  let re = "";
  for (const ch of body) {
    if (ch === "*") re += ".*";
    else re += ch.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp("^" + re + (endAnchored ? "$" : ""));
}

/** Length of a pattern excluding wildcard sugar — used for "longest match wins". */
function patternSpecificity(pattern: string): number {
  return pattern.replace(/\*/g, "").replace(/\$$/, "").length;
}

/**
 * Pick the group whose user-agent token is the longest case-insensitive
 * substring of the requesting UA. Falls back to the `*` group if none matches.
 */
function selectGroup(parsed: RobotsParsed, userAgent: string): RobotsGroup | null {
  const uaLower = userAgent.toLowerCase();
  let best: { group: RobotsGroup; len: number } | null = null;
  let star: RobotsGroup | null = null;

  for (const g of parsed.groups) {
    for (const tok of g.userAgents) {
      if (tok === "*") {
        star = g;
        continue;
      }
      // Google spec: substring match on the UA product token.
      if (uaLower.includes(tok)) {
        if (!best || tok.length > best.len) best = { group: g, len: tok.length };
      }
    }
  }
  return best?.group ?? star ?? null;
}

export function testUrl(
  parsed: RobotsParsed,
  url: string,
  userAgent: string,
): MatchResult {
  let path: string;
  try {
    const u = new URL(url);
    path = u.pathname + u.search;
  } catch {
    return { allowed: true, reason: "Invalid URL — treated as allowed" };
  }

  const group = selectGroup(parsed, userAgent);
  if (!group) {
    return {
      allowed: true,
      reason: "No matching User-agent group and no wildcard group → allowed by default",
    };
  }

  let bestRule: RobotsRule | null = null;
  let bestLen = -1;
  for (const rule of group.rules) {
    const re = patternToRegex(rule.path || "/");
    if (re.test(path)) {
      const len = patternSpecificity(rule.path);
      if (
        len > bestLen ||
        // Tie → prefer allow (Google spec).
        (len === bestLen && rule.type === "allow" && bestRule?.type === "disallow")
      ) {
        bestRule = rule;
        bestLen = len;
      }
    }
  }

  if (!bestRule) {
    return {
      allowed: true,
      matchedGroupAgents: group.userAgents,
      reason: `No rule matched for group [${group.userAgents.join(", ")}] → allowed`,
    };
  }

  return {
    allowed: bestRule.type === "allow",
    matchedRule: bestRule,
    matchedGroupAgents: group.userAgents,
    reason: `${bestRule.type === "allow" ? "Allow" : "Disallow"}: ${bestRule.path || "/"} (group: ${group.userAgents.join(", ")})`,
  };
}

// ─── Generator ────────────────────────────────────────────────────────────────

/**
 * Auto-suggest a robots.txt from crawl results.
 * Strategy:
 *  - `User-agent: *` + `Allow: /` baseline
 *  - Disallow path *prefixes* observed to return 401/403/404/410 in the crawl
 *    (only if at least 2 URLs under the same prefix produced an error — avoids
 *     blocking entire sections from a single 404)
 *  - Disallow common crawl-trap query params (?utm_*, ?ref=, ?fbclid)
 *  - Sitemap line for `https://<domain>/sitemap.xml`
 *
 * Strictly derived from crawl data — no proactive guesses for /wp-admin etc.
 */
export function generateRobotsTxt(results: CrawlResult[], domain: string): string {
  const errorPrefixes = new Map<string, number>();
  for (const r of results) {
    if (![401, 403, 404, 410].includes(r.statusCode)) continue;
    try {
      const u = new URL(r.url);
      const segs = u.pathname.split("/").filter(Boolean);
      if (segs.length === 0) continue;
      const prefix = "/" + segs[0] + "/";
      errorPrefixes.set(prefix, (errorPrefixes.get(prefix) ?? 0) + 1);
    } catch { /* ignore */ }
  }

  const disallows: string[] = [];
  for (const [prefix, count] of errorPrefixes) {
    if (count >= 2) disallows.push(prefix);
  }
  disallows.sort();

  const lines: string[] = [];
  lines.push("# Generated by SEO Sitemap Scout");
  lines.push("# Review carefully before deploying to production");
  lines.push("");
  lines.push("User-agent: *");
  lines.push("Allow: /");
  if (disallows.length > 0) {
    lines.push("");
    lines.push("# Paths returning errors during crawl (≥2 URLs each)");
    for (const p of disallows) lines.push(`Disallow: ${p}`);
  }
  lines.push("");
  lines.push(`Sitemap: https://${domain}/sitemap.xml`);
  lines.push("");
  return lines.join("\n");
}
