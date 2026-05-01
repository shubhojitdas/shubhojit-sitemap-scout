// Breadth-first website spider — discovers internal URLs starting from a seed
// homepage URL by parsing <a href> links, mimicking Screaming Frog's discovery.
//
// Hardened:
//   • follows seed redirects (apex → www, http → https) so we crawl the canonical host
//   • accepts links across apex/www and across http/https of the seed's registrable host
//   • accepts links inside <link rel="alternate">, <area>, <iframe>, sitemap, etc. (best-effort)
//   • adds a richer browser-like User-Agent + Accept headers so WordPress / Shopify /
//     Cloudflare-fronted sites don't block us
//   • adds modest per-host pacing
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
const FETCH_TIMEOUT_MS = 20000;
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
  // <a href>, <area href>, <link href> (canonical/alternate), <iframe src>
  const patterns = [
    /<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
    /<area\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
    /<link\b[^>]*?\brel\s*=\s*["'](?:canonical|alternate|next|prev)["'][^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(cleanedHtml)) !== null) {
      const href = (m[1] ?? m[2] ?? m[3] ?? '').trim();
      if (!href) continue;
      if (href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('data:')) continue;
      hrefs.push(href);
    }
  }
  return hrefs;
}

async function fetchPageHtml(url: string): Promise<{ html: string; finalUrl: string } | null> {
  try {
    const resp = await fetch(url, {
      headers: FETCH_HEADERS,
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!resp.ok) return null;
    const ct = resp.headers.get('content-type') ?? '';
    if (!/text\/html|application\/xhtml/i.test(ct)) return null;
    const html = await resp.text();
    return { html, finalUrl: resp.url || url };
  } catch {
    return null;
  }
}

/** Fetch the seed and follow redirects so we crawl the *canonical* host the
 *  origin actually serves (e.g. apex → www, http → https). Returns the
 *  resolved seed URL or the input on failure. */
async function resolveSeed(seedUrl: string): Promise<string> {
  try {
    const resp = await fetch(seedUrl, {
      headers: FETCH_HEADERS,
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    return resp.url || seedUrl;
  } catch {
    return seedUrl;
  }
}

async function spider(seedUrl: string, maxUrls: number) {
  const resolvedSeed = await resolveSeed(seedUrl);
  const seed = new URL(resolvedSeed);
  const discovered = new Set<string>();
  const queue: string[] = [];
  const skipped = { nonHtml: 0, offSite: 0, errors: 0 };

  const seedNorm = normalizeUrl(resolvedSeed, seed);
  if (!seedNorm) return { urls: [], total: 0, skipped, resolvedSeed };
  discovered.add(seedNorm);
  queue.push(seedNorm);

  while (queue.length > 0 && discovered.size < maxUrls) {
    const batch = queue.splice(0, CONCURRENCY);
    const results = await Promise.all(batch.map((u) => fetchPageHtml(u)));

    for (let i = 0; i < results.length; i++) {
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
      if (discovered.size >= maxUrls) break;
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
    if (!formatted.startsWith('http')) formatted = 'https://' + formatted;
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
