import { motion } from "framer-motion";
import { Globe, CheckCircle, XCircle, BarChart3, Heading1, Image, Code, Bot, ChevronDown } from "lucide-react";
import { CrawlResult } from "@/lib/crawl-api";
import { useState } from "react";

interface StatsCardsProps {
  results: CrawlResult[];
  includeTitle: boolean;
  includeDesc: boolean;
  includeH1: boolean;
  includeH2: boolean;
  includeH3: boolean;
  includeImages: boolean;
  includeSchemas: boolean;
  includeRobots: boolean;
}

interface StatItem {
  label: string;
  value: string;
  color?: string;
}

interface StatGroup {
  title: string;
  icon: React.ElementType;
  stats: StatItem[];
}

function StatGroupCard({ group, index }: { group: StatGroup; index: number }) {
  const [open, setOpen] = useState(true);
  const Icon = group.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-lg border border-border bg-card overflow-hidden"
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <Icon className="h-3 w-3 text-muted-foreground" />
          <span className="text-[11px] font-medium text-foreground">{group.title}</span>
        </div>
        <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-3 pb-2.5 pt-0.5 grid grid-cols-3 gap-x-4 gap-y-1">
          {group.stats.map((s) => (
            <div key={s.label} className="flex items-baseline justify-between gap-2">
              <span className="text-[10px] text-muted-foreground truncate">{s.label}</span>
              <span className={`text-xs font-semibold tabular-nums ${s.color ?? "text-foreground"}`}>{s.value}</span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export function StatsCards({ results, includeTitle, includeDesc, includeH1, includeH2, includeH3, includeImages, includeSchemas, includeRobots }: StatsCardsProps) {
  if (results.length === 0) return null;

  const total = results.length;
  const success = results.filter((r) => r.status === "OK").length;
  const errors = total - success;
  const errorRate = total > 0 ? ((errors / total) * 100).toFixed(1) : "0";

  const groups: StatGroup[] = [];

  // Overview — always shown
  const overviewStats: StatItem[] = [
    { label: "Total URLs", value: total.toLocaleString() },
    { label: "Successful", value: success.toLocaleString(), color: "text-success" },
    { label: "Errors", value: `${errors} (${errorRate}%)`, color: errors > 0 ? "text-destructive" : undefined },
  ];
  if (includeTitle) {
    const avg = Math.round(results.filter((r) => r.title).reduce((s, r) => s + r.title.length, 0) / (results.filter((r) => r.title).length || 1));
    overviewStats.push({ label: "Avg Title Len", value: String(avg) });
  }
  if (includeDesc) {
    const avg = Math.round(results.filter((r) => r.description).reduce((s, r) => s + r.description.length, 0) / (results.filter((r) => r.description).length || 1));
    overviewStats.push({ label: "Avg Desc Len", value: String(avg) });
  }
  groups.push({ title: "Overview", icon: Globe, stats: overviewStats });

  if (includeH1) {
    groups.push({
      title: "H1 Tags",
      icon: Heading1,
      stats: [
        { label: "With H1", value: results.filter((r) => (r.h1s ?? []).length >= 1).length.toLocaleString() },
        { label: "No H1", value: results.filter((r) => (r.h1s ?? []).length === 0).length.toLocaleString(), color: "text-destructive" },
        { label: "Multiple H1s", value: results.filter((r) => (r.h1s ?? []).length > 1).length.toLocaleString(), color: "text-warning" },
      ],
    });
  }

  if (includeH2) {
    groups.push({
      title: "H2 Tags",
      icon: Heading1,
      stats: [
        { label: "With H2", value: results.filter((r) => (r.h2s ?? []).length >= 1).length.toLocaleString() },
        { label: "No H2", value: results.filter((r) => (r.h2s ?? []).length === 0).length.toLocaleString(), color: "text-destructive" },
        { label: "Total H2s", value: results.reduce((s, r) => s + (r.h2s ?? []).length, 0).toLocaleString() },
      ],
    });
  }

  if (includeH3) {
    groups.push({
      title: "H3 Tags",
      icon: Heading1,
      stats: [
        { label: "With H3", value: results.filter((r) => (r.h3s ?? []).length >= 1).length.toLocaleString() },
        { label: "No H3", value: results.filter((r) => (r.h3s ?? []).length === 0).length.toLocaleString(), color: "text-destructive" },
        { label: "Total H3s", value: results.reduce((s, r) => s + (r.h3s ?? []).length, 0).toLocaleString() },
      ],
    });
  }

  if (includeImages) {
    const totalImgs = results.reduce((s, r) => s + (r.images ?? []).length, 0);
    groups.push({
      title: "Images",
      icon: Image,
      stats: [
        { label: "Total Images", value: totalImgs.toLocaleString() },
        { label: "Missing Alt", value: results.filter((r) => (r.images ?? []).some((img) => img.alt === null)).length.toLocaleString(), color: "text-destructive" },
        { label: "No Images", value: results.filter((r) => (r.images ?? []).length === 0).length.toLocaleString() },
      ],
    });
  }

  if (includeSchemas) {
    groups.push({
      title: "Schema Markup",
      icon: Code,
      stats: [
        { label: "With Schema", value: results.filter((r) => (r.schemas ?? []).length > 0).length.toLocaleString() },
        { label: "No Schema", value: results.filter((r) => (r.schemas ?? []).length === 0).length.toLocaleString(), color: "text-destructive" },
        { label: "Total Schemas", value: results.reduce((s, r) => s + (r.schemas ?? []).length, 0).toLocaleString() },
      ],
    });
  }

  if (includeRobots) {
    groups.push({
      title: "Meta Robots",
      icon: Bot,
      stats: [
        { label: "Has Robots", value: results.filter((r) => (r.robots ?? "").length > 0).length.toLocaleString() },
        { label: "Noindex", value: results.filter((r) => (r.robots ?? "").toLowerCase().includes("noindex")).length.toLocaleString(), color: "text-destructive" },
        { label: "Nofollow", value: results.filter((r) => (r.robots ?? "").toLowerCase().includes("nofollow")).length.toLocaleString(), color: "text-warning" },
      ],
    });
  }

  const colClass = groups.length <= 2 ? "grid-cols-1 sm:grid-cols-2" :
    groups.length <= 3 ? "grid-cols-1 sm:grid-cols-3" :
    "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";

  return (
    <div className={`grid ${colClass} gap-2`}>
      {groups.map((g, i) => (
        <StatGroupCard key={g.title} group={g} index={i} />
      ))}
    </div>
  );
}
