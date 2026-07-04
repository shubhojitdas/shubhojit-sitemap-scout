import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

const UA = "Mozilla/5.0 (compatible; SitemapScoutMCP/1.0)";
const MAX_URLS = 1000;
const MAX_INDEX_CHILDREN = 20;

function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || h === "::1" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (/^(fc|fd)[0-9a-f]{2}:/i.test(h) || /^fe80:/i.test(h)) return true;
  return false;
}

async function fetchXml(url: string): Promise<string> {
  const u = new URL(url);
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("Only http/https URLs allowed");
  if (isPrivateHost(u.hostname)) throw new Error("Private hosts not allowed");
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "User-Agent": UA, Accept: "application/xml,text/xml,*/*" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}

function extractLocs(xml: string, tag: "url" | "sitemap"): string[] {
  const re = new RegExp(`<${tag}>[\\s\\S]*?<loc>\\s*([^<]+?)\\s*</loc>[\\s\\S]*?</${tag}>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(m[1].trim());
  return out;
}

export default defineTool({
  name: "list_sitemap_urls",
  title: "List sitemap URLs",
  description:
    "Fetch a sitemap XML (or sitemap index) and return the URLs it contains. Recurses one level into sitemap indexes.",
  inputSchema: {
    sitemapUrl: z.string().url().describe("Full URL to a sitemap.xml or sitemap index."),
    limit: z.number().int().min(1).max(MAX_URLS).default(200).describe("Max URLs to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ sitemapUrl, limit }) => {
    try {
      const xml = await fetchXml(sitemapUrl);
      const isIndex = /<sitemapindex\b/i.test(xml);
      const collected: string[] = [];
      const childSitemaps: string[] = [];

      if (isIndex) {
        const children = extractLocs(xml, "sitemap").slice(0, MAX_INDEX_CHILDREN);
        childSitemaps.push(...children);
        for (const child of children) {
          if (collected.length >= limit) break;
          try {
            const childXml = await fetchXml(child);
            for (const loc of extractLocs(childXml, "url")) {
              collected.push(loc);
              if (collected.length >= limit) break;
            }
          } catch {
            // skip broken child sitemap
          }
        }
      } else {
        for (const loc of extractLocs(xml, "url")) {
          collected.push(loc);
          if (collected.length >= limit) break;
        }
      }

      const result = {
        sitemapUrl,
        isIndex,
        childSitemaps,
        count: collected.length,
        urls: collected,
      };
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: "text", text: `Failed to load sitemap: ${msg}` }], isError: true };
    }
  },
});
