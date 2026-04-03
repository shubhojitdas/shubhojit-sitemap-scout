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
  schemas?: string[];
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
  // Strategy: find all <meta> tags, check for name="description", extract content robustly
  const metaTagRegex = /<meta\s([^>]+?)\/?>/gi;
  let metaMatch;
  while ((metaMatch = metaTagRegex.exec(html)) !== null) {
    const attrs = metaMatch[1];
    // Check if this meta tag has name="description"
    const nameMatch = attrs.match(/\bname\s*=\s*["']description["']/i);
    if (!nameMatch) continue;

    // Extract content attribute — handle both single and double quotes
    // Try double quotes first
    let contentMatch = attrs.match(/\bcontent\s*=\s*"([^"]*)"/i);
    if (!contentMatch) {
      // Try single quotes
      contentMatch = attrs.match(/\bcontent\s*=\s*'([^']*)'/i);
    }
    if (contentMatch && contentMatch[1]) {
      return decodeHtmlEntities(contentMatch[1]).replace(/\s+/g, ' ').trim();
    }
  }
  return '';
}

function extractHeadings(html: string, tag: string): string[] {
  const headings: string[] = [];
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  let match;
  while ((match = regex.exec(html)) !== null) {
    const text = decodeHtmlEntities(match[1].replace(/<[^>]+>/g, ''))
      .replace(/\s+/g, ' ')
      .trim();
    if (text) headings.push(text.slice(0, 200));
  }
  return headings;
}

function extractMetaRobots(html: string): string {
  const metaTagRegex = /<meta\s([^>]+?)\/?>/gi;
  let metaMatch;
  while ((metaMatch = metaTagRegex.exec(html)) !== null) {
    const attrs = metaMatch[1];
    const nameMatch = attrs.match(/\bname\s*=\s*["']robots["']/i);
    if (!nameMatch) continue;
    let contentMatch = attrs.match(/\bcontent\s*=\s*"([^"]*)"/i);
    if (!contentMatch) {
      contentMatch = attrs.match(/\bcontent\s*=\s*'([^']*)'/i);
    }
    if (contentMatch && contentMatch[1]) {
      return decodeHtmlEntities(contentMatch[1]).replace(/\s+/g, ' ').trim();
    }
  }
  return '';
}

function extractSchemaMarkups(html: string): string[] {
  const schemas: string[] = [];
  // Match any <script> tag with type="application/ld+json", regardless of other attributes
  const openTagRegex = /<script\s[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>/gi;
  let openMatch;
  while ((openMatch = openTagRegex.exec(html)) !== null) {
    const startIdx = openMatch.index + openMatch[0].length;
    // Find the closing </script> tag — use a case-insensitive search
    const closeIdx = html.toLowerCase().indexOf('</script>', startIdx);
    if (closeIdx === -1) continue;
    const content = html.slice(startIdx, closeIdx).trim();
    if (!content) continue;
    try {
      const parsed = JSON.parse(content);
      schemas.push(JSON.stringify(parsed, null, 2));
    } catch {
      // Still include raw content so the user can see it
      schemas.push(content);
    }
  }
  return schemas;
}

function extractImages(html: string, baseUrl: string): ImageData[] {
  const images: ImageData[] = [];
  const imgRegex = /<img\s([^>]+)>/gi;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    const attrs = match[1];
    const srcMatch = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    if (!srcMatch) continue;
    let src = srcMatch[1].trim();

    if (src.startsWith('//')) {
      try { const base = new URL(baseUrl); src = base.protocol + src; } catch { /* keep */ }
    } else if (src.startsWith('/')) {
      try { const base = new URL(baseUrl); src = base.origin + src; } catch { /* keep */ }
    } else if (!src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('data:')) {
      try { src = new URL(src, baseUrl).href; } catch { /* keep */ }
    }

    if (src.startsWith('data:')) continue;

    const altMatch = attrs.match(/\balt\s*=\s*["']([^"']*)["']/i);
    const alt = altMatch ? decodeHtmlEntities(altMatch[1]).replace(/\s+/g, ' ').trim() : null;
    images.push({ src, alt: alt !== null && alt.length > 0 ? alt : null });
  }
  return images;
}

// Retry fetch with exponential backoff
async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  const retryableStatuses = new Set([408, 425, 429, 500, 502, 503, 504]);
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SitemapCrawlerPro/1.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        signal: AbortSignal.timeout(15000),
        redirect: 'follow',
      });
      if (resp.ok || !retryableStatuses.has(resp.status)) {
        return resp;
      }
      // Retryable status — consume body before retrying
      await resp.text();
    } catch (e) {
      if (attempt === retries - 1) throw e;
    }
    // Exponential backoff: 1s, 2s, 4s
    await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
  }
  throw new Error('Max retries reached');
}

async function fetchMeta(
  url: string,
  includeTitle: boolean,
  includeDesc: boolean,
  includeH1: boolean,
  includeH2: boolean,
  includeH3: boolean,
  includeImages: boolean,
  includeSchemas: boolean,
  includeRobots: boolean,
): Promise<CrawlResult> {
  const start = Date.now();
  const empty: CrawlResult = { url, title: '', description: '', h1s: [], h2s: [], h3s: [], images: [], schemas: [], robots: '', status: 'Error', statusCode: 0, fetchTime: '0s' };
  try {
    const resp = await fetchWithRetry(url);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1) + 's';

    if (!resp.ok) {
      return { ...empty, statusCode: resp.status, fetchTime: elapsed };
    }

    const html = await resp.text();
    return {
      url,
      title: includeTitle ? extractTitle(html) : '',
      description: includeDesc ? extractDescription(html) : '',
      h1s: includeH1 ? extractHeadings(html, 'h1') : [],
      h2s: includeH2 ? extractHeadings(html, 'h2') : [],
      h3s: includeH3 ? extractHeadings(html, 'h3') : [],
      images: includeImages ? extractImages(html, url) : [],
      schemas: includeSchemas ? extractSchemaMarkups(html) : [],
      robots: includeRobots ? extractMetaRobots(html) : '',
      status: 'OK',
      statusCode: resp.status,
      fetchTime: elapsed,
    };
  } catch {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1) + 's';
    return { ...empty, fetchTime: elapsed };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      urls,
      includeTitle = true,
      includeDesc = true,
      includeH1 = false,
      includeH2 = false,
      includeH3 = false,
      includeImages = false,
      includeSchemas = false,
      includeRobots = false,
    } = await req.json();

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return new Response(
        JSON.stringify({ error: 'urls array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Concurrency of 5 to reduce server-side pressure
    const batchSize = 5;
    const results: CrawlResult[] = [];

    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((url: string) => fetchMeta(url, includeTitle, includeDesc, includeH1, includeH2, includeH3, includeImages, includeSchemas, includeRobots))
      );
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
