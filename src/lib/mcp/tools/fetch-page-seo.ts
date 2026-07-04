import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

const UA = "Mozilla/5.0 (compatible; SitemapScoutMCP/1.0)";
const TIMEOUT_MS = 15000;

function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || h === "::1" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (/^(fc|fd)[0-9a-f]{2}:/i.test(h) || /^fe80:/i.test(h)) return true;
  return false;
}

function pickAttr(tag: string, attr: string): string | undefined {
  const re = new RegExp(`\\b${attr}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const m = tag.match(re);
  return m ? (m[1] ?? m[2] ?? m[3])?.trim() : undefined;
}

function extractMeta(html: string, name: string): string | undefined {
  const re = new RegExp(`<meta\\b[^>]*\\b(?:name|property)\\s*=\\s*["']${name}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  return tag ? pickAttr(tag, "content") : undefined;
}

function extractAll(html: string, re: RegExp): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) out.push(m[1].trim());
  return out;
}

export default defineTool({
  name: "fetch_page_seo",
  title: "Fetch page SEO",
  description:
    "Fetch a public URL and extract SEO metadata: HTTP status, final URL after redirects, title, meta description, canonical, robots directive, H1s, Open Graph and Twitter tags.",
  inputSchema: {
    url: z.string().url().describe("Absolute http(s) URL to fetch."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ url }) => {
    let target: URL;
    try {
      target = new URL(url);
    } catch {
      return { content: [{ type: "text", text: "Invalid URL" }], isError: true };
    }
    if (target.protocol !== "http:" && target.protocol !== "https:") {
      return { content: [{ type: "text", text: "Only http/https URLs are allowed" }], isError: true };
    }
    if (isPrivateHost(target.hostname)) {
      return { content: [{ type: "text", text: "Private or internal hosts are not allowed" }], isError: true };
    }

    try {
      const res = await fetch(target.toString(), {
        redirect: "follow",
        headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const contentType = res.headers.get("content-type") ?? "";
      const html = /text\/html|application\/xhtml/i.test(contentType) ? await res.text() : "";

      const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim();
      const description = extractMeta(html, "description");
      const robots = extractMeta(html, "robots");
      const canonicalTag = html.match(/<link\b[^>]*\brel\s*=\s*["']canonical["'][^>]*>/i)?.[0];
      const canonical = canonicalTag ? pickAttr(canonicalTag, "href") : undefined;
      const h1s = extractAll(html, /<h1\b[^>]*>([\s\S]*?)<\/h1>/gi).map((s) => s.replace(/<[^>]+>/g, "").trim());

      const result = {
        requestedUrl: url,
        finalUrl: res.url,
        status: res.status,
        contentType,
        title,
        description,
        canonical,
        robots,
        h1: h1s.slice(0, 5),
        openGraph: {
          title: extractMeta(html, "og:title"),
          description: extractMeta(html, "og:description"),
          image: extractMeta(html, "og:image"),
          type: extractMeta(html, "og:type"),
          url: extractMeta(html, "og:url"),
        },
        twitter: {
          card: extractMeta(html, "twitter:card"),
          title: extractMeta(html, "twitter:title"),
          description: extractMeta(html, "twitter:description"),
          image: extractMeta(html, "twitter:image"),
        },
      };

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: "text", text: `Fetch failed: ${msg}` }], isError: true };
    }
  },
});
