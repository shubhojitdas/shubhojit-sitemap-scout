import { supabase } from "@/integrations/supabase/client";

export interface CrawlResult {
  url: string;
  title: string;
  description: string;
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

export async function fetchMetaBatch(urls: string[]): Promise<CrawlResult[]> {
  const { data, error } = await supabase.functions.invoke("crawl-sitemap-batch", {
    body: { urls },
  });

  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);
  return data.results || [];
}

export function generateCSV(results: CrawlResult[]): string {
  const header = "URL,Meta Title,Meta Description,Status,Response Code,Fetch Time";
  const rows = results.map((r) => {
    const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
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
