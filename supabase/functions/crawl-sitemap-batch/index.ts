const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface CrawlResult {
  url: string;
  title: string;
  description: string;
  status: 'OK' | 'Error';
  statusCode: number;
  fetchTime: string;
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return '';
  return decodeHtmlEntities(match[1]).replace(/\s+/g, ' ').trim().slice(0, 100);
}

function extractDescription(html: string): string {
  // Try multiple patterns for meta description
  const patterns = [
    /<meta\s+name\s*=\s*["']description["']\s+content\s*=\s*["']([\s\S]*?)["']\s*\/?>/i,
    /<meta\s+content\s*=\s*["']([\s\S]*?)["']\s+name\s*=\s*["']description["']\s*\/?>/i,
    /<meta\s+name\s*=\s*["']description["']\s[^>]*content\s*=\s*["']([\s\S]*?)["'][^>]*\/?>/i,
    /<meta\s+content\s*=\s*["']([\s\S]*?)["']\s[^>]*name\s*=\s*["']description["'][^>]*\/?>/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      return decodeHtmlEntities(match[1]).replace(/\s+/g, ' ').trim().slice(0, 160);
    }
  }

  // Fallback: find all meta tags and check for description
  const metaTagRegex = /<meta\s([^>]+)>/gi;
  let metaMatch;
  while ((metaMatch = metaTagRegex.exec(html)) !== null) {
    const attrs = metaMatch[1];
    const nameMatch = attrs.match(/name\s*=\s*["']description["']/i);
    if (nameMatch) {
      const contentMatch = attrs.match(/content\s*=\s*["']([\s\S]*?)["']/i);
      if (contentMatch) {
        return decodeHtmlEntities(contentMatch[1]).replace(/\s+/g, ' ').trim().slice(0, 160);
      }
    }
  }

  return '';
}

async function fetchMeta(url: string): Promise<CrawlResult> {
  const start = Date.now();
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'SitemapCrawlerPro/1.0' },
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
    });
    const elapsed = ((Date.now() - start) / 1000).toFixed(1) + 's';

    if (!resp.ok) {
      return { url, title: '', description: '', status: 'Error', statusCode: resp.status, fetchTime: elapsed };
    }

    const html = await resp.text();
    const title = extractTitle(html);
    const description = extractDescription(html);

    return { url, title, description, status: 'OK', statusCode: resp.status, fetchTime: elapsed };
  } catch {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1) + 's';
    return { url, title: '', description: '', status: 'Error', statusCode: 0, fetchTime: elapsed };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { urls } = await req.json();

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return new Response(
        JSON.stringify({ error: 'urls array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process up to 10 URLs concurrently
    const batchSize = 10;
    const results: CrawlResult[] = [];

    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(fetchMeta));
      results.push(...batchResults);
    }

    return new Response(
      JSON.stringify({ results }),
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
