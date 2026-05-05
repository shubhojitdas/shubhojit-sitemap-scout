// Breadth-first website spider — discovers internal URLs starting from a seed
// homepage URL by parsing <a href> links, mimicking Screaming Frog's discovery.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const MAX_URLS = 50000;
const CONCURRENCY = 8;
const FETCH_TIMEOUT_MS = 15000;
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
    // Strip trailing slash for consistency, except root
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

async function fetchPageHtml(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html,application/xhtml+xml' },
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!resp.ok) return null;
    const ct = resp.headers.get('content-type') ?? '';
    if (!/text\/html|application\/xhtml/i.test(ct)) return null;
    return await resp.text();
  } catch {
    return null;
  }
}

async function spider(seedUrl: string, maxUrls: number): Promise<string[]> {
  const seed = new URL(seedUrl);
  const discovered = new Set<string>();
  const queue: string[] = [];

  const seedNorm = normalizeUrl(seedUrl, seed);
  if (!seedNorm) return [];
  discovered.add(seedNorm);
  queue.push(seedNorm);

  while (queue.length > 0 && discovered.size < maxUrls) {
    const batch = queue.splice(0, CONCURRENCY);
    const results = await Promise.all(batch.map((u) => fetchPageHtml(u)));

    for (let i = 0; i < results.length; i++) {
      const html = results[i];
      if (!html) continue;
      const baseUrl = new URL(batch[i]);
      const hrefs = extractHrefs(html);

      for (const href of hrefs) {
        const norm = normalizeUrl(href, baseUrl);
        if (!norm) continue;
        const parsed = new URL(norm);
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

  return Array.from(discovered).slice(0, maxUrls);
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
    // Validate
    new URL(formatted);

    const cap = Math.min(typeof maxUrls === 'number' && maxUrls > 0 ? maxUrls : MAX_URLS, MAX_URLS);
    console.log('Spidering site:', formatted, 'cap:', cap);
    const urls = await spider(formatted, cap);
    console.log(`Discovered ${urls.length} URLs`);

    return new Response(JSON.stringify({ urls, total: urls.length }), {
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
