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
  /** Short snippet from the source (meta tag or JS statement) that triggered detection. */
  source?: string;
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
 * Only scans inside <script>…</script>. Does not execute JS.
 */
/**
 * Strip event-handler callback bodies (addEventListener, jQuery .on/.one/.bind/
 * .live/.delegate, inline `onEvent = fn`) using brace matching that respects
 * strings, template literals, and regex literals. Any `location.*` assignment
 * left after this is a real page-load redirect candidate.
 */
function stripEventHandlerBodies(src: string): string {
  const openers: RegExp[] = [
    /addEventListener\s*\(\s*['"`][^'"`]+['"`]\s*,\s*(?:async\s+)?(?:function\b[^{]*|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)\s*\{/gi,
    /\.(?:on|one|bind|live|delegate)\s*\(\s*['"`][^'"`]+['"`]\s*,\s*(?:async\s+)?(?:function\b[^{]*|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)\s*\{/gi,
    /\bon[a-z]+\s*=\s*(?:async\s+)?(?:function\b[^{]*|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)\s*\{/gi,
  ];
  const ranges: Array<[number, number]> = [];
  for (const re of openers) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      const openIdx = re.lastIndex - 1;
      const end = findMatchingBrace(src, openIdx);
      if (end === -1) continue;
      ranges.push([openIdx + 1, end]);
    }
  }
  if (!ranges.length) return src;
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  let out = "";
  let cursor = 0;
  for (const [s, e] of merged) { out += src.slice(cursor, s); cursor = e; }
  out += src.slice(cursor);
  return out;
}

function findMatchingBrace(src: string, openIdx: number): number {
  let depth = 0;
  let i = openIdx;
  let inStr: '"' | "'" | "`" | null = null;
  let inRegex = false;
  const tplStack: number[] = [];
  while (i < src.length) {
    const c = src[i];
    if (inStr) {
      if (c === "\\") { i += 2; continue; }
      if (inStr === "`" && c === "$" && src[i + 1] === "{") {
        tplStack.push(depth); inStr = null; i += 2; depth++; continue;
      }
      if (c === inStr) inStr = null;
      i++; continue;
    }
    if (inRegex) {
      if (c === "\\") { i += 2; continue; }
      if (c === "/") inRegex = false;
      i++; continue;
    }
    if (c === '"' || c === "'" || c === "`") { inStr = c as '"' | "'" | "`"; i++; continue; }
    if (c === "/" && src[i + 1] === "/") { const nl = src.indexOf("\n", i); if (nl === -1) return -1; i = nl + 1; continue; }
    if (c === "/" && src[i + 1] === "*") { const cl = src.indexOf("*/", i + 2); if (cl === -1) return -1; i = cl + 2; continue; }
    if (c === "/") {
      const p = src.slice(Math.max(0, i - 8), i).replace(/\s+$/, "").slice(-1);
      if (p && /[=(,;:!&|?{}\[\]]/.test(p)) { inRegex = true; i++; continue; }
    }
    if (c === "{") { depth++; i++; continue; }
    if (c === "}") {
      depth--;
      if (tplStack.length && depth === tplStack[tplStack.length - 1]) {
        tplStack.pop(); inStr = "`"; i++; continue;
      }
      if (depth === 0) return i;
      i++; continue;
    }
    i++;
  }
  return -1;
}

export function extractJsRedirectTarget(html: string, baseUrl: string): string | null {
  const noComments = html.replace(/<!--[\s\S]*?-->/g, "");
  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  const JS_REDIRECT_REGEX =
    /(?:window\.|document\.|top\.|self\.|parent\.)?location(?:\.href|\.replace|\.assign)?\s*(?:=|\()\s*(['"`])([^'"`]+)\1/gi;

  let scriptMatch: RegExpExecArray | null;
  while ((scriptMatch = scriptRegex.exec(noComments)) !== null) {
    const body = scriptMatch[1];
    if (!body || !body.trim()) continue;

    let cleanedBody = body
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/[^\n\r]*/g, "$1");
    cleanedBody = stripEventHandlerBodies(cleanedBody);

    JS_REDIRECT_REGEX.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = JS_REDIRECT_REGEX.exec(cleanedBody)) !== null) {
      const quote = m[1];
      const raw = m[2].trim();
      if (!raw || raw === "#" || raw.startsWith("#")) continue;
      if (raw.startsWith("javascript:")) continue;
      if (quote === "`" && /\$\{/.test(raw)) continue;
      if (/\{\{[^}]*\}\}/.test(raw)) continue;
      if (/\$\{|%24%7B|%7B[^/]*%7D/i.test(raw)) continue;

      const ctxStart = Math.max(0, m.index - 400);
      const ctx = cleanedBody.slice(ctxStart, m.index);
      if (/\b(?:function|async\s+function)\s*\([^)]*\b(?:e|ev|evt|event)\b[^)]*\)\s*\{[^}]*$/i.test(ctx)) continue;

      let resolved: string;
      try { resolved = new URL(raw, baseUrl).href; } catch { continue; }
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
