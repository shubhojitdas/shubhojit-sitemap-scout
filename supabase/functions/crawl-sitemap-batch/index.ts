const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ImageData {
  src: string;
  alt: string | null;
}

interface CrawlResult {
  url: string;
  title: string;
  description: string;
  h1s: string[];
  h2s: string[];
  h3s: string[];
  images?: ImageData[];
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
  return decodeHtmlEntities(match[1]).replace(/\s+/g, ' ').trim();
}

function extractDescription(html: string): string {
  const patterns = [
    /<meta\s+name\s*=\s*["']description["']\s+content\s*=\s*["']([\s\S]*?)["']\s*\/?>/i,
    /<meta\s+content\s*=\s*["']([\s\S]*?)["']\s+name\s*=\s*["']description["']\s*\/?>/i,
    /<meta\s+name\s*=\s*["']description["']\s[^>]*content\s*=\s*["']([\s\S]*?)["'][^>]*\/?>/i,
    /<meta\s+content\s*=\s*["']([\s\S]*?)["']\s[^>]*name\s*=\s*["']description["'][^>]*\/?>/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      return decodeHtmlEntities(match[1]).replace(/\s+/g, ' ').trim();
    }
  }

  const metaTagRegex = /<meta\s([^>]+)>/gi;
  let metaMatch;
  while ((metaMatch = metaTagRegex.exec(html)) !== null) {
    const attrs = metaMatch[1];
    const nameMatch = attrs.match(/name\s*=\s*["']description["']/i);
    if (nameMatch) {
      const contentMatch = attrs.match(/content\s*=\s*["']([\s\S]*?)["']/i);
      if (contentMatch) {
        return decodeHtmlEntities(contentMatch[1]).replace(/\s+/g, ' ').trim();
      }
    }
  }

  return '';
}

function extractH1s(html: string): string[] {
  const h1s: string[] = [];
  const h1Regex = /<h1[^>]*>([\s\S]*?)<\/h1>/gi;
  let match;
  while ((match = h1Regex.exec(html)) !== null) {
    const text = decodeHtmlEntities(match[1].replace(/<[^>]+>/g, ''))
      .replace(/\s+/g, ' ')
      .trim();
    if (text) h1s.push(text.slice(0, 200));
  }
  return h1s;
}

function extractH2s(html: string): string[] {
  const h2s: string[] = [];
  const h2Regex = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  let match;
  while ((match = h2Regex.exec(html)) !== null) {
    const text = decodeHtmlEntities(match[1].replace(/<[^>]+>/g, ''))
      .replace(/\s+/g, ' ')
      .trim();
    if (text) h2s.push(text.slice(0, 200));
  }
  return h2s;
}

function extractH3s(html: string): string[] {
  const h3s: string[] = [];
  const h3Regex = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  let match;
  while ((match = h3Regex.exec(html)) !== null) {
    const text = decodeHtmlEntities(match[1].replace(/<[^>]+>/g, ''))
      .replace(/\s+/g, ' ')
      .trim();
    if (text) h3s.push(text.slice(0, 200));
  }
  return h3s;
}

function extractImages(html: string, baseUrl: string): ImageData[] {
  const images: ImageData[] = [];
  // Match <img> tags and capture src + optional alt
  const imgRegex = /<img\s([^>]+)>/gi;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    const attrs = match[1];

    // Extract src
    const srcMatch = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    if (!srcMatch) continue;
    let src = srcMatch[1].trim();

    // Resolve relative URLs
    if (src.startsWith('//')) {
      try {
        const base = new URL(baseUrl);
        src = base.protocol + src;
      } catch { /* keep as-is */ }
    } else if (src.startsWith('/')) {
      try {
        const base = new URL(baseUrl);
        src = base.origin + src;
      } catch { /* keep as-is */ }
    } else if (!src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('data:')) {
      try {
        src = new URL(src, baseUrl).href;
      } catch { /* keep as-is */ }
    }

    // Skip data URIs (inline images)
    if (src.startsWith('data:')) continue;

    // Extract alt
    const altMatch = attrs.match(/\balt\s*=\s*["']([^"']*)["']/i);
    const alt = altMatch ? decodeHtmlEntities(altMatch[1]).replace(/\s+/g, ' ').trim() : null;

    images.push({ src, alt: alt !== null && alt.length > 0 ? alt : null });
  }
  return images;
}

async function fetchMeta(url: string, includeH1: boolean, includeH2: boolean, includeH3: boolean, includeImages: boolean): Promise<CrawlResult> {
  const start = Date.now();
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'SitemapCrawlerPro/1.0' },
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
    });
    const elapsed = ((Date.now() - start) / 1000).toFixed(1) + 's';

    if (!resp.ok) {
      return { url, title: '', description: '', h1s: [], h2s: [], h3s: [], images: [], status: 'Error', statusCode: resp.status, fetchTime: elapsed };
    }

    const html = await resp.text();
    const title = extractTitle(html);
    const description = extractDescription(html);
    const h1s = includeH1 ? extractH1s(html) : [];
    const h2s = includeH2 ? extractH2s(html) : [];
    const h3s = includeH3 ? extractH3s(html) : [];
    const images = includeImages ? extractImages(html, url) : [];

    return { url, title, description, h1s, h2s, h3s, images, status: 'OK', statusCode: resp.status, fetchTime: elapsed };
  } catch {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1) + 's';
    return { url, title: '', description: '', h1s: [], h2s: [], h3s: [], images: [], status: 'Error', statusCode: 0, fetchTime: elapsed };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { urls, includeH1 = false, includeH2 = false, includeH3 = false, includeImages = false } = await req.json();

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return new Response(
        JSON.stringify({ error: 'urls array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const batchSize = 10;
    const results: CrawlResult[] = [];

    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map((url: string) => fetchMeta(url, includeH1, includeH2, includeH3, includeImages)));
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
