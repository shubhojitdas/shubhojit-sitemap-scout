import { motion } from "framer-motion";
import { Globe, CheckCircle, XCircle, BarChart3, Heading1, Image } from "lucide-react";
import { CrawlResult } from "@/lib/crawl-api";

interface StatsCardsProps {
  results: CrawlResult[];
  includeH1: boolean;
  includeH2: boolean;
  includeH3: boolean;
  includeImages: boolean;
}

export function StatsCards({ results, includeH1, includeH2, includeH3, includeImages }: StatsCardsProps) {
  if (results.length === 0) return null;

  const total = results.length;
  const success = results.filter((r) => r.status === "OK").length;
  const errors = total - success;
  const errorRate = total > 0 ? ((errors / total) * 100).toFixed(1) : "0";
  const avgTitleLen = Math.round(
    results.filter((r) => r.title).reduce((sum, r) => sum + r.title.length, 0) /
      (results.filter((r) => r.title).length || 1)
  );
  const avgDescLen = Math.round(
    results.filter((r) => r.description).reduce((sum, r) => sum + r.description.length, 0) /
      (results.filter((r) => r.description).length || 1)
  );

  const pagesWithMultiH1 = results.filter((r) => (r.h1s ?? []).length > 1).length;
  const pagesWithNoH1 = results.filter((r) => (r.h1s ?? []).length === 0).length;
  const pagesWithH1 = results.filter((r) => (r.h1s ?? []).length >= 1).length;

  const pagesWithH2 = results.filter((r) => (r.h2s ?? []).length >= 1).length;
  const pagesWithNoH2 = results.filter((r) => (r.h2s ?? []).length === 0).length;
  const totalH2s = results.reduce((sum, r) => sum + (r.h2s ?? []).length, 0);

  const pagesWithH3 = results.filter((r) => (r.h3s ?? []).length >= 1).length;
  const pagesWithNoH3 = results.filter((r) => (r.h3s ?? []).length === 0).length;
  const totalH3s = results.reduce((sum, r) => sum + (r.h3s ?? []).length, 0);

  const totalImages = results.reduce((sum, r) => sum + (r.images ?? []).length, 0);
  const pagesWithMissingAlt = results.filter((r) =>
    (r.images ?? []).some((img) => img.alt === null)
  ).length;
  const pagesWithNoImages = results.filter((r) => (r.images ?? []).length === 0).length;

  const baseStats = [
    { label: "Total URLs", value: total.toLocaleString(), icon: Globe, color: "text-foreground" },
    { label: "Successful", value: success.toLocaleString(), icon: CheckCircle, color: "text-success" },
    { label: "Errors", value: `${errors} (${errorRate}%)`, icon: XCircle, color: "text-destructive" },
    { label: "Avg Title / Desc", value: `${avgTitleLen} / ${avgDescLen}`, icon: BarChart3, color: "text-warning" },
  ];

  const h1Stats = [
    { label: "With H1", value: pagesWithH1.toLocaleString(), icon: Heading1, color: "text-foreground" },
    { label: "No H1", value: pagesWithNoH1.toLocaleString(), icon: Heading1, color: "text-destructive" },
    { label: "Multiple H1s", value: results.filter((r) => (r.h1s ?? []).length > 1).length.toLocaleString(), icon: Heading1, color: "text-warning" },
  ];

  const h2Stats = [
    { label: "With H2", value: pagesWithH2.toLocaleString(), icon: Heading1, color: "text-foreground" },
    { label: "No H2", value: pagesWithNoH2.toLocaleString(), icon: Heading1, color: "text-destructive" },
    { label: "Total H2s", value: totalH2s.toLocaleString(), icon: Heading1, color: "text-muted-foreground" },
  ];

  const h3Stats = [
    { label: "With H3", value: pagesWithH3.toLocaleString(), icon: Heading1, color: "text-foreground" },
    { label: "No H3", value: pagesWithNoH3.toLocaleString(), icon: Heading1, color: "text-destructive" },
    { label: "Total H3s", value: totalH3s.toLocaleString(), icon: Heading1, color: "text-muted-foreground" },
  ];

  const imageStats = [
    { label: "Total Images", value: totalImages.toLocaleString(), icon: Image, color: "text-foreground" },
    { label: "Missing Alt", value: pagesWithMissingAlt.toLocaleString(), icon: Image, color: "text-destructive" },
    { label: "No Images", value: pagesWithNoImages.toLocaleString(), icon: Image, color: "text-muted-foreground" },
  ];

  const stats = [
    ...baseStats,
    ...(includeH1 ? h1Stats : []),
    ...(includeH2 ? h2Stats : []),
    ...(includeH3 ? h3Stats : []),
    ...(includeImages ? imageStats : []),
  ];

  const colCount = stats.length;
  const cols =
    colCount <= 4 ? "grid-cols-2 lg:grid-cols-4" :
    colCount <= 7 ? "grid-cols-2 lg:grid-cols-4 xl:grid-cols-7" :
    "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-10";

  return (
    <div className={`grid ${cols} gap-2`}>
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.03 }}
          className="rounded-lg p-3 border border-border bg-card"
        >
          <div className="flex items-center gap-1.5 mb-0.5">
            <stat.icon className={`h-3 w-3 ${stat.color} opacity-60`} />
            <span className="text-[11px] text-muted-foreground">{stat.label}</span>
          </div>
          <p className="text-lg font-semibold tracking-tight">{stat.value}</p>
        </motion.div>
      ))}
    </div>
  );
}
