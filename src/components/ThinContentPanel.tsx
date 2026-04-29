import { useMemo } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { FileText, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { CrawlResult } from "@/lib/crawl-api";

interface Props {
  results: CrawlResult[];
}

type Tier = "very-thin" | "thin" | "healthy";

function classify(wc: number): Tier {
  if (wc < 100) return "very-thin";
  if (wc < 300) return "thin";
  return "healthy";
}

const TIER_META: Record<Tier, { label: string; color: string; bg: string; tone: string }> = {
  "very-thin": { label: "Very thin", color: "hsl(var(--destructive))", bg: "bg-destructive/10", tone: "text-destructive" },
  thin:        { label: "Thin",      color: "hsl(var(--warning))",     bg: "bg-warning/10",     tone: "text-warning" },
  healthy:     { label: "Healthy",   color: "hsl(var(--success))",     bg: "bg-success/10",     tone: "text-success" },
};

/**
 * Thin-content distribution + per-URL breakdown for crawled pages.
 * Uses the cheap `wordCount` populated by the edge function.
 */
export function ThinContentPanel({ results }: Props) {
  const { rows, buckets, hasData, weakest } = useMemo(() => {
    const ok = results.filter((r) => r.statusCode >= 200 && r.statusCode < 300);
    const withWc = ok.filter((r) => typeof r.wordCount === "number");
    if (!withWc.length) {
      return { rows: [], buckets: [], hasData: false, weakest: [] as CrawlResult[] };
    }
    const counts: Record<Tier, number> = { "very-thin": 0, thin: 0, healthy: 0 };
    for (const r of withWc) counts[classify(r.wordCount ?? 0)]++;
    const buckets = (["very-thin", "thin", "healthy"] as Tier[]).map((t) => ({
      tier: t,
      label: TIER_META[t].label,
      count: counts[t],
    }));
    const weakest = [...withWc]
      .sort((a, b) => (a.wordCount ?? 0) - (b.wordCount ?? 0))
      .slice(0, 25);
    return { rows: withWc, buckets, hasData: true, weakest };
  }, [results]);

  if (!hasData) {
    return (
      <div className="rounded-lg border border-border bg-card p-3 flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <p className="text-xs text-muted-foreground">
          Word count data not available for this crawl. Re-run the crawl to enable thin-content detection.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center gap-2 flex-wrap">
        <FileText className="h-3.5 w-3.5 text-warning" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/80">
          Content quality (word count)
        </span>
        <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal ml-auto">
          {rows.length} pages
        </Badge>
      </div>

      <div className="grid md:grid-cols-3 gap-3 p-3">
        {buckets.map((b) => (
          <div key={b.tier} className={`rounded-md border border-border p-3 ${TIER_META[b.tier].bg}`}>
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              {b.tier === "healthy" ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
              {b.label}
            </div>
            <div className={`text-xl font-semibold tabular-nums ${TIER_META[b.tier].tone}`}>
              {b.count.toLocaleString()}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {b.tier === "very-thin" && "< 100 words"}
              {b.tier === "thin" && "100–299 words"}
              {b.tier === "healthy" && "300+ words"}
            </div>
          </div>
        ))}
      </div>

      <div className="px-3 pb-3">
        <div className="h-[140px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={buckets}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={28} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
                cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {buckets.map((b) => (
                  <Cell key={b.tier} fill={TIER_META[b.tier].color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-foreground/70">
          Weakest pages by word count
        </div>
        <ScrollArea className="h-[200px]">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_hsl(var(--border))]">
              <tr>
                <th className="text-left px-3 py-1.5 font-medium text-muted-foreground bg-card">URL</th>
                <th className="text-right px-3 py-1.5 font-medium text-muted-foreground bg-card">Words</th>
                <th className="text-right px-3 py-1.5 font-medium text-muted-foreground bg-card">Status</th>
              </tr>
            </thead>
            <tbody>
              {weakest.map((r) => {
                const tier = classify(r.wordCount ?? 0);
                return (
                  <tr key={r.url} className="border-t border-border hover:bg-muted/30">
                    <td className="px-3 py-1.5 truncate max-w-0 font-mono">
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        {r.url}
                      </a>
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{r.wordCount?.toLocaleString()}</td>
                    <td className="px-3 py-1.5 text-right">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${TIER_META[tier].bg} ${TIER_META[tier].tone}`}>
                        {TIER_META[tier].label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollArea>
      </div>
    </div>
  );
}
