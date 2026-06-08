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
const NON_HTML_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|svg|ico|bmp|tiff|mp4|mp3|wav|avi|mov|webm|pdf|zip|rar|7z|tar|gz|exe|dmg|pkg|css|js|json|xml|woff2?|ttf|otf|eot)(\?|#|$)/i;

// SSRF guard: block private/loopback/link-local/metadata hosts.
function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === 'localhost' || h === '::1' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (/^(fc|fd)[0-9a-f]{2}:/i.test(h) || /^fe80:/i.test(h)) return true;
  return false;
}

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
    // Preserve the site's exact URL form. WordPress and many CMS sites publish
    // canonical trailing-slash URLs in their sitemaps; stripping the slash causes
    // every page to add a 301 hop, doubling requests and triggering false errors
    // on rate-sensitive hosts.
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

// ─── Sitemap auto-discovery & parsing ────────────────────────────────────

// Use a real browser User-Agent for sitemap/robots fetches — many hosts
// (Cloudflare, LiteSpeed/Hostinger, Sucuri, etc.) block requests whose UA
// contains "bot"/"crawler", returning 403 or HTML challenges even when the
// resource is public.
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const SITEMAP_FETCH_TIMEOUT_MS = 30_000;
const SITEMAP_FETCH_RETRIES = 3;

async function fetchText(url: string, label: string): Promise<string | null> {
  for (let attempt = 1; attempt <= SITEMAP_FETCH_RETRIES; attempt++) {
    try {
      const resp = await fetch(url, {
        headers: {
          'User-Agent': BROWSER_UA,
          'Accept': 'text/plain,application/xml,text/xml,application/xhtml+xml,text/html;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(SITEMAP_FETCH_TIMEOUT_MS),
      });
      if (!resp.ok) {
        console.log(`[${label}] ${url} → HTTP ${resp.status} (attempt ${attempt})`);
        if (resp.status >= 400 && resp.status < 500 && resp.status !== 429) return null;
      } else {
        const text = await resp.text();
        console.log(`[${label}] ${url} → ${resp.status} ${text.length}b`);
        return text;
      }
    } catch (err) {
      console.log(`[${label}] ${url} → error attempt ${attempt}: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (attempt < SITEMAP_FETCH_RETRIES) {
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
  return null;
}

function extractSitemapsFromRobots(robotsTxt: string): string[] {
  const out: string[] = [];
  const re = /^\s*Sitemap\s*:\s*(\S+)\s*$/gim;
  let m: RegExpExecArray | null;
  while ((m = re.exec(robotsTxt)) !== null) out.push(m[1].trim());
  return out;
}

function extractLocs(xml: string): string[] {
  const out: string[] = [];
  // Handle <loc>, <loc xmlns:...>, and CDATA-wrapped values.
  const re = /<loc\b[^>]*>\s*(?:<!\[CDATA\[\s*)?([^<\s\]]+)\s*(?:\]\]>)?\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(m[1].trim());
  return out;
}

async function discoverSitemapUrls(seed: URL, maxUrls: number): Promise<string[]> {
  const origin = `${seed.protocol}//${seed.host}`;
  const candidates: string[] = [];

  // Step 1: robots.txt → Sitemap: lines
  const robots = await fetchText(`${origin}/robots.txt`, 'robots');
  if (robots) {
    const fromRobots = extractSitemapsFromRobots(robots);
    if (fromRobots.length) console.log(`robots.txt declared sitemaps: ${fromRobots.join(', ')}`);
    candidates.push(...fromRobots);
  }

  // Always probe well-known fallbacks too (covers misconfigured robots.txt)
  for (const fallback of [
    `${origin}/sitemap_index.xml`,
    `${origin}/sitemap.xml`,
    `${origin}/wp-sitemap.xml`,
    `${origin}/sitemap-index.xml`,
  ]) {
    if (!candidates.includes(fallback)) candidates.push(fallback);
  }

  const collected = new Set<string>();
  const visitedSitemaps = new Set<string>();
  const queue: string[] = [];
  for (const c of candidates) if (!visitedSitemaps.has(c)) { visitedSitemaps.add(c); queue.push(c); }

  let foundAny = false;
  while (queue.length > 0 && collected.size < maxUrls) {
    const sm = queue.shift()!;
    const xml = await fetchText(sm, 'sitemap');
    if (!xml) continue;
    // Must look like XML/sitemap content
    if (!/<(sitemapindex|urlset|loc)\b/i.test(xml)) {
      console.log(`[sitemap] ${sm} did not contain sitemap markup, skipping`);
      continue;
    }
    const isIndex = /<sitemapindex[\s>]/i.test(xml);
    const locs = extractLocs(xml);
    console.log(`[sitemap] ${sm} → ${isIndex ? 'index' : 'urlset'} with ${locs.length} <loc> entries`);
    if (locs.length === 0) continue;
    foundAny = true;

    if (isIndex) {
      for (const loc of locs) {
        if (visitedSitemaps.has(loc)) continue;
        visitedSitemaps.add(loc);
        queue.push(loc);
      }
    } else {
      for (const loc of locs) {
        const norm = normalizeUrl(loc, seed);
        if (!norm) continue;
        const u = new URL(norm);
        if (!sameSite(u, seed)) continue;
        if (NON_HTML_EXTENSIONS.test(u.pathname)) continue;
        collected.add(norm);
        if (collected.size >= maxUrls) break;
      }
    }
  }

  if (!foundAny) console.log('No sitemap found for', origin);
  else console.log(`Sitemap discovery yielded ${collected.size} URLs`);
  return Array.from(collected);
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
    // Validate + SSRF guard
    const seedCheck = new URL(formatted);
    if (seedCheck.protocol !== 'http:' && seedCheck.protocol !== 'https:') {
      return new Response(JSON.stringify({ error: 'Only http/https URLs are allowed' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (isPrivateHost(seedCheck.hostname)) {
      return new Response(JSON.stringify({ error: 'Private or internal hosts are not allowed' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cap = Math.min(typeof maxUrls === 'number' && maxUrls > 0 ? maxUrls : MAX_URLS, MAX_URLS);
    console.log('Spidering site:', formatted, 'cap:', cap);
    const spideredUrls = await spider(formatted, cap);
    console.log(`Spider discovered ${spideredUrls.length} URLs via link-following`);

    // Merge with sitemap-discovered URLs (Screaming Frog parity)
    const seed = new URL(formatted);
    const sitemapUrls = await discoverSitemapUrls(seed, cap);

    const spideredSet = new Set(spideredUrls);
    const merged = new Set(spideredUrls);
    let orphanCount = 0;
    for (const u of sitemapUrls) {
      if (merged.size >= cap) break;
      if (!spideredSet.has(u)) {
        console.log(`sitemap-only URL (possible orphan): ${u}`);
        orphanCount++;
      }
      merged.add(u);
    }

    const urls = Array.from(merged).slice(0, cap);
    console.log(`Final merged total: ${urls.length} (sitemap-only orphans: ${orphanCount})`);

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
