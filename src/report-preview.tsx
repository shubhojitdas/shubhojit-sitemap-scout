import { createRoot } from "react-dom/client";
import { AuditReport } from "@/components/AuditReport";
import type { CrawlResult } from "@/lib/crawl-api";
import type { FieldFlags } from "@/lib/seo-issues";
import "./index.css";

const flags: FieldFlags = {
  includeTitle: true, includeDesc: true, includeH1: true, includeH2: true, includeH3: true,
  includeImages: true, includeSchemas: true, includeRobots: true, includeCanonical: true,
  includeHreflangs: true, includeInternalLinks: true, includeSocialTags: true,
};
const base = "https://niccoparks.com";
const paths = ["/", "/about", "/about/team", "/tickets", "/tickets/family", "/blog", "/blog/post-a", "/blog/post-b", "/rides", "/rides/water", "/rides/thrill", "/contact", "/faq", "/gone", "/old-page", "/deep/a/b/c/d"];
const results: CrawlResult[] = paths.map((p, i) => {
  const url = base + p;
  const links = paths.slice(0, i % 5 === 0 ? 0 : 4).map((t) => ({ url: base + t, anchorText: t, isInternal: true, rel: "" } as any));
  const code = p === "/gone" ? 404 : p === "/old-page" ? 301 : 200;
  return {
    url, title: i % 3 === 0 ? "Nicco Parks — Amusement Park in Kolkata" : `Page ${p}`,
    description: i % 4 === 0 ? "" : "A description of the page that is reasonably long for testing purposes only.",
    h1s: i % 5 === 0 ? [] : [`Heading ${p}`], h2s: ["h2"], h3s: [],
    images: [{ src: base + "/a.jpg", alt: i % 2 ? "" : "alt" } as any],
    schemas: i % 2 ? ["Organization"] : [], robots: i % 6 === 0 ? "noindex" : "index,follow",
    canonical: url, canonicalStatus: "Self Referencing", hreflangs: [], internalLinks: links,
    socialTags: [], status: code === 200 ? "OK" : "Error", statusCode: code,
    redirectChain: code === 301 ? ([{ url, status: 301, type: "http" }] as any) : [],
    initialUrl: url, finalUrl: code === 301 ? base + "/tickets" : url, hopCount: code === 301 ? 1 : 0,
    fetchTime: new Date().toISOString(),
  } as CrawlResult;
});
createRoot(document.getElementById("root")!).render(
  <div className="p-6"><AuditReport results={results} domain="niccoparks.com" flags={flags} crawlCompletedAt={new Date().toISOString()} /></div>
);
