import { AuditReport } from "@/components/AuditReport";
import type { CrawlResult } from "@/lib/crawl-api";
import type { FieldFlags } from "@/lib/seo-issues";

/** Dev-only harness used to QA the printed A4 audit report. */
const flags: FieldFlags = {
  includeTitle: true,
  includeDesc: true,
  includeH1: true,
  includeH2: true,
  includeH3: true,
  includeImages: true,
  includeSchemas: true,
  includeRobots: true,
  includeCanonical: true,
  includeHreflangs: true,
  includeInternalLinks: true,
  includeSocialTags: true,
};

const results: CrawlResult[] = Array.from({ length: 60 }, (_, i) => {
  const url = `https://example-shop.com/collections/very-long-category-name-${i}/product-handle-${i}-with-extra-slug`;
  return {
    url,
    statusCode: i === 7 ? 404 : i === 9 ? 301 : 200,
    title: i % 3 === 0 ? "Duplicate title for testing pagination" : `Product ${i}`,
    description: i % 4 === 0 ? "" : `Description ${i}`,
    h1s: i % 2 === 0 ? [] : [`H1 ${i}`, `Second H1 ${i}`],
    h2s: [],
    h3s: [],
    canonical: i % 5 === 0 ? "" : url,
    canonicalStatus: i % 5 === 0 ? "Missing" : "Self-referencing",
    robots: i % 11 === 0 ? "noindex,nofollow" : "index,follow",
    images: [{ src: `${url}/img.avif`, alt: "" }],
    schemas: [],
    hreflangs: [],
    internalLinks: i === 0 ? [{ url: results0Link(i), anchor: "x", isInternal: true }] : [],
    hopCount: i === 9 ? 2 : 0,
    finalUrl: url,
    redirectChain: i === 9 ? [{ url, status: 301 }] : [],
  } as unknown as CrawlResult;
});

function results0Link(i: number) {
  return `https://example-shop.com/collections/very-long-category-name-${i + 1}/product-handle-${i + 1}-with-extra-slug`;
}

export default function ReportPrintTest() {
  return (
    <div className="p-4">
      <AuditReport
        results={results}
        domain="example-shop.com"
        flags={flags}
        crawlCompletedAt={new Date().toISOString()}
      />
    </div>
  );
}
