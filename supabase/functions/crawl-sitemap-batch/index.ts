const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ImageData {
  src: string;
  alt: string | null;
}

interface HreflangEntry {
  href: string;
  hreflang: string;
}

interface InternalLinkData {
  anchorText: string;
  href: string;
  isInternal: boolean;
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
  robots?: string;
  canonical?: string;
  canonicalStatus?: 'Self Referencing' | 'Canonicalised' | 'Missing';
  hreflangs?: HreflangEntry[];
  internalLinks?: InternalLinkData[];
  status: 'OK' | 'Error';
  statusCode: number;
  redirectStatusCode?: number;
  redirectedUrl?: string;
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
  const openTagRegex = /<script\s[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>/gi;
  let openMatch;
  while ((openMatch = openTagRegex.exec(html)) !== null) {
    const startIdx = openMatch.index + openMatch[0].length;
    const closeIdx = html.toLowerCase().indexOf('</script>', startIdx);
    if (closeIdx === -1) continue;
    const content = html.slice(startIdx, closeIdx).trim();
    if (!content) continue;
    try {
      const parsed = JSON.parse(content);
      schemas.push(JSON.stringify(parsed, null, 2));
    } catch {
      schemas.push(content);
    }
  }
  return schemas;
}

function extractCanonical(html: string): string {
  const linkRegex = /<link\s([^>]+?)\/?>/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const attrs = match[1];
    const relMatch = attrs.match(/\brel\s*=\s*["']canonical["']/i);
    if (!relMatch) continue;
    let hrefMatch = attrs.match(/\bhref\s*=\s*"([^"]*)"/i);
    if (!hrefMatch) {
      hrefMatch = attrs.match(/\bhref\s*=\s*'([^']*)'/i);
    }
    if (hrefMatch && hrefMatch[1]) {
      return decodeHtmlEntities(hrefMatch[1]).trim();
    }
  }
  return '';
}

function getCanonicalStatus(pageUrl: string, canonical: string): 'Self Referencing' | 'Canonicalised' | 'Missing' {
  if (!canonical) return 'Missing';
  try {
    const pageNorm = new URL(pageUrl).href.replace(/\/+$/, '');
    const canonNorm = new URL(canonical).href.replace(/\/+$/, '');
    return pageNorm === canonNorm ? 'Self Referencing' : 'Canonicalised';
  } catch {
    return pageUrl === canonical ? 'Self Referencing' : 'Canonicalised';
  }
}

function extractHreflangs(html: string): HreflangEntry[] {
  const entries: HreflangEntry[] = [];
  const linkRegex = /<link\s([^>]+?)\/?>/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const attrs = match[1];
    const relMatch = attrs.match(/\brel\s*=\s*["']alternate["']/i);
    if (!relMatch) continue;
    const hreflangMatch = attrs.match(/\bhreflang\s*=\s*["']([^"']+)["']/i);
    if (!hreflangMatch) continue;
    let hrefMatch = attrs.match(/\bhref\s*=\s*"([^"]*)"/i);
    if (!hrefMatch) hrefMatch = attrs.match(/\bhref\s*=\s*'([^']*)'/i);
    if (hrefMatch && hrefMatch[1]) {
      entries.push({
        href: decodeHtmlEntities(hrefMatch[1]).trim(),
        hreflang: decodeHtmlEntities(hreflangMatch[1]).trim(),
      });
    }
  }
  return entries;
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

// ─── Main content extraction for internal links ───────────────────────────────

function stripTagBlocks(html: string, tag: string): string {
  const regex = new RegExp(`<${tag}[\\s>][\\s\\S]*?<\\/${tag}>`, 'gi');
  return html.replace(regex, '');
}

function stripByClassId(html: string): string {
  const tagOpenRegex = /<(div|section|aside|ul|ol|form)\s+[^>]*(class|id)\s*=\s*["'][^"']*\b(nav|menu|sidebar|footer|header|breadcrumb|social|share|widget|advert|cookie|popup|modal|comment|related|newsletter|signup|subscribe|promo|banner|toolbar|topbar|bottombar|masthead|drawer|overlay|lightbox|sticky|dock)\b[^"']*["'][^>]*>/gi;
  
  let result = html;
  const toRemove: { start: number; end: number }[] = [];
  let match;
  
  while ((match = tagOpenRegex.exec(html)) !== null) {
    const tagName = match[1];
    const startIdx = match.index;
    let depth = 1;
    const closePattern = new RegExp(`<${tagName}[\\s>]|<\\/${tagName}>`, 'gi');
    closePattern.lastIndex = startIdx + match[0].length;
    let closeMatch;
    while ((closeMatch = closePattern.exec(html)) !== null) {
      if (closeMatch[0].startsWith('</')) {
        depth--;
        if (depth === 0) {
          toRemove.push({ start: startIdx, end: closeMatch.index + closeMatch[0].length });
          break;
        }
      } else {
        depth++;
      }
    }
  }
  
  toRemove.sort((a, b) => b.start - a.start);
  for (const block of toRemove) {
    result = result.slice(0, block.start) + result.slice(block.end);
  }
  return result;
}

function extractMainContent(html: string): string {
  // Simple approach: get the body, strip header/footer/nav and known non-content blocks
  let body = html;
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) body = bodyMatch[1];

  // Strip semantic non-content tags
  body = stripTagBlocks(body, 'header');
  body = stripTagBlocks(body, 'footer');
  body = stripTagBlocks(body, 'nav');
  body = stripTagBlocks(body, 'script');
  body = stripTagBlocks(body, 'style');
  body = stripTagBlocks(body, 'noscript');
  body = stripTagBlocks(body, 'iframe');
  // Strip elements with nav/footer/header-like classes/ids
  body = stripByClassId(body);

  return body;
}

function isGenericAnchorText(text: string): boolean {
  const generic = /^(shop now|read more|click here|learn more|view more|see more|buy now|order now|add to cart|view details|more info|details|here|link|go|visit|explore|discover|get started|continue|next|previous|back|submit|download|sign up|subscribe|join|contact us|get in touch)$/i;
  return generic.test(text.trim());
}

function extractCleanAnchorText(innerHtml: string): string {
  // Strategy: if the <a> wraps a large block (like a product card),
  // extract the first meaningful short text element instead of all text.
  
  // 1. Try to find a heading inside the anchor
  const headingMatch = innerHtml.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i);
  if (headingMatch) {
    const text = decodeHtmlEntities(headingMatch[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
    if (text.length > 1) return text.slice(0, 150);
  }
  
  // 2. Try to find a <span>, <strong>, or <b> with short text (likely a label)
  const labelMatch = innerHtml.match(/<(span|strong|b|em|p)[^>]*>([\s\S]*?)<\/\1>/i);
  if (labelMatch) {
    const raw = decodeHtmlEntities(labelMatch[2].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
    if (raw.length > 1 && raw.length <= 100) return raw;
  }
  
  // 3. Try img alt text
  const imgAltMatch = innerHtml.match(/<img\s[^>]*\balt\s*=\s*["']([^"']+)["']/i);
  if (imgAltMatch) {
    const alt = decodeHtmlEntities(imgAltMatch[1]).replace(/\s+/g, ' ').trim();
    if (alt.length > 1) return alt.slice(0, 150);
  }
  
  // 4. Fallback: get all text, but truncate if too long
  const fullText = decodeHtmlEntities(innerHtml.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
  if (!fullText) return '';
  
  // If text is short enough, use as-is
  if (fullText.length <= 100) return fullText;
  
  // Truncate at word boundary
  const truncated = fullText.slice(0, 100).replace(/\s+\S*$/, '');
  return truncated + '…';
}

function extractCardContext(innerHtml: string): string | null {
  // For card-like anchors (large blocks), extract heading + description snippet
  const headingMatch = innerHtml.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i);
  if (!headingMatch) return null;
  
  const heading = decodeHtmlEntities(headingMatch[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
  if (!heading) return null;
  
  // Try to find a description paragraph or div with text after the heading
  const descMatches = innerHtml.matchAll(/<(div|p|span)[^>]*class\s*=\s*["'][^"']*(?:text|desc|summary|content|body|detail|excerpt|info)[^"']*["'][^>]*>([\s\S]*?)<\/\1>/gi);
  for (const dm of descMatches) {
    const desc = decodeHtmlEntities(dm[2].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
    if (desc.length > 20 && desc.length <= 300) {
      const truncDesc = desc.length > 120 ? desc.slice(0, 120).replace(/\s+\S*$/, '') + '…' : desc;
      return `${heading} — ${truncDesc}`;
    }
  }
  
  // Fallback: check if there's substantial text beyond the heading
  const fullText = decodeHtmlEntities(innerHtml.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
  if (fullText.length > heading.length + 30) {
    // There's more content, it's likely a card
    const afterHeading = fullText.slice(fullText.indexOf(heading) + heading.length).trim();
    if (afterHeading.length > 20) {
      const truncAfter = afterHeading.length > 120 ? afterHeading.slice(0, 120).replace(/\s+\S*$/, '') + '…' : afterHeading;
      return `${heading} — ${truncAfter}`;
    }
  }
  
  return null;
}

function extractInternalLinks(html: string, pageUrl: string): InternalLinkData[] {
  const mainContent = extractMainContent(html);
  const links: InternalLinkData[] = [];
  const seen = new Set<string>();
  
  let pageDomain: string;
  try {
    pageDomain = new URL(pageUrl).hostname.replace(/^www\./, '');
  } catch { pageDomain = ''; }
  
  const anchorRegex = /<a\s([^>]+)>([\s\S]*?)<\/a>/gi;
  let match;
  
  while ((match = anchorRegex.exec(mainContent)) !== null) {
    const attrs = match[1];
    const innerHtml = match[2];
    
    let hrefMatch = attrs.match(/\bhref\s*=\s*"([^"]*)"/i);
    if (!hrefMatch) hrefMatch = attrs.match(/\bhref\s*=\s*'([^']*)'/i);
    if (!hrefMatch) continue;
    
    let href = decodeHtmlEntities(hrefMatch[1]).trim();
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
    
    try { href = new URL(href, pageUrl).href; } catch { continue; }
    
    let isInternal = false;
    try {
      const linkDomain = new URL(href).hostname.replace(/^www\./, '');
      isInternal = linkDomain === pageDomain;
    } catch { isInternal = false; }
    
    // For card-like anchors, try to get rich context
    const cardContext = extractCardContext(innerHtml);
    // Standard anchor text extraction
    const anchorText = extractCleanAnchorText(innerHtml);
    
    // Use card context if available AND the standard text is generic or very short
    let finalText = anchorText;
    if (cardContext && (isGenericAnchorText(anchorText) || anchorText.length <= 3)) {
      finalText = cardContext;
    } else if (cardContext && anchorText === cardContext.split(' — ')[0]) {
      // anchorText matches just the heading from the card, use richer card context
      finalText = cardContext;
    }
    
    if (!finalText) continue;
    
    // Deduplicate: keep all unique anchor text + href combos
    // But skip truly duplicate entries and skip generic texts if a descriptive one exists
    const key = href + '||' + finalText;
    if (seen.has(key)) continue;
    seen.add(key);
    
    // Check if we already have this href with a better (non-generic) text
    const existingForHref = links.filter(l => l.href === href);
    if (isGenericAnchorText(finalText) && existingForHref.length > 0) {
      // Skip generic text if we already have a descriptive entry for this URL
      continue;
    }
    
    // If this is descriptive and we have generic entries for the same href, remove them
    if (!isGenericAnchorText(finalText) && existingForHref.length > 0) {
      const genericIndices: number[] = [];
      for (let i = links.length - 1; i >= 0; i--) {
        if (links[i].href === href && isGenericAnchorText(links[i].anchorText)) {
          genericIndices.push(i);
        }
      }
      for (const idx of genericIndices) {
        seen.delete(links[idx].href + '||' + links[idx].anchorText);
        links.splice(idx, 1);
      }
    }
    
    // Also deduplicate if a shorter version of the same text exists (e.g., heading vs heading + desc)
    // Keep the richer version
    const existingSameHref = links.filter(l => l.href === href);
    const isDuplicate = existingSameHref.some(l => {
      // If one text is a prefix/subset of the other, keep the longer (richer) one
      if (finalText.startsWith(l.anchorText) || l.anchorText.startsWith(finalText)) {
        if (finalText.length > l.anchorText.length) {
          // Replace shorter with longer
          l.anchorText = finalText;
        }
        return true;
      }
      return false;
    });
    if (isDuplicate) continue;
    
    links.push({ anchorText: finalText, href, isInternal });
  }
  
  return links;
}

// ─── JS-rendered link extraction via Jina Reader ──────────────────────────────

async function fetchJsRenderedHtml(url: string): Promise<string | null> {
  try {
    const jinaUrl = `https://r.jina.ai/${url}`;
    const resp = await fetch(jinaUrl, {
      headers: {
        'Accept': 'text/html',
        'X-Return-Format': 'html',
      },
      signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) return null;
    return await resp.text();
  } catch {
    return null;
  }
}

async function extractJsRenderedLinks(url: string): Promise<InternalLinkData[]> {
  const html = await fetchJsRenderedHtml(url);
  if (!html) return [];
  return extractInternalLinks(html, url);
}

async function fetchWithRetry(url: string, retries = 3): Promise<{ resp: Response; redirectedUrl?: string; redirectStatusCode?: number }> {
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
        redirect: 'manual',
      });

      if (resp.status >= 300 && resp.status < 400) {
        const originalRedirectStatus = resp.status;
        const location = resp.headers.get('location');
        if (location) {
          let finalUrl: string;
          try {
            finalUrl = new URL(location, url).href;
          } catch {
            finalUrl = location;
          }
          let currentUrl = finalUrl;
          let finalResp: Response | null = null;
          for (let hop = 0; hop < 5; hop++) {
            const hopResp = await fetch(currentUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; SitemapCrawlerPro/1.0)',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              },
              signal: AbortSignal.timeout(15000),
              redirect: 'manual',
            });
            if (hopResp.status >= 300 && hopResp.status < 400) {
              const nextLoc = hopResp.headers.get('location');
              if (nextLoc) {
                try { currentUrl = new URL(nextLoc, currentUrl).href; } catch { currentUrl = nextLoc; }
                continue;
              }
            }
            finalResp = hopResp;
            break;
          }
          if (!finalResp) {
            return { resp, redirectedUrl: currentUrl, redirectStatusCode: originalRedirectStatus };
          }
          return { resp: finalResp, redirectedUrl: currentUrl, redirectStatusCode: originalRedirectStatus };
        }
      }

      if (resp.ok || !retryableStatuses.has(resp.status)) {
        return { resp };
      }
      await resp.text();
    } catch (e) {
      if (attempt === retries - 1) throw e;
    }
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
  includeCanonical: boolean,
  includeHreflangs: boolean,
  includeInternalLinks: boolean,
  jsRenderedLinks: boolean = false,
): Promise<CrawlResult> {
  const start = Date.now();
  const empty: CrawlResult = { url, title: '', description: '', h1s: [], h2s: [], h3s: [], images: [], schemas: [], robots: '', canonical: '', canonicalStatus: 'Missing', hreflangs: [], internalLinks: [], status: 'Error', statusCode: 0, fetchTime: '0s' };
  try {
    const { resp, redirectedUrl, redirectStatusCode } = await fetchWithRetry(url);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1) + 's';

    if (!resp.ok) {
      return { ...empty, statusCode: resp.status, redirectedUrl, redirectStatusCode, fetchTime: elapsed };
    }

    const html = await resp.text();
    const canonical = includeCanonical ? extractCanonical(html) : '';
    const canonicalStatus = includeCanonical ? getCanonicalStatus(url, canonical) : undefined;
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
      canonical: includeCanonical ? canonical : undefined,
      canonicalStatus,
      hreflangs: includeHreflangs ? extractHreflangs(html) : [],
      internalLinks: includeInternalLinks
        ? (jsRenderedLinks ? await extractJsRenderedLinks(url) : extractInternalLinks(html, url))
        : [],
      status: 'OK',
      statusCode: resp.status,
      redirectStatusCode,
      redirectedUrl,
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
      includeCanonical = false,
      includeHreflangs = false,
      includeInternalLinks = false,
      jsRenderedLinks = false,
    } = await req.json();

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return new Response(
        JSON.stringify({ error: 'urls array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const batchSize = jsRenderedLinks ? 2 : 5;
    const results: CrawlResult[] = [];

    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((url: string) => fetchMeta(url, includeTitle, includeDesc, includeH1, includeH2, includeH3, includeImages, includeSchemas, includeRobots, includeCanonical, includeHreflangs, includeInternalLinks, jsRenderedLinks))
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
