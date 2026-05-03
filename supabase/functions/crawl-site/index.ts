// Breadth-first website spider — discovers internal URLs like Screaming Frog:
// parse HTML <a> tags from the homepage, follow every internal link recursively.
// Sitemap seeding runs in parallel (not blocking HTML discovery).
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 SitemapScout/1.0 (+https://shubhojit-sitemap-scout.lovable.app)';
const FETCH_HEADERS = {
  'User-Agent': USER_AGENT,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
};

const MAX_URLS = 50000;
const CONCURRENCY = 6;
const FETCH_TIMEOUT_MS = 6000;
const SITEMAP_TIMEOUT_MS = 3000;
const SPIDER_TIME_BUDGET_MS = 27000; // leave 3s margin for Edge Function 30s limit
const NON_HTML_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|svg|ico|bmp|tiff|mp4|mp3|wav|avi|mov|webm|pdf|zip|rar|7z|tar|gz|exe|dmg|pkg|css|js|json|woff2?|ttf|otf|eot)(\?|#|$)/i;

function stripWww(hostname: string): string {
  return hostname.replace(/^www\./, '');
}

function sameSite(a: URL, b: URL): boolean {
  return stripWww(a.hostname) === stripWww(b.hostname);
}

function normalizeUrl(raw: string, base: URL, preferredOrigin?: URL): string | null {
  try {
    if (isLikelyTemplateUrl(raw)) return null;
    const u = new URL(raw, base);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (preferredOrigin && sameSite(u, preferredOrigin)) {
      u.protocol = preferredOrigin.protocol;
      u.hostname = preferredOrigin.hostname;
      u.port = preferredOrigin.port;
    }
    u.hash = '';
    if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.toString();
  } catch {
    return null;
  }
}

function isLikelyTemplateUrl(raw: string): boolean {
  return /\$\{|\{\{|\}\}|<%|%>|\+\s*['"]|['"]\s*\+|\[["'][^\]]+["']\]|\bundefined\b|\bnull\b/i.test(raw);
}

function originVariants(input: URL): string[] {
  const host = stripWww(input.hostname);
  const hosts = input.hostname.startsWith('www.') ? [input.hostname, host] : [input.hostname, `www.${host}`];
  const protocols = input.protocol === 'http:' ? ['http:', 'https:'] : ['https:', 'http:'];
  const variants: string[] = [];
  for (const protocol of protocols) {
    for (const hostname of hosts) {
      const u = new URL(input.toString());
      u.protocol = protocol;
      u.hostname = hostname;
      variants.push(u.toString());
    }
  }
  return Array.from(new Set(variants));
}

// Once we know which origin works, reuse it for all subsequent fetches
let resolvedOrigin: URL | null = null;

function stripHtmlComments(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, '');
}

function extractHrefs(html: string): string[] {
  const hrefs: string[] = [];
  const cleanedHtml = stripHtmlComments(html);
  const patterns = [
    /<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
    /<area\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
    /<link\b[^>]*?\brel\s*=\s*["'](?:canonical|alternate|next|prev)["'][^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
    /<iframe\b[^>]*?\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(cleanedHtml)) !== null) {
      const href = (m[1] ?? m[2] ?? m[3] ?? '').trim();
      if (!href) continue;
      if (/^(javascript:|mailto:|tel:|data:|sms:|whatsapp:)/i.test(href)) continue;
      hrefs.push(href);
    }
  }
  return hrefs;
}

function extractLocValues(xml: string, wrapperTag: 'url' | 'sitemap'): string[] {
  const results: string[] = [];
  const wrapperRegex = new RegExp(`<${wrapperTag}[^>]*>[\\s\\S]*?<\\/${wrapperTag}>`, 'gi');
  const locRegex = /<loc[^>]*>\s*(?:<!\[CDATA\[)?\s*([\s\S]*?)\s*(?:\]\]>)?\s*<\/loc>/i;
  let wrapperMatch: RegExpExecArray | null;
  while ((wrapperMatch = wrapperRegex.exec(xml)) !== null) {
    const locMatch = wrapperMatch[0].match(locRegex);
    const loc = locMatch?.[1]?.replace(/&amp;/g, '&').replace(/\s+/g, '').trim();
    if (loc) results.push(loc);
  }
  return results;
}

async function fetchUrl(url: string, timeoutMs: number, redirect: RequestRedirect = 'follow'): Promise<Response | null> {
  try {
    const resp = await fetch(url, {
      headers: FETCH_HEADERS,
      redirect,
      signal: AbortSignal.timeout(timeoutMs),
    });
    // Learn the working origin from the first successful fetch
    if (!resolvedOrigin) {
      try {
        resolvedOrigin = new URL(resp.url || url);
      } catch { /* ignore */ }
    }
    return resp;
  } catch {
    return null;
  }
}

// Fetch and consume body to avoid resource leaks on probe requests
async function probeUrl(url: string, timeoutMs: number): Promise<string | null> {
  const resp = await fetchUrl(url, timeoutMs, 'follow');
  if (resp) {
    try { await resp.text(); } catch { /* drain */ }
    return resp.url || url;
  }
  return null;
}

async function fetchWithOriginFallback(url: string, timeoutMs: number, redirect: RequestRedirect = 'follow'): Promise<Response | null> {
  // If we already know the working origin, just use it
  if (resolvedOrigin) {
    try {
      const u = new URL(url);
      if (sameSite(u, resolvedOrigin)) {
        u.protocol = resolvedOrigin.protocol;
        u.hostname = resolvedOrigin.hostname;
        u.port = resolvedOrigin.port;
        const resp = await fetchUrl(u.toString(), timeoutMs, redirect);
        if (resp) return resp;
      }
    } catch { /* fall through */ }
  }

  // Try origin variants for the seed/first request
  const parsed = new URL(url);
  const variants = originVariants(parsed);
  for (const v of variants) {
    const resp = await fetchUrl(v, timeoutMs, redirect);
    if (resp) return resp;
  }
  return null;
}

async function fetchPageHtml(url: string, useVariants = false): Promise<{ html: string; finalUrl: string } | null> {
  const resp = useVariants
    ? await fetchWithOriginFallback(url, FETCH_TIMEOUT_MS, 'follow')
    : await fetchUrl(resolvedOrigin ? normalizeToOrigin(url) : url, FETCH_TIMEOUT_MS, 'follow');
  if (!resp || !resp.ok) {
    // Drain body to avoid resource leaks
    try { await resp?.text(); } catch { /* drain */ }
    return null;
  }
  const ct = resp.headers.get('content-type') ?? '';
  if (!/text\/html|application\/xhtml/i.test(ct)) {
    try { await resp.text(); } catch { /* drain */ }
    return null;
  }
  const html = await resp.text();
  return { html, finalUrl: resp.url || url };
}

function normalizeToOrigin(url: string): string {
  if (!resolvedOrigin) return url;
  try {
    const u = new URL(url);
    if (sameSite(u, resolvedOrigin)) {
      u.protocol = resolvedOrigin.protocol;
      u.hostname = resolvedOrigin.hostname;
      u.port = resolvedOrigin.port;
    }
    return u.toString();
  } catch { return url; }
}

// --- Sitemap discovery (runs in background, feeds URLs into shared set) ---

function candidateSitemaps(seed: URL): string[] {
  const paths = ['/sitemap.xml', '/sitemap_index.xml', '/wp-sitemap.xml', '/sitemap-index.xml', '/post-sitemap.xml', '/page-sitemap.xml'];
  return paths.map((path) => `${seed.protocol}//${seed.host}${path}`);
}

async function sitemapWorker(seed: URL, discovered: Set<string>, queue: string[], maxUrls: number, deadline: number): Promise<number> {
  let count = 0;
  const visited = new Set<string>();

  // Check robots.txt for sitemaps
  const sitemapUrls = new Set<string>(candidateSitemaps(seed));
  try {
    const robotsUrl = `${seed.origin}/robots.txt`;
    const resp = await fetchUrl(robotsUrl, SITEMAP_TIMEOUT_MS, 'follow');
    if (resp?.ok) {
      const robots = await resp.text();
      for (const line of robots.split(/\r?\n/)) {
        const match = line.match(/^\s*sitemap\s*:\s*(\S+)/i);
        if (match?.[1]) sitemapUrls.add(match[1].trim());
      }
    }
  } catch { /* optional */ }

  const parseSitemap = async (url: string): Promise<void> => {
    if (Date.now() > deadline || visited.has(url) || discovered.size >= maxUrls) return;
    visited.add(url);
    const resp = await fetchUrl(url, SITEMAP_TIMEOUT_MS, 'follow');
    if (!resp || !resp.ok) return;
    const xml = await resp.text();

    // Recurse into child sitemaps
    const children = extractLocValues(xml, 'sitemap').slice(0, 50);
    for (const child of children) {
      if (Date.now() > deadline || discovered.size >= maxUrls) break;
      await parseSitemap(child);
    }

    // Extract page URLs
    const pageUrls = extractLocValues(xml, 'url');
    for (const loc of pageUrls) {
      if (discovered.size >= maxUrls) break;
      const norm = normalizeUrl(loc, seed, seed);
      if (!norm) continue;
      try {
        const parsed = new URL(norm);
        if (!sameSite(parsed, seed)) continue;
        if (NON_HTML_EXTENSIONS.test(parsed.pathname)) continue;
        if (!discovered.has(norm)) {
          discovered.add(norm);
          queue.push(norm);
          count++;
        }
      } catch { /* skip */ }
    }
  };

  for (const sm of sitemapUrls) {
    if (Date.now() > deadline || discovered.size >= maxUrls) break;
    await parseSitemap(sm);
  }
  return count;
}

// --- Main spider: breadth-first HTML link crawling (Screaming Frog style) ---

async function spider(seedUrl: string, maxUrls: number) {
  const started = Date.now();
  const deadline = started + SPIDER_TIME_BUDGET_MS;

  // Resolve seed by fetching homepage HTML directly (no wasted request)
  const seedResult = await fetchPageHtml(seedUrl, true);
  const resolvedSeed = seedResult?.finalUrl || seedUrl;
  const seed = new URL(resolvedSeed);
  const discovered = new Set<string>();
  const queue: string[] = [];
  const visited = new Set<string>(); // pages we've fetched HTML from
  const skipped = { nonHtml: 0, offSite: 0, errors: 0, timedOut: false, sitemapSeeded: 0 };

  const seedNorm = normalizeUrl(resolvedSeed, seed, seed);
  if (!seedNorm) return { urls: [], total: 0, skipped, resolvedSeed };
  discovered.add(seedNorm);
  visited.add(seedNorm);

  // Extract links from the homepage immediately (already fetched)
  if (seedResult) {
    const baseUrl = new URL(seedResult.finalUrl);
    const hrefs = extractHrefs(seedResult.html);
    for (const href of hrefs) {
      const norm = normalizeUrl(href, baseUrl, seed);
      if (!norm) continue;
      let parsed: URL;
      try { parsed = new URL(norm); } catch { continue; }
      if (!sameSite(parsed, seed)) { skipped.offSite++; continue; }
      if (NON_HTML_EXTENSIONS.test(parsed.pathname)) { skipped.nonHtml++; continue; }
      if (!discovered.has(norm)) {
        discovered.add(norm);
        queue.push(norm);
      }
    }
  }

  // Start sitemap discovery in parallel — it adds URLs to the same queue
  const sitemapPromise = sitemapWorker(seed, discovered, queue, maxUrls, Math.min(deadline, started + 12000))
    .then(n => { skipped.sitemapSeeded = n; })
    .catch(() => {});

  // Breadth-first HTML spidering — the core Screaming Frog approach
  while (Date.now() < deadline && discovered.size < maxUrls) {
    if (queue.length === 0) {
      // Wait briefly for sitemap worker to feed URLs, then check again
      await new Promise(r => setTimeout(r, 100));
      if (queue.length === 0) break;
    }

    const batch = queue.splice(0, CONCURRENCY).filter(u => !visited.has(u));
    if (batch.length === 0) continue;
    for (const u of batch) visited.add(u);

    const results = await Promise.all(batch.map(u => fetchPageHtml(u)));

    for (let i = 0; i < results.length; i++) {
      if (Date.now() > deadline || discovered.size >= maxUrls) break;
      const res = results[i];
      if (!res) { skipped.errors++; continue; }
      const baseUrl = new URL(res.finalUrl || batch[i]);
      const hrefs = extractHrefs(res.html);

      for (const href of hrefs) {
        const norm = normalizeUrl(href, baseUrl, seed);
        if (!norm) continue;
        let parsed: URL;
        try { parsed = new URL(norm); } catch { continue; }
        if (!sameSite(parsed, seed)) { skipped.offSite++; continue; }
        if (NON_HTML_EXTENSIONS.test(parsed.pathname)) { skipped.nonHtml++; continue; }
        if (discovered.has(norm)) continue;
        discovered.add(norm);
        queue.push(norm);
        if (discovered.size >= maxUrls) break;
      }
    }
  }

  if (Date.now() >= deadline) skipped.timedOut = true;

  // Ensure sitemap worker finishes
  await sitemapPromise;

  return {
    urls: Array.from(discovered).slice(0, maxUrls),
    total: discovered.size,
    skipped,
    resolvedSeed,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Reset per-request state
  resolvedOrigin = null;

  try {
    const { siteUrl, maxUrls } = await req.json();
    if (!siteUrl || typeof siteUrl !== 'string') {
      return new Response(JSON.stringify({ error: 'siteUrl is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let formatted = siteUrl.trim();
    if (!/^https?:\/\//i.test(formatted)) formatted = 'https://' + formatted;
    new URL(formatted);

    const cap = Math.min(typeof maxUrls === 'number' && maxUrls > 0 ? maxUrls : MAX_URLS, MAX_URLS);
    console.log('Spidering site:', formatted, 'cap:', cap);
    const { urls, total, skipped, resolvedSeed } = await spider(formatted, cap);
    console.log(`Discovered ${urls.length} URLs (resolved seed: ${resolvedSeed}; skipped:`, skipped, ')');

    return new Response(JSON.stringify({ urls, total, skipped, resolvedSeed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
