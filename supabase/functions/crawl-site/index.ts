// Breadth-first website spider — discovers internal URLs starting from a seed
// homepage URL by parsing real HTML links, with sitemap seeding and strict time
// budgets so slow WordPress / PHP / page-builder sites return usable results
// instead of timing out the Edge Function.
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
const CONCURRENCY = 5;
const FETCH_TIMEOUT_MS = 6500;
const SITEMAP_TIMEOUT_MS = 4500;
const SPIDER_TIME_BUDGET_MS = 26000;
const NON_HTML_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|svg|ico|bmp|tiff|mp4|mp3|wav|avi|mov|webm|pdf|zip|rar|7z|tar|gz|exe|dmg|pkg|css|js|json|woff2?|ttf|otf|eot)(\?|#|$)/i;

function stripWww(hostname: string): string {
  return hostname.replace(/^www\./, '');
}

function sameSite(a: URL, b: URL): boolean {
  return stripWww(a.hostname) === stripWww(b.hostname);
}

function normalizeUrl(raw: string, base: URL): string | null {
  try {
    if (isLikelyTemplateUrl(raw)) return null;
    const u = new URL(raw, base);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
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

async function fetchWithFallback(url: string, timeoutMs: number, redirect: RequestRedirect = 'follow'): Promise<Response | null> {
  let attempts = [url];
  try {
    const parsed = new URL(url);
    attempts = originVariants(parsed);
  } catch { /* keep single attempt */ }

  for (const attempt of attempts) {
    try {
      const resp = await fetch(attempt, {
        headers: FETCH_HEADERS,
        redirect,
        signal: AbortSignal.timeout(timeoutMs),
      });
      return resp;
    } catch (error) {
      console.warn('Fetch failed:', attempt, error instanceof Error ? error.message : error);
    }
  }
  return null;
}

async function fetchPageHtml(url: string): Promise<{ html: string; finalUrl: string } | null> {
  const resp = await fetchWithFallback(url, FETCH_TIMEOUT_MS, 'follow');
  if (!resp || !resp.ok) return null;
  const ct = resp.headers.get('content-type') ?? '';
  if (!/text\/html|application\/xhtml/i.test(ct)) return null;
  const html = await resp.text();
  return { html, finalUrl: resp.url || url };
}

async function resolveSeed(seedUrl: string): Promise<string> {
  const resp = await fetchWithFallback(seedUrl, FETCH_TIMEOUT_MS, 'follow');
  return resp?.url || seedUrl;
}

function candidateSitemaps(seed: URL): string[] {
  const paths = ['/sitemap.xml', '/sitemap_index.xml', '/wp-sitemap.xml', '/sitemap-index.xml', '/post-sitemap.xml', '/page-sitemap.xml'];
  return originVariants(seed).flatMap((originLike) => {
    const u = new URL(originLike);
    return paths.map((path) => `${u.protocol}//${u.host}${path}`);
  });
}

async function discoverSitemaps(seed: URL): Promise<string[]> {
  const urls = new Set<string>(candidateSitemaps(seed));
  try {
    const robotsUrl = `${seed.origin}/robots.txt`;
    const resp = await fetchWithFallback(robotsUrl, SITEMAP_TIMEOUT_MS, 'follow');
    if (resp?.ok) {
      const robots = await resp.text();
      for (const line of robots.split(/\r?\n/)) {
        const match = line.match(/^\s*sitemap\s*:\s*(\S+)/i);
        if (match?.[1]) urls.add(match[1].trim());
      }
    }
  } catch { /* robots is optional */ }
  return Array.from(urls);
}

async function parseSitemap(url: string, seed: URL, visited: Set<string>, out: Set<string>, maxUrls: number, deadline: number): Promise<void> {
  if (Date.now() > deadline || visited.has(url) || out.size >= maxUrls) return;
  visited.add(url);

  const resp = await fetchWithFallback(url, SITEMAP_TIMEOUT_MS, 'follow');
  if (!resp || !resp.ok) return;
  const xml = await resp.text();

  const childSitemaps = extractLocValues(xml, 'sitemap').slice(0, 80);
  for (const child of childSitemaps) {
    if (Date.now() > deadline || out.size >= maxUrls) break;
    await parseSitemap(child, seed, visited, out, maxUrls, deadline);
  }

  const pageUrls = extractLocValues(xml, 'url');
  for (const loc of pageUrls) {
    if (out.size >= maxUrls) break;
    const norm = normalizeUrl(loc, seed);
    if (!norm) continue;
    try {
      const parsed = new URL(norm);
      if (!sameSite(parsed, seed)) continue;
      if (NON_HTML_EXTENSIONS.test(parsed.pathname)) continue;
      out.add(norm);
    } catch { /* skip */ }
  }
}

async function seedFromSitemaps(seed: URL, maxUrls: number, deadline: number): Promise<string[]> {
  const urls = new Set<string>();
  const visited = new Set<string>();
  const sitemaps = await discoverSitemaps(seed);
  for (const sitemap of sitemaps) {
    if (Date.now() > deadline || urls.size >= maxUrls) break;
    await parseSitemap(sitemap, seed, visited, urls, maxUrls, deadline);
  }
  return Array.from(urls).slice(0, maxUrls);
}

async function spider(seedUrl: string, maxUrls: number) {
  const started = Date.now();
  const deadline = started + SPIDER_TIME_BUDGET_MS;
  const resolvedSeed = await resolveSeed(seedUrl);
  const seed = new URL(resolvedSeed);
  const discovered = new Set<string>();
  const queue: string[] = [];
  const skipped = { nonHtml: 0, offSite: 0, errors: 0, timedOut: false, sitemapSeeded: 0 };

  const seedNorm = normalizeUrl(resolvedSeed, seed);
  if (!seedNorm) return { urls: [], total: 0, skipped, resolvedSeed };
  discovered.add(seedNorm);
  queue.push(seedNorm);

  // Fast path for CMS / PHP sites: seed with sitemap URLs first, then continue
  // HTML spidering as time allows. This keeps Domain Crawl useful for sites
  // with huge menus, slow WooCommerce pages, or expired HTTPS certs.
  const sitemapUrls = await seedFromSitemaps(seed, maxUrls, Math.min(deadline, started + 16000));
  for (const u of sitemapUrls) {
    if (discovered.size >= maxUrls) break;
    if (!discovered.has(u)) {
      discovered.add(u);
      queue.push(u);
    }
  }
  skipped.sitemapSeeded = sitemapUrls.length;

  while (queue.length > 0 && discovered.size < maxUrls) {
    if (Date.now() > deadline) { skipped.timedOut = true; break; }

    const batch = queue.splice(0, CONCURRENCY);
    const results = await Promise.all(batch.map((u) => fetchPageHtml(u)));

    for (let i = 0; i < results.length; i++) {
      if (Date.now() > deadline || discovered.size >= maxUrls) break;
      const res = results[i];
      if (!res) { skipped.errors++; continue; }
      const baseUrl = new URL(res.finalUrl || batch[i]);
      const hrefs = extractHrefs(res.html);

      for (const href of hrefs) {
        const norm = normalizeUrl(href, baseUrl);
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
