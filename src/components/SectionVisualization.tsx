import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { motion } from "framer-motion";
import type { CrawlResult } from "@/lib/crawl-api";

/**
 * Small horizontal stat strip + donut shown above each results section.
 * Gives users an at-a-glance visual of "how much is missing / has issues"
 * before they dive into filters.
 *
 * Pure derivative — receives the section key and computes its own buckets.
 */
export type SectionKey =
  | "page-titles" | "meta-description" | "h1" | "h2" | "h3"
  | "images" | "schema" | "meta-robots" | "canonicals" | "hreflang"
  | "internal-links" | "social" | "internal" | "response-codes";

interface Bucket {
  label: string;
  value: number;
  tone: "ok" | "warn" | "bad" | "muted" | "accent";
}

const TONE_HSL: Record<Bucket["tone"], string> = {
  ok: "hsl(var(--success))",
  warn: "hsl(var(--warning))",
  bad: "hsl(var(--destructive))",
  muted: "hsl(var(--muted-foreground) / 0.55)",
  accent: "hsl(var(--foreground))",
};

function buildBuckets(view: SectionKey, rows: CrawlResult[]): Bucket[] {
  const total = rows.length;
  const ok2xx = rows.filter((r) => r.statusCode >= 200 && r.statusCode < 300);

  switch (view) {
    case "page-titles": {
      const present = ok2xx.filter((r) => !!r.title);
      const missing = ok2xx.length - present.length;
      const tooLong = present.filter((r) => r.title.length > 60).length;
      const tooShort = present.filter((r) => r.title.length > 0 && r.title.length < 30).length;
      const ok = present.length - tooLong - tooShort;
      return [
        { label: "Optimal length", value: ok, tone: "ok" },
        { label: "Too long (>60)", value: tooLong, tone: "warn" },
        { label: "Too short (<30)", value: tooShort, tone: "warn" },
        { label: "Missing", value: missing, tone: "bad" },
      ];
    }
    case "meta-description": {
      const present = ok2xx.filter((r) => !!r.description);
      const missing = ok2xx.length - present.length;
      const tooLong = present.filter((r) => r.description.length > 160).length;
      const tooShort = present.filter((r) => r.description.length > 0 && r.description.length < 70).length;
      const ok = present.length - tooLong - tooShort;
      return [
        { label: "Optimal (70–160)", value: ok, tone: "ok" },
        { label: "Too long (>160)", value: tooLong, tone: "warn" },
        { label: "Too short (<70)", value: tooShort, tone: "warn" },
        { label: "Missing", value: missing, tone: "bad" },
      ];
    }
    case "h1": {
      const counts = ok2xx.map((r) => (r.h1s ?? []).length);
      const single = counts.filter((c) => c === 1).length;
      const multi = counts.filter((c) => c > 1).length;
      const missing = counts.filter((c) => c === 0).length;
      return [
        { label: "Single H1", value: single, tone: "ok" },
        { label: "Multiple H1s", value: multi, tone: "warn" },
        { label: "Missing H1", value: missing, tone: "bad" },
      ];
    }
    case "h2":
    case "h3": {
      const key = view === "h2" ? "h2s" : "h3s";
      const present = ok2xx.filter((r) => (r[key as keyof CrawlResult] as string[] | undefined)?.length).length;
      return [
        { label: `Has ${view.toUpperCase()}`, value: present, tone: "ok" },
        { label: `No ${view.toUpperCase()}`, value: ok2xx.length - present, tone: "muted" },
      ];
    }
    case "images": {
      let withAlt = 0, missingAlt = 0, pagesWithImages = 0, pagesWithoutImages = 0;
      for (const r of ok2xx) {
        const imgs = r.images ?? [];
        if (imgs.length === 0) pagesWithoutImages++;
        else pagesWithImages++;
        for (const i of imgs) {
          if (i.alt) withAlt++; else missingAlt++;
        }
      }
      return [
        { label: "Images with alt", value: withAlt, tone: "ok" },
        { label: "Missing alt", value: missingAlt, tone: "bad" },
        { label: "Pages with images", value: pagesWithImages, tone: "accent" },
        { label: "Pages w/o images", value: pagesWithoutImages, tone: "muted" },
      ];
    }
    case "schema": {
      const has = ok2xx.filter((r) => (r.schemas ?? []).length > 0).length;
      return [
        { label: "Has schema", value: has, tone: "ok" },
        { label: "No schema", value: ok2xx.length - has, tone: "muted" },
      ];
    }
    case "meta-robots": {
      const noindex = ok2xx.filter((r) => (r.robots ?? "").toLowerCase().includes("noindex")).length;
      const nofollow = ok2xx.filter((r) => (r.robots ?? "").toLowerCase().includes("nofollow")).length;
      const present = ok2xx.filter((r) => (r.robots ?? "").length > 0).length;
      return [
        { label: "Has robots", value: present, tone: "ok" },
        { label: "noindex", value: noindex, tone: "warn" },
        { label: "nofollow", value: nofollow, tone: "warn" },
        { label: "No tag", value: ok2xx.length - present, tone: "muted" },
      ];
    }
    case "canonicals": {
      let self = 0, other = 0, missing = 0;
      for (const r of ok2xx) {
        if (!r.canonical) missing++;
        else if (r.canonicalStatus === "Canonicalised") other++;
        else self++;
      }
      return [
        { label: "Self-referencing", value: self, tone: "ok" },
        { label: "Canonicalised", value: other, tone: "warn" },
        { label: "Missing", value: missing, tone: "bad" },
      ];
    }
    case "hreflang": {
      const has = ok2xx.filter((r) => (r.hreflangs ?? []).length > 0).length;
      const xDef = ok2xx.filter((r) => (r.hreflangs ?? []).some((h) => h.hreflang === "x-default")).length;
      return [
        { label: "Has hreflang", value: has, tone: "ok" },
        { label: "Has x-default", value: xDef, tone: "accent" },
        { label: "No hreflang", value: ok2xx.length - has, tone: "muted" },
      ];
    }
    case "internal-links": {
      const has = ok2xx.filter((r) => (r.internalLinks ?? []).some((l) => l.isInternal)).length;
      const ext = ok2xx.filter((r) => (r.internalLinks ?? []).some((l) => !l.isInternal)).length;
      return [
        { label: "Has internal", value: has, tone: "ok" },
        { label: "Has external", value: ext, tone: "accent" },
        { label: "No links", value: ok2xx.length - has, tone: "muted" },
      ];
    }
    case "social": {
      const hasOg = (r: CrawlResult) => (r.socialTags ?? []).some((t) => t.network === "og");
      const hasTw = (r: CrawlResult) => (r.socialTags ?? []).some((t) => t.network === "twitter");
      const ogOnly = ok2xx.filter((r) => hasOg(r) && !hasTw(r)).length;
      const twOnly = ok2xx.filter((r) => !hasOg(r) && hasTw(r)).length;
      const both = ok2xx.filter((r) => hasOg(r) && hasTw(r)).length;
      const none = ok2xx.filter((r) => !hasOg(r) && !hasTw(r)).length;
      return [
        { label: "Has OG + Twitter", value: both, tone: "ok" },
        { label: "Has OG only", value: ogOnly, tone: "accent" },
        { label: "Has Twitter only", value: twOnly, tone: "warn" },
        { label: "Missing both", value: none, tone: "bad" },
      ];
    }
    case "response-codes": {
      const c2 = rows.filter((r) => r.statusCode >= 200 && r.statusCode < 300).length;
      const c3 = rows.filter((r) => r.statusCode >= 300 && r.statusCode < 400).length;
      const c4 = rows.filter((r) => r.statusCode >= 400 && r.statusCode < 500).length;
      const c5 = rows.filter((r) => r.statusCode >= 500).length;
      const err = rows.filter((r) => r.status === "Error").length;
      return [
        { label: "2xx OK", value: c2, tone: "ok" },
        { label: "3xx Redirect", value: c3, tone: "warn" },
        { label: "4xx Client", value: c4, tone: "bad" },
        { label: "5xx Server", value: c5, tone: "bad" },
        { label: "Network error", value: err, tone: "muted" },
      ];
    }
    case "internal":
    default:
      return [{ label: "Total URLs", value: total, tone: "accent" }];
  }
}

interface Props {
  view: SectionKey;
  results: CrawlResult[];
}

export function SectionVisualization({ view, results }: Props) {
  const buckets = buildBuckets(view, results).filter((b) => b.value >= 0);
  const totalNonZero = buckets.reduce((s, b) => s + b.value, 0);
  if (totalNonZero === 0) return null;

  const pieData = buckets.filter((b) => b.value > 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-lg border border-border bg-card p-3 grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-3 items-center"
    >
      <div className="h-[110px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="label"
              cx="50%" cy="50%"
              innerRadius={28} outerRadius={50}
              paddingAngle={pieData.length > 1 ? 2 : 0}
              stroke="hsl(var(--background))"
              strokeWidth={1.5}
            >
              {pieData.map((b, i) => (
                <Cell key={i} fill={TONE_HSL[b.tone]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 11,
                color: "hsl(var(--popover-foreground))",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {buckets.map((b) => (
          <div
            key={b.label}
            className="rounded-md border border-border/60 bg-muted/30 px-2 py-1.5"
          >
            <div className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: TONE_HSL[b.tone] }}
              />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">
                {b.label}
              </span>
            </div>
            <div className="text-base font-semibold tabular-nums mt-0.5">
              {b.value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
