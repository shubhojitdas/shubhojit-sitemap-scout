import { motion } from "framer-motion";
import { Globe, CheckCircle, XCircle, BarChart3 } from "lucide-react";
import { CrawlResult } from "@/lib/crawl-api";

interface StatsCardsProps {
  results: CrawlResult[];
}

export function StatsCards({ results }: StatsCardsProps) {
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

  const stats = [
    { label: "Total URLs", value: total.toLocaleString(), icon: Globe, color: "text-primary" },
    { label: "Successful", value: success.toLocaleString(), icon: CheckCircle, color: "text-success" },
    { label: "Errors", value: `${errors} (${errorRate}%)`, icon: XCircle, color: "text-destructive" },
    { label: "Avg Title / Desc", value: `${avgTitleLen} / ${avgDescLen} chars`, icon: BarChart3, color: "text-warning" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
