import { supabase } from "@/integrations/supabase/client";

export interface ImageData {
  src: string;
  alt: string | null;
}

export interface CrawlResult {
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
  status: "OK" | "Error";
  statusCode: number;
  redirectedUrl?: string;
  fetchTime: string;
}

export async function parseSitemapUrls(sitemapUrl: string): Promise<string[]> {
  const { data, error } = await supabase.functions.invoke("crawl-sitemap", {
    body: { sitemapUrl },
  });

  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);
  return data.urls || [];
}

export async function fetchMetaBatch(
  urls: string[],
  includeTitle = true,
  includeDesc = true,
  includeH1 = false,
  includeH2 = false,
  includeH3 = false,
  includeImages = false,
  includeSchemas = false,
  includeRobots = false,
  includeCanonical = false,
): Promise<CrawlResult[]> {
  const { data, error } = await supabase.functions.invoke("crawl-sitemap-batch", {
    body: { urls, includeTitle, includeDesc, includeH1, includeH2, includeH3, includeImages, includeSchemas, includeRobots, includeCanonical },
  });

  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);
  return data.results || [];
}

export function generateCSV(
  results: CrawlResult[],
  includeTitle = true,
  includeDesc = true,
  includeH1 = false,
  includeH2 = false,
  includeH3 = false,
  includeImages = false,
  includeRobots = false,
): string {
  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;

  if (includeImages) {
    const header = "Page URL,Image URL,Alt Text,Image Count";
    const rows: string[] = [];
    results.forEach((r) => {
      const images = r.images ?? [];
      if (images.length === 0) {
        rows.push(`${escape(r.url)},${escape("")},${escape("No images found")},0`);
      } else {
        images.forEach((img) => {
          rows.push(`${escape(r.url)},${escape(img.src)},${escape(img.alt ?? "No alt text")},${images.length}`);
        });
      }
    });
    return [header, ...rows].join("\n");
  }

  const headerParts = ["URL"];
  if (includeTitle) headerParts.push("Meta Title");
  if (includeDesc) headerParts.push("Meta Description");
  if (includeH1) headerParts.push("H1 Tags", "H1 Count");
  if (includeH2) headerParts.push("H2 Tags", "H2 Count");
  if (includeH3) headerParts.push("H3 Tags", "H3 Count");
  if (includeRobots) headerParts.push("Meta Robots");
  headerParts.push("Status", "Response Code", "Fetch Time");
  const header = headerParts.join(",");

  const rows = results.map((r) => {
    const parts = [escape(r.url)];
    if (includeTitle) parts.push(escape(r.title));
    if (includeDesc) parts.push(escape(r.description));
    if (includeH1) { parts.push(escape((r.h1s ?? []).join(" | ")), String((r.h1s ?? []).length)); }
    if (includeH2) { parts.push(escape((r.h2s ?? []).join(" | ")), String((r.h2s ?? []).length)); }
    if (includeH3) { parts.push(escape((r.h3s ?? []).join(" | ")), String((r.h3s ?? []).length)); }
    if (includeRobots) { parts.push(escape(r.robots ?? '')); }
    parts.push(r.status, String(r.statusCode), r.fetchTime);
    return parts.join(",");
  });
  return [header, ...rows].join("\n");
}

export function downloadCSV(csv: string, domain: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sitemap-${domain}-${timestamp}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
