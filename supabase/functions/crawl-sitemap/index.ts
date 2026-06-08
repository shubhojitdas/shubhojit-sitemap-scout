const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function extractLocValues(xml: string, wrapperTag: string): string[] {
  // Matches <loc> values with or without CDATA wrappers, handles multiline and namespaced tags
  const results: string[] = [];

  // Strategy: find all <loc>...</loc> blocks within <wrapperTag>...</wrapperTag>
  const wrapperRegex = new RegExp(
    `<${wrapperTag}[^>]*>[\\s\\S]*?<\\/${wrapperTag}>`,
    'gi'
  );
  const locRegex = /<loc[^>]*>\s*(?:<!\[CDATA\[)?\s*([\s\S]*?)\s*(?:\]\]>)?\s*<\/loc>/i;

  let wrapperMatch;
  while ((wrapperMatch = wrapperRegex.exec(xml)) !== null) {
    const block = wrapperMatch[0];
    const locMatch = block.match(locRegex);
    if (locMatch && locMatch[1]) {
      const loc = locMatch[1].replace(/&amp;/g, '&').replace(/\s+/g, '').trim();
      if (loc) results.push(loc);
    }
  }
  return results;
}

async function fetchSitemapXml(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SitemapCrawlerPro/1.0)' },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) return null;
    return await resp.text();
  } catch {
    return null;
  }
}

function stripWww(hostname: string): string {
  return hostname.replace(/^www\./, '');
}

function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === 'localhost' || h === '::1' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (/^(fc|fd)[0-9a-f]{2}:/i.test(h) || /^fe80:/i.test(h)) return true;
  return false;
}

async function parseSitemap(url: string, domain: string, visited: Set<string>): Promise<string[]> {
  if (visited.has(url)) return [];
  visited.add(url);

  const xml = await fetchSitemapXml(url);
  if (!xml) return [];

  const urls: string[] = [];

  // Check for sitemap index (nested sitemaps)
  const childSitemaps = extractLocValues(xml, 'sitemap');

  if (childSitemaps.length > 0) {
    // Fetch ALL child sitemaps concurrently for speed
    const results = await Promise.all(
      childSitemaps.map((child) => parseSitemap(child, domain, visited))
    );
    for (const childUrls of results) {
      urls.push(...childUrls);
      if (urls.length >= 50000) break;
    }
    return urls.slice(0, 50000);
  }

  // Regular sitemap - extract URLs
  const baseDomain = stripWww(domain);
  const pageUrls = extractLocValues(xml, 'url');
  for (const loc of pageUrls) {
    try {
      const parsed = new URL(loc);
      const locDomain = stripWww(parsed.hostname);
      if (locDomain === baseDomain || locDomain.endsWith('.' + baseDomain)) {
        urls.push(loc);
      }
    } catch { /* skip */ }
    if (urls.length >= 50000) break;
  }

  return urls;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sitemapUrl } = await req.json();

    if (!sitemapUrl) {
      return new Response(
        JSON.stringify({ error: 'sitemapUrl is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let formattedUrl = sitemapUrl.trim();
    if (!formattedUrl.startsWith('http')) formattedUrl = 'https://' + formattedUrl;

    const parsedUrl = new URL(formattedUrl);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return new Response(JSON.stringify({ error: 'Only http/https URLs are allowed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (isPrivateHost(parsedUrl.hostname)) {
      return new Response(JSON.stringify({ error: 'Private or internal hosts are not allowed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const domain = parsedUrl.hostname;

    console.log('Parsing sitemap:', formattedUrl, 'domain:', domain);
    const urls = await parseSitemap(formattedUrl, domain, new Set());
    console.log(`Found ${urls.length} URLs`);

    return new Response(
      JSON.stringify({ urls, total: urls.length }),
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
