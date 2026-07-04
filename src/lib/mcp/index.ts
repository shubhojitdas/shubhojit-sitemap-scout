import { defineMcp } from "@lovable.dev/mcp-js";
import fetchPageSeo from "./tools/fetch-page-seo";
import fetchRobotsTxt from "./tools/fetch-robots-txt";
import listSitemapUrls from "./tools/list-sitemap-urls";

export default defineMcp({
  name: "sitemap-scout-mcp",
  title: "Sitemap Scout MCP",
  version: "0.1.0",
  instructions:
    "Sitemap Scout tools for technical SEO. Use `fetch_page_seo` to inspect a single URL's metadata, `fetch_robots_txt` to read a site's robots.txt and discover sitemaps, and `list_sitemap_urls` to enumerate URLs from a sitemap or sitemap index.",
  tools: [fetchPageSeo, fetchRobotsTxt, listSitemapUrls],
});
