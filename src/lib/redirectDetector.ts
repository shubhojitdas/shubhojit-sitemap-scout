/**
 * Phase 1 — Redirect detection (HTTP + meta-refresh, no headless browser).
 *
 * Follows the redirect chain manually so each hop can be inspected. Meta-refresh
 * tags with a delay of 0–5s are treated as redirect hops, matching how search
 * engines interpret them.
 *
 * Phase 2 will extend this with headless rendering for JS / SPA redirects.
 */

export type RedirectHopType = "http" | "meta-refresh";

export type RedirectKind = "none" | "http" | "meta-refresh" | "mixed";

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

    // Non-3xx → potentially terminal. Read body to check for meta-refresh.
    finalStatus = resp.status;
    try {
      finalHtml = await resp.text();
    } catch {
      finalHtml = "";
    }

    // Only meaningful when we successfully got HTML (status 200 typically).
    if (resp.status >= 200 && resp.status < 300 && finalHtml) {
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
    }

    // Truly terminal — current is the final URL.
    break;
  }

  const httpHops = chain.filter((h) => h.type === "http" && h.status >= 300 && h.status < 400).length;
  const metaHops = chain.filter((h) => h.type === "meta-refresh").length;

  let redirectType: RedirectKind = "none";
  if (httpHops > 0 && metaHops > 0) redirectType = "mixed";
  else if (httpHops > 0) redirectType = "http";
  else if (metaHops > 0) redirectType = "meta-refresh";

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
