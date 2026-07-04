import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

const UA = "Mozilla/5.0 (compatible; SitemapScoutMCP/1.0)";

function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || h === "::1" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (/^(fc|fd)[0-9a-f]{2}:/i.test(h) || /^fe80:/i.test(h)) return true;
  return false;
}

export default defineTool({
  name: "fetch_robots_txt",
  title: "Fetch robots.txt",
  description: "Fetch the robots.txt file for a domain and return its raw content plus discovered sitemap URLs.",
  inputSchema: {
    domain: z.string().min(1).describe('Domain or origin, e.g. "example.com" or "https://example.com".'),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ domain }) => {
    let origin: string;
    try {
      const u = new URL(domain.startsWith("http") ? domain : `https://${domain}`);
      origin = u.origin;
      if (isPrivateHost(u.hostname)) {
        return { content: [{ type: "text", text: "Private or internal hosts are not allowed" }], isError: true };
      }
    } catch {
      return { content: [{ type: "text", text: "Invalid domain" }], isError: true };
    }

    const target = `${origin}/robots.txt`;
    try {
      const res = await fetch(target, {
        redirect: "follow",
        headers: { "User-Agent": UA, Accept: "text/plain,*/*" },
        signal: AbortSignal.timeout(15000),
      });
      const text = await res.text();
      const sitemaps = Array.from(text.matchAll(/^\s*sitemap\s*:\s*(\S+)/gim)).map((m) => m[1]);
      const result = { url: target, status: res.status, finalUrl: res.url, content: text, sitemaps };
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
