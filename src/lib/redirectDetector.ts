/**
 * Phase 1 — Redirect detection (HTTP + meta-refresh + inline JS, no headless browser).
 *
 * Follows the redirect chain manually so each hop can be inspected. Meta-refresh
 * tags with a delay of 0–5s are treated as redirect hops, matching how search
 * engines interpret them. Inline `<script>` blocks are scanned for common
 * `window.location` / `document.location` redirect patterns and treated as
 * additional hops.
 *
 * Phase 2 will extend this with headless rendering for SPA / async JS redirects.
 */

export type RedirectHopType = "http" | "meta-refresh" | "javascript";

export type RedirectKind = "none" | "http" | "meta-refresh" | "javascript" | "mixed";

export interface RedirectHop {
  url: string;
  status: number;
  type: RedirectHopType;
  /** Optional human-readable status (e.g. "Max redirects exceeded"). */
  statusText?: string;
}

export interface RedirectDetectionResult {
  initialUrl: string;
  finalUrl: string;
  redirectType: RedirectKind;
  redirectChain: RedirectHop[];
  hopCount: number;
  /** HTML of the final landed page so the caller can extract title/description. */
  finalHtml: string;
  /** HTTP status code of the final landed page. */
  finalStatus: number;
}

const MAX_HOPS = 10;
const FETCH_TIMEOUT_MS = 15000;

const DEFAULT_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (compatible; SitemapCrawlerPro/1.0)",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
};

/**
 * Detect <meta http-equiv="refresh" content="0; url=..."> in the document head.
 * Returns the absolute target URL when delay ≤ 5s, else null.
 */
export function extractMetaRefreshTarget(html: string, baseUrl: string): string | null {
  const cleaned = html.replace(/<!--[\s\S]*?-->/g, "");
  const headMatch = cleaned.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
  const scope = headMatch ? headMatch[1] : cleaned;

  // Spec: case-insensitive, single or double quotes, optional whitespace.
  const re = /<meta\s+[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*>/gi;
  let tag: RegExpExecArray | null;
  while ((tag = re.exec(scope)) !== null) {
    const attrs = tag[0];
    const contentMatch = attrs.match(/\bcontent\s*=\s*"([^"]*)"/i)
      ?? attrs.match(/\bcontent\s*=\s*'([^']*)'/i);
    if (!contentMatch) continue;

    // Parse "<delay>;url=<target>"
    const value = contentMatch[1].trim();
    const semi = value.indexOf(";");
    const delay = parseFloat(semi === -1 ? value : value.slice(0, semi)) || 0;
    if (delay > 5) continue;

    const rest = semi === -1 ? "" : value.slice(semi + 1).trim();
    const urlMatch = rest.match(/url\s*=\s*["']?([^"'\s>]+)/i);
    if (!urlMatch) continue;

    let target = urlMatch[1].trim();
    try { target = new URL(target, baseUrl).href; } catch { /* keep as-is */ }
    return target;
  }
  return null;
}

/**
 * Detect inline JavaScript redirects via pattern matching on `<script>` blocks.
 *
 * Catches common assignments like:
 *   window.location.href = "..."
 *   window.location.replace("...")
 *   document.location = "..."
 *   location.href = "..."
 *
 * Only scans inside <script>…</script> (skipping HTML comments) to keep false
 * positives low. Does not execute JS — pattern match only.
 *
 * Returns the resolved absolute URL of the first valid match, or null.
 */
export function extractJsRedirectTarget(html: string, baseUrl: string): string | null {
  // Strip HTML comments first so commented-out scripts are ignored.
  const noComments = html.replace(/<!--[\s\S]*?-->/g, "");

  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  // Capture the quote char so template literals can be distinguished from plain strings.
  const JS_REDIRECT_REGEX =
    /(?:window\.|document\.|top\.|self\.|parent\.)?location(?:\.href|\.replace|\.assign)?\s*(?:=|\()\s*(['"`])([^'"`]+)\1/gi;

  let scriptMatch: RegExpExecArray | null;
  while ((scriptMatch = scriptRegex.exec(noComments)) !== null) {
    const body = scriptMatch[1];
    if (!body || !body.trim()) continue;

    const cleanedBody = body
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/[^\n\r]*/g, "$1");

    JS_REDIRECT_REGEX.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = JS_REDIRECT_REGEX.exec(cleanedBody)) !== null) {
      const quote = m[1];
      const raw = m[2].trim();
      if (!raw || raw === "#" || raw.startsWith("#")) continue;
      if (raw.startsWith("javascript:")) continue;

      // Skip template literals containing interpolation — those are dynamic targets,
      // not real page-level redirects (e.g. `/products/${handle}`).
      if (quote === "`" && /\$\{/.test(raw)) continue;
      if (/\{\{[^}]*\}\}/.test(raw)) continue;
      if (/\$\{|%24%7B|%7B[^/]*%7D/i.test(raw)) continue;

      // Skip assignments inside event-handler bodies — those fire on user action,
      // not page load, so they aren't crawl-time redirects.
      const ctxStart = Math.max(0, m.index - 200);
      const ctx = cleanedBody.slice(ctxStart, m.index);
      if (/addEventListener\s*\(\s*['"`](?:click|submit|change|input|keydown|keyup|mousedown|mouseup|touchstart|touchend)['"`]/i.test(ctx)) continue;
      if (/\bon(?:click|submit|change|input|keydown|keyup|mousedown|mouseup|touchstart|touchend)\s*[:=]\s*(?:function|\([^)]*\)\s*=>)/i.test(ctx)) continue;

      let resolved: string;
      try {
        resolved = new URL(raw, baseUrl).href;
      } catch {
        continue;
      }

      if (resolved === baseUrl) continue;
      if (/\$\{|%24%7B|%7B/i.test(resolved)) continue;

      return resolved;
    }
  }
  return null;
}

async function fetchOnce(url: string): Promise<Response> {
  return await fetch(url, {
    headers: DEFAULT_HEADERS,
    redirect: "manual",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
}

/**
 * Walks the redirect chain for `url`, returning every hop along with the final
 * landed HTML. Pure function — no caching, no queue, no side effects.
 */
export async function detectRedirects(url: string): Promise<RedirectDetectionResult> {
  const chain: RedirectHop[] = [];
  const visited = new Set<string>();
  let current = url;
  let finalStatus = 0;
  let finalHtml = "";

  for (let i = 0; i < MAX_HOPS; i++) {
    // Loop detection — same URL appearing twice in the chain.
    if (visited.has(current)) {
      chain.push({ url: current, status: -1, type: "http", statusText: "Redirect loop detected" });
      break;
    }
    visited.add(current);

    let resp: Response;
    try {
      resp = await fetchOnce(current);
    } catch (e) {
      chain.push({
        url: current,
        status: 0,
        type: "http",
        statusText: e instanceof Error ? e.message : "Fetch failed",
      });
      break;
    }

    // 3xx → record hop, follow Location header.
    if (resp.status >= 300 && resp.status < 400) {
      const location = resp.headers.get("location");
      chain.push({ url: current, status: resp.status, type: "http" });
      // Drain the body so the connection can be reused.
      try { await resp.text(); } catch { /* ignore */ }

      if (!location) {
        // 3xx without Location — treat current as terminal.
        finalStatus = resp.status;
        break;
      }

      let next: string;
      try { next = new URL(location, current).href; } catch { next = location; }
      current = next;

      if (i === MAX_HOPS - 1) {
        chain.push({ url: current, status: -1, type: "http", statusText: "Max redirects exceeded" });
      }
      continue;
    }

    // Non-3xx → potentially terminal. Read body to check for meta-refresh / JS redirect.
    finalStatus = resp.status;
    try {
      finalHtml = await resp.text();
    } catch {
      finalHtml = "";
    }

    // Only meaningful when we successfully got HTML (status 200 typically).
    if (resp.status >= 200 && resp.status < 300 && finalHtml) {
      // 1) Meta-refresh first (it semantically wins over inline JS when present).
      const metaTarget = extractMetaRefreshTarget(finalHtml, current);
      if (metaTarget && metaTarget !== current && !visited.has(metaTarget)) {
        chain.push({ url: current, status: resp.status, type: "meta-refresh" });
        current = metaTarget;
        finalHtml = "";
        finalStatus = 0;

        if (i === MAX_HOPS - 1) {
          chain.push({ url: current, status: -1, type: "http", statusText: "Max redirects exceeded" });
        }
        continue;
      }

      // 2) Inline JS redirect (window.location / document.location patterns).
      const jsTarget = extractJsRedirectTarget(finalHtml, current);
      if (jsTarget && jsTarget !== current && !visited.has(jsTarget)) {
        chain.push({ url: current, status: resp.status, type: "javascript" });
        current = jsTarget;
        finalHtml = "";
        finalStatus = 0;

        if (i === MAX_HOPS - 1) {
          chain.push({ url: current, status: -1, type: "http", statusText: "Max redirects exceeded" });
        }
        continue;
      }
    }

    // Truly terminal — current is the final URL.
    break;
  }

  const httpHops = chain.filter((h) => h.type === "http" && h.status >= 300 && h.status < 400).length;
  const metaHops = chain.filter((h) => h.type === "meta-refresh").length;
  const jsHops = chain.filter((h) => h.type === "javascript").length;

  const distinctTypes = [httpHops > 0, metaHops > 0, jsHops > 0].filter(Boolean).length;

  let redirectType: RedirectKind = "none";
  if (distinctTypes > 1) redirectType = "mixed";
  else if (httpHops > 0) redirectType = "http";
  else if (metaHops > 0) redirectType = "meta-refresh";
  else if (jsHops > 0) redirectType = "javascript";

  return {
    initialUrl: url,
    finalUrl: current,
    redirectType,
    redirectChain: chain,
    hopCount: chain.length,
    finalHtml,
    finalStatus,
  };
}
