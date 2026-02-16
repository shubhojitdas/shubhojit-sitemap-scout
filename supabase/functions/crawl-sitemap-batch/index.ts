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

    let title = '';
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch) {
      title = titleMatch[1].replace(/\s+/g, ' ').trim().slice(0, 100);
    }

    let description = '';
    const descMatch = html.match(/<meta[^>]*name\s*=\s*["']description["'][^>]*content\s*=\s*["']([\s\S]*?)["'][^>]*\/?>/i)
      || html.match(/<meta[^>]*content\s*=\s*["']([\s\S]*?)["'][^>]*name\s*=\s*["']description["'][^>]*\/?>/i);
    if (descMatch) {
      description = descMatch[1].replace(/\s+/g, ' ').trim().slice(0, 160);
    }

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
