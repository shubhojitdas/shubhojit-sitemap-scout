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
  /** Raw rel attribute value (lowercased, space-normalized). Empty string if absent. */
  rel?: string;
  /** True if rel contains "nofollow". */
  nofollow?: boolean;
  /** True if rel contains "sponsored". */
  sponsored?: boolean;
  /** True if rel contains "ugc". */
  ugc?: boolean;
}

interface SocialTag {
  network: 'og' | 'twitter';
  property: string;   // e.g. "og:title" or "twitter:card"
  content: string;
}

type RedirectType = 'none' | 'http' | 'meta-refresh' | 'javascript' | 'mixed';
type RedirectHopType = 'http' | 'meta-refresh' | 'javascript';

interface RedirectHop {
  url: string;
  status: number;
  type: RedirectHopType;
  statusText?: string;
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
  socialTags?: SocialTag[];
  status: 'OK' | 'Error';
  statusCode: number;
  redirectStatusCode?: number;
  redirectedUrl?: string;
  redirectType?: RedirectType;
  /** Phase 1: structured chain — each hop carries URL, status, type. */
  redirectChain?: RedirectHop[];
  initialUrl?: string;
  finalUrl?: string;
  hopCount?: number;
  /** ISO-8601 Last-Modified from the final HTTP response, when provided. */
  lastModified?: string;
  /** Approximate visible main-content word count (used for thin-content detection). */
  wordCount?: number;
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
  // Strip blocks that can contain misleading <title> tags (SVG icons, scripts,
  // commented-out markup) before searching for the document <title>.
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, '');

  // Prefer the title inside <head> when available
  const headMatch = cleaned.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
  const scope = headMatch ? headMatch[1] : cleaned;

  const match = scope.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    ?? cleaned.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return '';
  return decodeHtmlEntities(match[1]).replace(/\s+/g, ' ').trim();
}

function extractDescription(html: string): string {
  // Strip comments so commented-out meta tags are ignored
  html = html.replace(/<!--[\s\S]*?-->/g, '');
  // Strategy: find all <meta> tags, check for name="description", extract content robustly
  const metaTagRegex = /<meta\b([^>]*)>/gi;
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
  // Skip commented-out markup and inline SVG/script blocks so we don't
  // surface dummy headings or icon labels.
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, '');
  const headings: string[] = [];
  const regex = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  let match;
  while ((match = regex.exec(cleaned)) !== null) {
    const text = decodeHtmlEntities(match[1].replace(/<[^>]+>/g, ''))
      .replace(/\s+/g, ' ')
      .trim();
    if (text) headings.push(text.slice(0, 200));
  }
  return headings;
}

function extractMetaRobots(html: string): string {
  html = html.replace(/<!--[\s\S]*?-->/g, '');
  const metaTagRegex = /<meta\b([^>]*)>/gi;
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

// ─── OG / Twitter tag extraction ──────────────────────────────────────────────
// Captures every <meta> whose `property` starts with "og:" or whose
// `name` starts with "twitter:" (case-insensitive). Some CMS platforms swap
// the attributes (name="og:..." or property="twitter:..."), so we accept
// both. Image-like content fields are resolved against the page URL so
// previews work even when the source uses relative paths.
function extractSocialTags(html: string, baseUrl: string): SocialTag[] {
  const cleaned = html.replace(/<!--[\s\S]*?-->/g, '');
  // Restrict to <head> when available — OG/Twitter tags belong there.
  const headMatch = cleaned.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
  const scope = headMatch ? headMatch[1] : cleaned;

  const tags: SocialTag[] = [];
  const seen = new Set<string>();
  const metaRegex = /<meta\b([^>]*)>/gi;
  let m: RegExpExecArray | null;

  while ((m = metaRegex.exec(scope)) !== null) {
    const attrs = m[1];
    const propMatch = attrs.match(/\bproperty\s*=\s*["']([^"']+)["']/i);
    const nameMatch = attrs.match(/\bname\s*=\s*["']([^"']+)["']/i);
    const key = (propMatch?.[1] ?? nameMatch?.[1] ?? '').trim().toLowerCase();
    if (!key) continue;

    let network: 'og' | 'twitter';
    if (key.startsWith('og:')) network = 'og';
    else if (key.startsWith('twitter:')) network = 'twitter';
    else continue;

    let contentMatch = attrs.match(/\bcontent\s*=\s*"([^"]*)"/i);
    if (!contentMatch) contentMatch = attrs.match(/\bcontent\s*=\s*'([^']*)'/i);
    if (!contentMatch) continue;

    let content = decodeHtmlEntities(contentMatch[1]).replace(/\s+/g, ' ').trim();
    if (!content) continue;

    // Resolve image-like fields to absolute URLs so previews render.
    if (/^(og:image|og:image:secure_url|og:video|og:audio|og:url|twitter:image|twitter:url|twitter:player)$/.test(key)) {
      try {
        if (content.startsWith('//')) {
          const base = new URL(baseUrl);
          content = base.protocol + content;
        } else if (!/^https?:\/\//i.test(content) && !content.startsWith('data:')) {
          content = new URL(content, baseUrl).href;
        }
      } catch { /* keep original */ }
    }

    const dedupeKey = `${key}::${content}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    tags.push({ network, property: key, content });
  }

  return tags;
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

function stripHtmlComments(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, '');
}

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
  const cleanHtml = stripHtmlComments(html);
  let body = cleanHtml;
  const bodyMatch = cleanHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
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
  
  // Try to find a description paragraph or div with substantial text
  // Use a broader match but filter for actual descriptive content
  const descMatches = innerHtml.matchAll(/<(div|p)[^>]*>([\s\S]*?)<\/\1>/gi);
  let bestDesc = '';
  for (const dm of descMatches) {
    const desc = decodeHtmlEntities(dm[2].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
    // Skip pricing/tax/short snippets - look for actual descriptions (40+ chars)
    if (desc.length >= 40 && desc.length <= 500 && !desc.match(/MRP|₹|\$|inclusive of|taxes|save |off\b/i)) {
      if (desc.length > bestDesc.length) bestDesc = desc;
    }
  }
  if (bestDesc) {
    // Remove the heading text from the description if it starts with it
    let cleanDesc = bestDesc;
    if (cleanDesc.startsWith(heading)) {
      cleanDesc = cleanDesc.slice(heading.length).trim();
    }
    // Also remove heading if repeated with slight variations (e.g., with ® symbols)
    const headingNoSup = heading.replace(/[®™©]/g, '').trim();
    if (cleanDesc.replace(/[®™©]/g, '').trim().startsWith(headingNoSup)) {
      cleanDesc = cleanDesc.replace(/[®™©]/g, '').trim().slice(headingNoSup.length).trim();
    }
    if (cleanDesc.length > 20) {
      const truncDesc = cleanDesc.length > 120 ? cleanDesc.slice(0, 120).replace(/\s+\S*$/, '') + '…' : cleanDesc;
      return `${heading} — ${truncDesc}`;
    }
  }
  
  // Fallback: check if there's substantial text beyond the heading
  const fullText = decodeHtmlEntities(innerHtml.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
  // Find last occurrence of heading to skip repeated headings
  const headingIdx = fullText.lastIndexOf(heading);
  if (headingIdx !== -1 && fullText.length > headingIdx + heading.length + 30) {
    let afterHeading = fullText.slice(headingIdx + heading.length).trim();
    // Skip pricing info
    if (afterHeading.match(/MRP|₹|\$|inclusive of|taxes/i)) {
      // Try to extract just the descriptive part before pricing
      const pricingIdx = afterHeading.search(/MRP|₹|\$/i);
      if (pricingIdx > 20) afterHeading = afterHeading.slice(0, pricingIdx).trim();
      else return null;
    }
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
    
    // Extract anchor text — use card context for richer description when available
    const cardContext = extractCardContext(innerHtml);
    const anchorText = extractCleanAnchorText(innerHtml);
    
    // Use card context to enrich the text, but KEEP the original anchor text too
    let finalText = anchorText;
    if (cardContext && (anchorText.length <= 3 || anchorText === cardContext.split(' — ')[0])) {
      finalText = cardContext;
    }
    
    if (!finalText) continue;

    // Parse rel attribute (HTML5 allows multiple space-separated tokens).
    let relMatch = attrs.match(/\brel\s*=\s*"([^"]*)"/i);
    if (!relMatch) relMatch = attrs.match(/\brel\s*=\s*'([^']*)'/i);
    const rel = (relMatch ? relMatch[1] : '').toLowerCase().replace(/\s+/g, ' ').trim();
    const tokens = rel ? rel.split(' ') : [];
    const nofollow = tokens.includes('nofollow');
    const sponsored = tokens.includes('sponsored');
    const ugc = tokens.includes('ugc');

    links.push({ anchorText: finalText, href, isInternal, rel, nofollow, sponsored, ugc });
  }
  
  return links;
}

/** Approximate visible word count from main content — strips tags, collapses whitespace. */
function computeWordCount(html: string): number {
  const main = extractMainContent(html);
  const text = main
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return 0;
  // Count whitespace-delimited tokens with at least one letter/digit.
  const tokens = text.split(' ').filter((t) => /[\p{L}\p{N}]/u.test(t));
  return tokens.length;
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

/**
 * Detects a `<meta http-equiv="refresh" content="0; url=...">` redirect in the
 * raw HTML <head>. Returns the absolute target URL when present, else null.
 * Only treats it as a redirect when the delay is 0–5 seconds (matching what
 * search engines treat as a redirect).
 */
function extractMetaRefresh(html: string, baseUrl: string): { target: string; delay: number } | null {
  const cleaned = html.replace(/<!--[\s\S]*?-->/g, '');
  const headMatch = cleaned.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
  const scope = headMatch ? headMatch[1] : cleaned;

  const metaRegex = /<meta\b([^>]*)>/gi;
  let m;
  while ((m = metaRegex.exec(scope)) !== null) {
    const attrs = m[1];
    if (!/\bhttp-equiv\s*=\s*["']?refresh["']?/i.test(attrs)) continue;
    const contentMatch = attrs.match(/\bcontent\s*=\s*"([^"]*)"/i)
      ?? attrs.match(/\bcontent\s*=\s*'([^']*)'/i);
    if (!contentMatch) continue;

    const content = decodeHtmlEntities(contentMatch[1]).trim();
    const parts = content.split(';');
    const delay = parseFloat(parts[0]) || 0;
    if (delay > 5) continue;

    const urlPart = parts.slice(1).join(';').trim();
    const urlMatch = urlPart.match(/url\s*=\s*["']?([^"'\s]+)["']?/i);
    if (!urlMatch) continue;

    let target = urlMatch[1].trim();
    try { target = new URL(target, baseUrl).href; } catch { /* leave as-is */ }
    return { target, delay };
  }
  return null;
}

/**
 * Inline JS redirect detection — pattern matches inside <script> blocks for
 * common window.location / document.location assignments. No JS execution.
 * Returns the resolved absolute URL of the first valid match, or null.
 */
function extractJsRedirect(html: string, baseUrl: string): string | null {
  const noComments = html.replace(/<!--[\s\S]*?-->/g, '');
  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  // Capture the quote char so we can distinguish template literals (`) from plain strings.
  const JS_REDIRECT_REGEX =
    /(?:window\.|document\.|top\.|self\.|parent\.)?location(?:\.href|\.replace|\.assign)?\s*(?:=|\()\s*(['"`])([^'"`]+)\1/gi;

  let scriptMatch: RegExpExecArray | null;
  while ((scriptMatch = scriptRegex.exec(noComments)) !== null) {
    const body = scriptMatch[1];
    if (!body || !body.trim()) continue;

    // Strip JS comments to skip commented-out redirects (best-effort).
    const cleanedBody = body
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/[^\n\r]*/g, '$1');

    JS_REDIRECT_REGEX.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = JS_REDIRECT_REGEX.exec(cleanedBody)) !== null) {
      const quote = m[1];
      const raw = m[2].trim();
      if (!raw || raw === '#' || raw.startsWith('#')) continue;
      if (raw.startsWith('javascript:')) continue;

      // Skip template literals that contain unresolved interpolation — these are
      // dynamic targets (e.g. `/products/${handle}`), not real page-level redirects.
      if (quote === '`' && /\$\{/.test(raw)) continue;
      // Also skip handlebars / mustache / angular-style placeholders.
      if (/\{\{[^}]*\}\}/.test(raw)) continue;
      // Reject anything that, once resolved, still contains unencoded `${` OR the
      // URL-encoded form `%24%7B` / a bare `%7B` (`{`) — clear sign of a template.
      if (/\$\{|%24%7B|%7B[^/]*%7D/i.test(raw)) continue;

      // Match the call context — only treat as a real navigation when the assignment
      // appears at script top-level OR inside an obvious lifecycle hook. If it is
      // inside an event handler body (onclick, addEventListener('click', …)), skip.
      const ctxStart = Math.max(0, m.index - 200);
      const ctx = cleanedBody.slice(ctxStart, m.index);
      if (/addEventListener\s*\(\s*['"`](?:click|submit|change|input|keydown|keyup|mousedown|mouseup|touchstart|touchend)['"`]/i.test(ctx)) continue;
      if (/\bon(?:click|submit|change|input|keydown|keyup|mousedown|mouseup|touchstart|touchend)\s*[:=]\s*(?:function|\([^)]*\)\s*=>)/i.test(ctx)) continue;

      let resolved: string;
      try { resolved = new URL(raw, baseUrl).href; } catch { continue; }
      if (resolved === baseUrl) continue;
      // Final guard: resolved URL must not contain a literal `${` or encoded brace.
      if (/\$\{|%24%7B|%7B/i.test(resolved)) continue;
      return resolved;
    }
  }
  return null;
}

async function extractJsRenderedLinks(url: string): Promise<InternalLinkData[]> {
  const html = await fetchJsRenderedHtml(url);
  if (!html) return [];
  return extractInternalLinks(html, url);
}

// ─── Phase 1 redirect detector (HTTP + meta-refresh, max 10 hops) ────────────

const MAX_HOPS = 10;
const FETCH_TIMEOUT_MS = 9000;
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 SitemapScout/1.0 (+https://shubhojit-sitemap-scout.lovable.app)',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
};

function retryDelayMs(status: number, attempt: number, resp?: Response): number {
  const retryAfter = resp?.headers.get('retry-after');
  if (retryAfter) {
    const asSeconds = Number(retryAfter);
    if (Number.isFinite(asSeconds)) return Math.min(asSeconds * 1000, 3500);
    const asDate = new Date(retryAfter).getTime();
    if (!Number.isNaN(asDate)) return Math.min(Math.max(asDate - Date.now(), 0), 3500);
  }
  const base = status === 429 ? 900 : 450;
  return Math.min(base * Math.pow(2, attempt), 3200) + Math.floor(Math.random() * 180);
}

async function fetchWithRetries(url: string, redirect: RequestRedirect, maxAttempts = 3): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const resp = await fetch(url, {
        headers: FETCH_HEADERS,
        redirect,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!RETRYABLE_STATUSES.has(resp.status) || attempt === maxAttempts - 1) return resp;
      try { await resp.body?.cancel(); } catch { /* ignore */ }
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs(resp.status, attempt, resp)));
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts - 1) break;
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs(0, attempt)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Fetch failed');
}

interface DetectionResult {
  initialUrl: string;
  finalUrl: string;
  redirectType: RedirectType;
  redirectChain: RedirectHop[];
  hopCount: number;
  finalHtml: string;
  finalStatus: number;
  /** Last-Modified HTTP header from the final landed response, ISO-8601 if parseable. */
  lastModified: string;
  /** True when the underlying network completely failed before any response. */
  networkError: boolean;
}

async function detectRedirects(url: string): Promise<DetectionResult> {
  const chain: RedirectHop[] = [];
  const visited = new Set<string>();
  let current = url;
  let finalHtml = '';
  let finalStatus = 0;
  let lastModified = '';
  let networkError = false;

  for (let i = 0; i < MAX_HOPS; i++) {
    if (visited.has(current)) {
      chain.push({ url: current, status: -1, type: 'http', statusText: 'Redirect loop detected' });
      break;
    }
    visited.add(current);

    let resp: Response;
    try {
      resp = await fetchWithRetries(current, 'manual', 3);
    } catch (e) {
      chain.push({
        url: current,
        status: 0,
        type: 'http',
        statusText: e instanceof Error ? e.message : 'Fetch failed',
      });
      networkError = chain.length === 1; // failed on the very first request
      break;
    }

    if (resp.status >= 300 && resp.status < 400) {
      const location = resp.headers.get('location');
      chain.push({ url: current, status: resp.status, type: 'http' });
      try { await resp.text(); } catch { /* ignore */ }

      if (!location) { finalStatus = resp.status; break; }

      let next: string;
      try { next = new URL(location, current).href; } catch { next = location; }
      current = next;

      if (i === MAX_HOPS - 1) {
        chain.push({ url: current, status: -1, type: 'http', statusText: 'Max redirects exceeded' });
      }
      continue;
    }

    finalStatus = resp.status;
    // Capture Last-Modified header (RFC 1123) → ISO-8601 string for sitemap <lastmod>.
    const lmHeader = resp.headers.get('last-modified');
    if (lmHeader) {
      const parsed = new Date(lmHeader);
      if (!isNaN(parsed.getTime())) lastModified = parsed.toISOString();
    }
    try { finalHtml = await resp.text(); } catch { finalHtml = ''; }

    // Some servers send an HTTP `Refresh` response header instead of a meta tag.
    // Browsers honor it identically, so we follow it as a meta-refresh hop.
    if (resp.status >= 200 && resp.status < 300) {
      const refreshHeader = resp.headers.get('refresh');
      if (refreshHeader) {
        const parts = refreshHeader.split(';');
        const delay = parseFloat(parts[0]) || 0;
        const urlPart = parts.slice(1).join(';').trim();
        const m = urlPart.match(/url\s*=\s*["']?([^"'\s]+)["']?/i);
        if (delay <= 5 && m) {
          let target = m[1].trim();
          try { target = new URL(target, current).href; } catch { /* keep */ }
          if (target !== current && !visited.has(target)) {
            chain.push({ url: current, status: resp.status, type: 'meta-refresh' });
            current = target;
            finalHtml = '';
            finalStatus = 0;
            if (i === MAX_HOPS - 1) {
              chain.push({ url: current, status: -1, type: 'http', statusText: 'Max redirects exceeded' });
            }
            continue;
          }
        }
      }
    }

    if (resp.status >= 200 && resp.status < 300 && finalHtml) {
      // Meta-refresh only — server-side (3xx) is handled above, and HTML <meta refresh>
      // has clear, unambiguous semantics. Inline JavaScript pattern matching is
      // disabled here because it produced false positives on sites that simply
      // contain `location.href = ...` inside analytics, routing, or event-handler
      // code that never actually navigates the page on load. If you need to detect
      // SPA / async JS redirects, do it via headless rendering (future Phase 2),
      // not regex on inline scripts.
      const meta = extractMetaRefresh(finalHtml, current);
      if (meta && meta.target !== current && !visited.has(meta.target)) {
        chain.push({ url: current, status: resp.status, type: 'meta-refresh' });
        current = meta.target;
        finalHtml = '';
        finalStatus = 0;
        if (i === MAX_HOPS - 1) {
          chain.push({ url: current, status: -1, type: 'http', statusText: 'Max redirects exceeded' });
        }
        continue;
      }
    }
    break;
  }

  const httpHops = chain.filter((h) => h.type === 'http' && h.status >= 300 && h.status < 400).length;
  const metaHops = chain.filter((h) => h.type === 'meta-refresh').length;
  const jsHops = chain.filter((h) => h.type === 'javascript').length;
  const distinctTypes = [httpHops > 0, metaHops > 0, jsHops > 0].filter(Boolean).length;
  let redirectType: RedirectType = 'none';
  if (distinctTypes > 1) redirectType = 'mixed';
  else if (httpHops > 0) redirectType = 'http';
  else if (metaHops > 0) redirectType = 'meta-refresh';
  else if (jsHops > 0) redirectType = 'javascript';

  return {
    initialUrl: url,
    finalUrl: current,
    redirectType,
    redirectChain: chain,
    hopCount: chain.length,
    finalHtml,
    finalStatus,
    lastModified,
    networkError,
  };
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
  includeSocialTags: boolean = false,
): Promise<CrawlResult> {
  const start = Date.now();
  const empty: CrawlResult = {
    url, title: '', description: '', h1s: [], h2s: [], h3s: [],
    images: [], schemas: [], robots: '', canonical: '', canonicalStatus: 'Missing',
    hreflangs: [], internalLinks: [], socialTags: [],
    status: 'Error', statusCode: 0,
    redirectType: 'none', redirectChain: [], hopCount: 0,
    initialUrl: url, finalUrl: url,
    fetchTime: '0s',
  };

  try {
    const detection = await detectRedirects(url);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1) + 's';

    // Find the first 3xx hop for backward-compat redirectStatusCode field.
    const firstHttpRedirect = detection.redirectChain.find(
      (h) => h.type === 'http' && h.status >= 300 && h.status < 400,
    );
    const baseFields = {
      initialUrl: detection.initialUrl,
      finalUrl: detection.finalUrl,
      redirectType: detection.redirectType,
      redirectChain: detection.redirectChain,
      hopCount: detection.hopCount,
      lastModified: detection.lastModified || undefined,
      // Backward-compat scalar fields (used by older UI rendering paths).
      redirectStatusCode: firstHttpRedirect?.status,
      redirectedUrl: detection.redirectType === 'none' ? undefined : detection.finalUrl,
    };

    if (detection.networkError || (!detection.finalHtml && detection.finalStatus === 0)) {
      return { ...empty, ...baseFields, statusCode: detection.finalStatus, fetchTime: elapsed };
    }

    // Non-2xx terminal — return status info but no parsed metadata.
    if (detection.finalStatus < 200 || detection.finalStatus >= 400) {
      return { ...empty, ...baseFields, statusCode: detection.finalStatus, fetchTime: elapsed };
    }

    // Always extract from the FINAL landed HTML so JS-redirect / meta-refresh
    // pages report the destination's real metadata.
    const html = detection.finalHtml;
    const finalUrl = detection.finalUrl;
    const canonical = includeCanonical ? extractCanonical(html) : '';
    const canonicalStatus = includeCanonical ? getCanonicalStatus(finalUrl, canonical) : undefined;

    return {
      url,
      title: includeTitle ? extractTitle(html) : '',
      description: includeDesc ? extractDescription(html) : '',
      h1s: includeH1 ? extractHeadings(html, 'h1') : [],
      h2s: includeH2 ? extractHeadings(html, 'h2') : [],
      h3s: includeH3 ? extractHeadings(html, 'h3') : [],
      images: includeImages ? extractImages(html, finalUrl) : [],
      schemas: includeSchemas ? extractSchemaMarkups(html) : [],
      robots: includeRobots ? extractMetaRobots(html) : '',
      canonical: includeCanonical ? canonical : undefined,
      canonicalStatus,
      hreflangs: includeHreflangs ? extractHreflangs(html) : [],
      internalLinks: includeInternalLinks
        ? (jsRenderedLinks ? await extractJsRenderedLinks(finalUrl) : extractInternalLinks(html, finalUrl))
        : [],
      socialTags: includeSocialTags ? extractSocialTags(html, finalUrl) : [],
      // Word count is cheap (single regex pass over already-extracted main body)
      // and powers thin-content detection without needing a new flag.
      wordCount: computeWordCount(html),
      status: 'OK',
      statusCode: detection.finalStatus,
      ...baseFields,
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
      includeSocialTags = false,
    } = await req.json();

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return new Response(
        JSON.stringify({ error: 'urls array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Balanced concurrency: 8 simultaneous fetches (4 for JS-rendered).
    // The rolling pool keeps Deno responsive without hammering the target
    // site or saturating outbound sockets — a tested sweet spot between the
    // original 5-wide serial loop (too slow) and 12-wide pool (too aggressive).
    const concurrency = jsRenderedLinks ? 4 : 8;
    const results: CrawlResult[] = new Array(urls.length);
    let cursor = 0;

    const worker = async () => {
      while (true) {
        const i = cursor++;
        if (i >= urls.length) return;
        results[i] = await fetchMeta(
          urls[i], includeTitle, includeDesc, includeH1, includeH2, includeH3,
          includeImages, includeSchemas, includeRobots, includeCanonical,
          includeHreflangs, includeInternalLinks, jsRenderedLinks, includeSocialTags,
        );
      }
    };

    await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));

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
