const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function parseSitemap(url: string, domain: string, visited: Set<string>): Promise<string[]> {
  if (visited.has(url)) return [];
  visited.add(url);

  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'SitemapCrawlerPro/1.0' },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) return [];
    const xml = await resp.text();

    const urls: string[] = [];

    // Check for sitemap index (nested sitemaps)
    const sitemapLocRegex = /<sitemap>\s*<loc>\s*(.*?)\s*<\/loc>/gs;
    let sitemapMatch;
    const childSitemaps: string[] = [];
    while ((sitemapMatch = sitemapLocRegex.exec(xml)) !== null) {
      childSitemaps.push(sitemapMatch[1].replace(/&amp;/g, '&').trim());
    }

    if (childSitemaps.length > 0) {
      for (const child of childSitemaps) {
        const childUrls = await parseSitemap(child, domain, visited);
        urls.push(...childUrls);
        if (urls.length >= 50000) break;
      }
      return urls.slice(0, 50000);
    }

    // Regular sitemap - extract URLs
    const urlLocRegex = /<url>\s*<loc>\s*(.*?)\s*<\/loc>/gs;
    let urlMatch;
    while ((urlMatch = urlLocRegex.exec(xml)) !== null) {
      const loc = urlMatch[1].replace(/&amp;/g, '&').trim();
      try {
        const parsed = new URL(loc);
        if (parsed.hostname === domain || parsed.hostname.endsWith('.' + domain)) {
          urls.push(loc);
        }
      } catch { /* skip */ }
      if (urls.length >= 50000) break;
    }

    return urls;
  } catch (e) {
    console.error(`Error parsing sitemap ${url}:`, e);
    return [];
  }
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
