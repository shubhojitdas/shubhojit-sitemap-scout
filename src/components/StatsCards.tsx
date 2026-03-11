import { motion } from "framer-motion";
import { Globe, CheckCircle, XCircle, BarChart3, Heading1 } from "lucide-react";
import { CrawlResult } from "@/lib/crawl-api";

interface StatsCardsProps {
  results: CrawlResult[];
  includeH1: boolean;
}

export function StatsCards({ results, includeH1 }: StatsCardsProps) {
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

  const baseStats = [
    { label: "Total URLs", value: total.toLocaleString(), icon: Globe, color: "text-primary" },
    { label: "Successful", value: success.toLocaleString(), icon: CheckCircle, color: "text-success" },
    { label: "Errors", value: `${errors} (${errorRate}%)`, icon: XCircle, color: "text-destructive" },
    { label: "Avg Title / Desc", value: `${avgTitleLen} / ${avgDescLen} chars`, icon: BarChart3, color: "text-warning" },
  ];

  const h1Stats = [
    { label: "Pages with H1", value: pagesWithH1.toLocaleString(), icon: Heading1, color: "text-primary" },
    { label: "No H1", value: pagesWithNoH1.toLocaleString(), icon: Heading1, color: "text-destructive" },
    { label: "Multiple H1s", value: pagesWithMultiH1.toLocaleString(), icon: Heading1, color: "text-warning" },
  ];

  const stats = includeH1 ? [...baseStats, ...h1Stats] : baseStats;
  const cols = includeH1 ? "grid-cols-2 lg:grid-cols-4 xl:grid-cols-7" : "grid-cols-2 lg:grid-cols-4";

  return (
    <div className={`grid ${cols} gap-3`}>
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="bg-card rounded-lg p-4 card-elevated border border-border/50"
        >
          <div className="flex items-center gap-2 mb-1">
            <stat.icon className={`h-4 w-4 ${stat.color}`} />
            <span className="text-xs text-muted-foreground font-medium">{stat.label}</span>
          </div>
          <p className="text-lg font-bold tracking-tight">{stat.value}</p>
        </motion.div>
      ))}
    </div>
  );
}
