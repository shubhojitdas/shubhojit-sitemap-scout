const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function extractLocValues(xml: string, wrapperTag: string): string[] {
  // Matches <loc> values with or without CDATA wrappers
  const regex = new RegExp(
    `<${wrapperTag}>[\\s\\S]*?<loc>\\s*(?:<!\\[CDATA\\[)?\\s*(.*?)\\s*(?:\\]\\]>)?\\s*<\\/loc>[\\s\\S]*?<\\/${wrapperTag}>`,
    'gi'
  );
  const results: string[] = [];
  let match;
  while ((match = regex.exec(xml)) !== null) {
    const loc = match[1].replace(/&amp;/g, '&').trim();
    if (loc) results.push(loc);
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

async function parseSitemap(url: string, domain: string, visited: Set<string>): Promise<string[]> {
  if (visited.has(url)) return [];
  visited.add(url);

  const xml = await fetchSitemapXml(url);
  if (!xml) return [];

  const urls: string[] = [];

  // Check for sitemap index (nested sitemaps)
  const childSitemaps = extractLocValues(xml, 'sitemap');

  if (childSitemaps.length > 0) {
    // Fetch child sitemaps concurrently in batches of 5
    const BATCH = 5;
    for (let i = 0; i < childSitemaps.length; i += BATCH) {
      const batch = childSitemaps.slice(i, i + BATCH);
      const results = await Promise.all(
        batch.map((child) => parseSitemap(child, domain, visited))
      );
      for (const childUrls of results) {
        urls.push(...childUrls);
      }
      if (urls.length >= 50000) break;
    }
    return urls.slice(0, 50000);
  }

  // Regular sitemap - extract URLs
  const pageUrls = extractLocValues(xml, 'url');
  for (const loc of pageUrls) {
    try {
      const parsed = new URL(loc);
      if (parsed.hostname === domain || parsed.hostname.endsWith('.' + domain)) {
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
