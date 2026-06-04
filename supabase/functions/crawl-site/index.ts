// Breadth-first website spider — discovers internal URLs starting from a seed
// homepage URL by parsing <a href> links, mimicking Screaming Frog's discovery.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const USER_AGENT = 'Mozilla/5.0 (compatible; SitemapCrawlerPro/1.0)';
const MAX_URLS = 50000;
const CONCURRENCY = 8;
const FETCH_TIMEOUT_MS = 15000;
const SPIDER_TIMEOUT_MS = 25000;
const NON_HTML_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|svg|ico|bmp|tiff|mp4|mp3|wav|avi|mov|webm|pdf|zip|rar|7z|tar|gz|exe|dmg|pkg|css|js|json|xml|woff2?|ttf|otf|eot)(\?|#|$)/i;

function stripWww(hostname: string): string {
  return hostname.replace(/^www\./, '');
}

function sameSite(a: URL, b: URL): boolean {
  return stripWww(a.hostname) === stripWww(b.hostname);
}

function normalizeUrl(raw: string, base: URL): string | null {
  try {
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

function stripHtmlComments(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, '');
}

function extractHrefs(html: string): string[] {
  const hrefs: string[] = [];
  const cleanedHtml = stripHtmlComments(html);
  const re = /<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleanedHtml)) !== null) {
    const href = (m[1] ?? m[2] ?? m[3] ?? '').trim();
    if (!href) continue;
    if (href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
    hrefs.push(href);
  }
  return hrefs;
}

interface FetchResult {
  html: string | null;
  error?: string;
  blocked?: boolean;
}

async function fetchPageHtml(url: string): Promise<FetchResult> {
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html,application/xhtml+xml' },
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!resp.ok) {
      return { html: null, error: `HTTP ${resp.status}` };
    }
    const ct = resp.headers.get('content-type') ?? '';
    if (!/text\/html|application\/xhtml/i.test(ct)) {
      return { html: null, error: `non-html content-type: ${ct}` };
    }
    return { html: await resp.text() };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const blocked = /not in allowlist|host not allowed|forbidden host|network.*denied/i.test(msg);
    console.error(`[spider] fetch failed for ${url}: ${msg}`);
    return { html: null, error: msg, blocked };
  }
}

interface SpiderOutcome {
  urls: string[];
  blocked: boolean;
  blockedSample?: string;
}

async function spider(seedUrl: string, maxUrls: number, deadline: number): Promise<SpiderOutcome> {
  const seed = new URL(seedUrl);
  const discovered = new Set<string>();
  const queue: string[] = [];
  let blocked = false;
  let blockedSample: string | undefined;

  const seedNorm = normalizeUrl(seedUrl, seed);
  if (!seedNorm) return { urls: [], blocked: false };
  discovered.add(seedNorm);
  queue.push(seedNorm);

  while (queue.length > 0 && discovered.size < maxUrls) {
    if (Date.now() > deadline) {
      console.warn('[spider] deadline reached, returning partial results');
      break;
    }
    const batch = queue.splice(0, CONCURRENCY);
    let results: FetchResult[];
    try {
      results = await Promise.all(batch.map((u) => fetchPageHtml(u)));
    } catch (err) {
      console.error('[spider] batch error:', err);
      continue;
    }

    for (let i = 0; i < results.length; i++) {
      const { html, blocked: b, error } = results[i];
      if (b) {
        blocked = true;
        blockedSample = blockedSample ?? error;
      }
      if (!html) continue;
      let baseUrl: URL;
      try {
        baseUrl = new URL(batch[i]);
      } catch {
        continue;
      }
      const hrefs = extractHrefs(html);

      for (const href of hrefs) {
        const norm = normalizeUrl(href, baseUrl);
        if (!norm) continue;
        let parsed: URL;
        try { parsed = new URL(norm); } catch { continue; }
        if (!sameSite(parsed, seed)) continue;
        if (NON_HTML_EXTENSIONS.test(parsed.pathname)) continue;
        if (discovered.has(norm)) continue;
        discovered.add(norm);
        queue.push(norm);
        if (discovered.size >= maxUrls) break;
      }
      if (discovered.size >= maxUrls) break;
    }
  }

  return { urls: Array.from(discovered).slice(0, maxUrls), blocked, blockedSample };
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
    if (!formatted.startsWith('http')) formatted = 'https://' + formatted;
    new URL(formatted);

    const cap = Math.min(typeof maxUrls === 'number' && maxUrls > 0 ? maxUrls : MAX_URLS, MAX_URLS);
    console.log('Spidering site:', formatted, 'cap:', cap);

    const deadline = Date.now() + SPIDER_TIMEOUT_MS;
    let outcome: SpiderOutcome = { urls: [], blocked: false };
    try {
      outcome = await spider(formatted, cap, deadline);
    } catch (err) {
      console.error('[spider] fatal error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      return new Response(
        JSON.stringify({ error: `Crawler failed: ${msg}`, urls: [], total: 0 }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Discovered ${outcome.urls.length} URLs (blocked=${outcome.blocked})`);

    if (outcome.urls.length === 0 && outcome.blocked) {
      return new Response(
        JSON.stringify({
          error: 'This site is blocked by the crawler\'s network policy. The hosting environment does not allow outbound requests to this host. Please try a sitemap URL instead, or contact support.',
          urls: [],
          total: 0,
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (outcome.urls.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'No crawlable pages found. The site may be blocking bots, requiring JavaScript, or returning non-HTML responses. Try providing a sitemap URL instead.',
          urls: [],
          total: 0,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ urls: outcome.urls, total: outcome.urls.length, partial: outcome.blocked || undefined }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
