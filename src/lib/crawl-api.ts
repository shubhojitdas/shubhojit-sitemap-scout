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
  status: "OK" | "Error";
  statusCode: number;
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

export async function fetchMetaBatch(urls: string[], includeH1 = false, includeH2 = false, includeH3 = false, includeImages = false): Promise<CrawlResult[]> {
  const { data, error } = await supabase.functions.invoke("crawl-sitemap-batch", {
    body: { urls, includeH1, includeH2, includeH3, includeImages },
  });

  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);
  return data.results || [];
}

export function generateCSV(results: CrawlResult[], includeH1 = false, includeImages = false): string {
  // If images mode: one row per image, expanding each page into N image rows
  if (includeImages) {
    const header = "Page URL,Image URL,Alt Text,Image Count";
    const rows: string[] = [];
    const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
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

  const header = includeH1
    ? "URL,Meta Title,Meta Description,H1 Tags,H1 Count,Status,Response Code,Fetch Time"
    : "URL,Meta Title,Meta Description,Status,Response Code,Fetch Time";

  const rows = results.map((r) => {
    const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
    if (includeH1) {
      const h1Joined = (r.h1s ?? []).join(" | ");
      const h1Count = (r.h1s ?? []).length;
      return `${escape(r.url)},${escape(r.title)},${escape(r.description)},${escape(h1Joined)},${h1Count},${r.status},${r.statusCode},${r.fetchTime}`;
    }
    return `${escape(r.url)},${escape(r.title)},${escape(r.description)},${r.status},${r.statusCode},${r.fetchTime}`;
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
