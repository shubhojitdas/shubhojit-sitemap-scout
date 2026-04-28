import { useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import { motion } from "framer-motion";
import { Sparkles, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { CrawlResult } from "@/lib/crawl-api";

interface FieldFlags {
  includeTitle: boolean;
  includeDesc: boolean;
  includeH1: boolean;
  includeH2: boolean;
  includeH3: boolean;
  includeImages: boolean;
  includeSchemas: boolean;
  includeRobots: boolean;
  includeCanonical: boolean;
  includeHreflangs: boolean;
  includeInternalLinks: boolean;
  includeSocialTags: boolean;
}

interface Props {
  results: CrawlResult[];
  domain: string;
  flags?: FieldFlags;
}

// Chart palette: aesthetic monochrome + semantic accents that match the
// dark/light Next.js-inspired design system.
const COLORS = {
  ok: "hsl(var(--success))",
  redirect: "hsl(var(--warning))",
  client: "hsl(var(--destructive))",
  server: "hsl(var(--destructive) / 0.7)",
  blocked: "hsl(var(--muted-foreground))",
};

type Provider =
  | "openai"
  | "gemini"
  | "anthropic"
  | "openrouter"
  | "groq"
  | "deepseek"
  | "mistral"
  | "together"
  | "cohere";

const KEY_STORAGE = "sso-byo-llm-key";
const PROVIDER_STORAGE = "sso-byo-llm-provider";

function buildStaticSummary(results: CrawlResult[], domain: string): string {
  const total = results.length;
  if (total === 0) return "";
  const ok = results.filter((r) => r.statusCode >= 200 && r.statusCode < 300).length;
  const redirect = results.filter(
    (r) => (r.redirectChain?.length ?? 0) > 0 || (r.statusCode >= 300 && r.statusCode < 400),
  ).length;
  const c4xx = results.filter((r) => r.statusCode >= 400 && r.statusCode < 500).length;
  const c5xx = results.filter((r) => r.statusCode >= 500).length;
  const errors = results.filter((r) => r.status === "Error").length;

  const missingTitle = results.filter((r) => r.statusCode >= 200 && r.statusCode < 300 && !r.title).length;
  const missingDesc = results.filter((r) => r.statusCode >= 200 && r.statusCode < 300 && !r.description).length;
  const missingH1 = results.filter(
    (r) => (r.h1s ?? []).length === 0 && r.statusCode >= 200 && r.statusCode < 300,
  ).length;
  const multiH1 = results.filter((r) => (r.h1s ?? []).length > 1).length;
  const altMissing = results.reduce((s, r) => s + (r.images ?? []).filter((i) => !i.alt).length, 0);

  const avgTime = results.reduce((s, r) => s + parseFloat(r.fetchTime || "0"), 0) / total;

  const parts: string[] = [];
  parts.push(`Crawled ${total.toLocaleString()} URL${total === 1 ? "" : "s"}${domain ? ` on ${domain}` : ""}.`);
  parts.push(
    `${ok} returned 200 OK${redirect ? `, ${redirect} redirected` : ""}${c4xx ? `, ${c4xx} client error${c4xx === 1 ? "" : "s"}` : ""}${c5xx ? `, ${c5xx} server error${c5xx === 1 ? "" : "s"}` : ""}${errors ? `, ${errors} network failure${errors === 1 ? "" : "s"}` : ""}.`,
  );

  const issues: string[] = [];
  if (missingTitle) issues.push(`${missingTitle} page${missingTitle === 1 ? "" : "s"} missing a meta title`);
  if (missingDesc) issues.push(`${missingDesc} missing a meta description`);
  if (missingH1) issues.push(`${missingH1} without an H1`);
  if (multiH1) issues.push(`${multiH1} with multiple H1s`);
  if (altMissing) issues.push(`${altMissing} image${altMissing === 1 ? "" : "s"} missing alt text`);
  if (issues.length) parts.push(`Issues found: ${issues.join("; ")}.`);
  parts.push(`Average fetch time per URL: ${avgTime.toFixed(2)}s.`);
  return parts.join(" ");
}

function getStatusBucket(code: number): keyof typeof COLORS {
  if (code === 0) return "blocked";
  if (code >= 200 && code < 300) return "ok";
  if (code >= 300 && code < 400) return "redirect";
  if (code >= 400 && code < 500) return "client";
  if (code >= 500) return "server";
  return "blocked";
}

export function CrawlOverview({ results, domain, flags }: Props) {
  const { toast } = useToast();

  // ── Pie data: status code distribution ────────────────────────────────────
  const pieData = useMemo(() => {
    const counts: Record<string, number> = {
      "2xx Success": 0,
      "3xx Redirect": 0,
      "4xx Client": 0,
      "5xx Server": 0,
      "Network/Blocked": 0,
    };
    for (const r of results) {
      const bucket = getStatusBucket(r.statusCode);
      if (bucket === "ok") counts["2xx Success"]++;
      else if (bucket === "redirect") counts["3xx Redirect"]++;
      else if (bucket === "client") counts["4xx Client"]++;
      else if (bucket === "server") counts["5xx Server"]++;
      else counts["Network/Blocked"]++;
    }
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));
  }, [results]);

  const pieColors = [
    "hsl(var(--success))",
    "hsl(var(--warning))",
    "hsl(var(--destructive))",
    "hsl(var(--destructive) / 0.65)",
    "hsl(var(--muted-foreground))",
  ];

  // ── Line data: smoothed response times across URLs (windowed avg if many) ──
  const lineData = useMemo(() => {
    const times = results.map((r, i) => ({ i, t: parseFloat(r.fetchTime || "0") }));
    if (times.length <= 60) {
      return times.map((p, idx) => ({ idx: idx + 1, time: Number(p.t.toFixed(2)) }));
    }
    // Bucket into ~50 windows for readability on large crawls.
    const buckets = 50;
    const size = Math.ceil(times.length / buckets);
    const out: { idx: number; time: number }[] = [];
    for (let i = 0; i < times.length; i += size) {
      const slice = times.slice(i, i + size);
      const avg = slice.reduce((s, p) => s + p.t, 0) / slice.length;
      out.push({ idx: Math.floor(i / size) + 1, time: Number(avg.toFixed(2)) });
    }
    return out;
  }, [results]);

  const summary = useMemo(() => buildStaticSummary(results, domain), [results, domain]);

  // ── BYO LLM key panel ──────────────────────────────────────────────────────
  const [showKeyPanel, setShowKeyPanel] = useState(false);
  const [provider, setProvider] = useState<Provider>(
    () => (localStorage.getItem(PROVIDER_STORAGE) as Provider) || "openai",
  );
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem(KEY_STORAGE) || "");
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const generateAi = async () => {
    if (!apiKey.trim()) {
      toast({ title: "API key required", description: "Paste your personal LLM API key first." });
      return;
    }
    setAiLoading(true);
    setAiSummary(null);
    localStorage.setItem(KEY_STORAGE, apiKey.trim());
    localStorage.setItem(PROVIDER_STORAGE, provider);

    const compact = {
      domain,
      total: results.length,
      statusBuckets: pieData,
      avgFetchSec: results.reduce((s, r) => s + parseFloat(r.fetchTime || "0"), 0) / Math.max(1, results.length),
      sample: results.slice(0, 30).map((r) => ({
        url: r.url,
        status: r.statusCode,
        title: r.title?.slice(0, 90),
        descLen: r.description?.length ?? 0,
        h1Count: r.h1s?.length ?? 0,
      })),
    };

    const prompt = `You are an SEO analyst. Write a concise, actionable insights summary (4-6 sentences) of this site crawl. Highlight the most important problems and quick wins. Data:\n${JSON.stringify(compact)}`;

    // OpenAI-compatible endpoints (all use the same chat-completions schema):
    const OAI_COMPAT: Record<string, { url: string; model: string }> = {
      openai: { url: "https://api.openai.com/v1/chat/completions", model: "gpt-4o-mini" },
      openrouter: {
        url: "https://openrouter.ai/api/v1/chat/completions",
        model: "meta-llama/llama-3.1-8b-instruct:free",
      },
      groq: { url: "https://api.groq.com/openai/v1/chat/completions", model: "llama-3.1-8b-instant" },
      deepseek: { url: "https://api.deepseek.com/v1/chat/completions", model: "deepseek-chat" },
      mistral: { url: "https://api.mistral.ai/v1/chat/completions", model: "mistral-small-latest" },
      together: {
        url: "https://api.together.xyz/v1/chat/completions",
        model: "meta-llama/Llama-3.1-8B-Instruct-Turbo",
      },
    };

    try {
      let text = "";
      if (provider in OAI_COMPAT) {
        const cfg = OAI_COMPAT[provider];
        const res = await fetch(cfg.url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey.trim()}` },
          body: JSON.stringify({
            model: cfg.model,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.4,
          }),
        });
        if (!res.ok) throw new Error(`${provider} ${res.status}: ${(await res.text()).slice(0, 200)}`);
        const j = await res.json();
        text = j.choices?.[0]?.message?.content ?? "";
      } else if (provider === "gemini") {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${encodeURIComponent(apiKey.trim())}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
          },
        );
        if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
        const j = await res.json();
        text = j.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      } else if (provider === "anthropic") {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey.trim(),
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          },
          body: JSON.stringify({
            model: "claude-3-5-haiku-latest",
            max_tokens: 600,
            messages: [{ role: "user", content: prompt }],
          }),
        });
        if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
        const j = await res.json();
        text = j.content?.[0]?.text ?? "";
      } else if (provider === "cohere") {
        const res = await fetch("https://api.cohere.com/v1/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey.trim()}` },
          body: JSON.stringify({ model: "command-r", message: prompt }),
        });
        if (!res.ok) throw new Error(`Cohere ${res.status}: ${(await res.text()).slice(0, 200)}`);
        const j = await res.json();
        text = j.text ?? "";
      }
      setAiSummary(text.trim() || "(empty response)");
    } catch (err) {
      toast({
        title: "AI request failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {/* ── Charts row ───────────────────────────────────────────────────── */}
      <div className="grid gap-3 lg:grid-cols-2">
        {/* Pie */}
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold">Status code distribution</h3>
            <span className="text-[10px] text-muted-foreground">{results.length.toLocaleString()} URLs</span>
          </div>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                  stroke="hsl(var(--background))"
                  strokeWidth={2}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={pieColors[i % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "hsl(var(--popover-foreground))",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Line */}
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold">Response time</h3>
            <span className="text-[10px] text-muted-foreground">seconds per URL</span>
          </div>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.6)" />
                <XAxis dataKey="idx" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "hsl(var(--popover-foreground))",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="time"
                  stroke="hsl(var(--foreground))"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Per-field health donuts (one card per crawled flag) ─────────── */}
      {flags && <PerFieldDonuts results={results} flags={flags} />}

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
          <h3 className="text-xs font-semibold">Crawl summary</h3>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11px] gap-1.5"
            onClick={() => setShowKeyPanel((v) => !v)}
          >
            <Sparkles className="h-3 w-3" />
            {aiSummary ? "Regenerate AI insights" : "Generate AI insights (BYO key)"}
          </Button>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-line">{summary}</p>

        {showKeyPanel && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-4 pt-4 border-t border-border space-y-3"
          >
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <KeyRound className="h-3 w-3" />
              Your key never leaves your browser — it's sent directly to your chosen provider and stored only in
              localStorage.
            </div>
            <div className="grid sm:grid-cols-[160px_1fr_auto] gap-2 items-end">
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Provider</Label>
                <Select value={provider} onValueChange={(v) => setProvider(v as Provider)}>
                  <SelectTrigger className="h-9 text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI (gpt-4o-mini)</SelectItem>
                    <SelectItem value="gemini">Google Gemini 1.5 Flash (free tier)</SelectItem>
                    <SelectItem value="anthropic">Anthropic Claude 3.5 Haiku</SelectItem>
                    <SelectItem value="openrouter">OpenRouter (free models)</SelectItem>
                    <SelectItem value="groq">Groq Llama 3.1 (free tier)</SelectItem>
                    <SelectItem value="deepseek">DeepSeek Chat</SelectItem>
                    <SelectItem value="mistral">Mistral Small (free tier)</SelectItem>
                    <SelectItem value="together">Together AI</SelectItem>
                    <SelectItem value="cohere">Cohere Command-R (free tier)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">API key</Label>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-... / AI... / sk-ant-..."
                  className="h-9 text-xs font-mono mt-1"
                />
              </div>
              <Button onClick={generateAi} disabled={aiLoading} className="h-9 text-xs gap-1.5">
                {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                Generate
              </Button>
            </div>

            {aiSummary && (
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">AI insights</div>
                <p className="text-xs leading-relaxed whitespace-pre-line">{aiSummary}</p>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Per-field health donuts ──────────────────────────────────────────────
// One mini donut per crawled SEO field with a plain-English interpretation
// just below it. Helps users spot which fields have the most issues without
// opening filters.
interface FieldStat {
  key: string;
  label: string;
  segments: { name: string; value: number; tone: "ok" | "warn" | "bad" | "muted" }[];
  /** Total denominator (typically OK 2xx pages). */
  total: number;
  /** Plain-English interpretation rendered under the chart. */
  insight: string;
}

const TONE_COLOR: Record<"ok" | "warn" | "bad" | "muted", string> = {
  ok: "hsl(var(--success))",
  warn: "hsl(var(--warning))",
  bad: "hsl(var(--destructive))",
  muted: "hsl(var(--muted-foreground) / 0.45)",
};

function buildFieldStats(results: CrawlResult[], flags: FieldFlags): FieldStat[] {
  const ok = results.filter((r) => r.statusCode >= 200 && r.statusCode < 300);
  const total = ok.length;
  const out: FieldStat[] = [];
  if (total === 0) return out;

  const pct = (n: number) => Math.round((n / total) * 100);

  if (flags.includeTitle) {
    const present = ok.filter((r) => !!r.title);
    const missing = total - present.length;
    const tooLong = present.filter((r) => r.title.length > 60).length;
    const tooShort = present.filter((r) => r.title.length > 0 && r.title.length < 30).length;
    const optimal = present.length - tooLong - tooShort;
    out.push({
      key: "title",
      label: "Meta Titles",
      total,
      segments: [
        { name: "Optimal (30–60)", value: optimal, tone: "ok" },
        { name: "Too long (>60)", value: tooLong, tone: "warn" },
        { name: "Too short (<30)", value: tooShort, tone: "warn" },
        { name: "Missing", value: missing, tone: "bad" },
      ],
      insight: missing
        ? `${missing} page${missing === 1 ? "" : "s"} (${pct(missing)}%) have no meta title — fix these first.`
        : tooLong + tooShort
          ? `${tooLong + tooShort} title${tooLong + tooShort === 1 ? "" : "s"} fall outside the 30–60 char sweet spot.`
          : "All titles are present and within the optimal length.",
    });
  }

  if (flags.includeDesc) {
    const present = ok.filter((r) => !!r.description);
    const missing = total - present.length;
    const tooLong = present.filter((r) => r.description.length > 160).length;
    const tooShort = present.filter((r) => r.description.length > 0 && r.description.length < 70).length;
    const optimal = present.length - tooLong - tooShort;
    out.push({
      key: "desc",
      label: "Meta Descriptions",
      total,
      segments: [
        { name: "Optimal (70–160)", value: optimal, tone: "ok" },
        { name: "Too long (>160)", value: tooLong, tone: "warn" },
        { name: "Too short (<70)", value: tooShort, tone: "warn" },
        { name: "Missing", value: missing, tone: "bad" },
      ],
      insight: missing
        ? `${missing} (${pct(missing)}%) have no meta description — search snippets may be auto-generated.`
        : tooLong + tooShort
          ? `${tooLong + tooShort} description${tooLong + tooShort === 1 ? "" : "s"} are outside the 70–160 char range.`
          : "All descriptions present and well-sized.",
    });
  }

  if (flags.includeH1) {
    const none = ok.filter((r) => (r.h1s ?? []).length === 0).length;
    const multi = ok.filter((r) => (r.h1s ?? []).length > 1).length;
    const single = total - none - multi;
    out.push({
      key: "h1",
      label: "H1 Tags",
      total,
      segments: [
        { name: "Single H1", value: single, tone: "ok" },
        { name: "Multiple H1s", value: multi, tone: "warn" },
        { name: "Missing H1", value: none, tone: "bad" },
      ],
      insight: none
        ? `${none} page${none === 1 ? "" : "s"} (${pct(none)}%) have no H1.`
        : multi
          ? `${multi} page${multi === 1 ? "" : "s"} have multiple H1s — best practice is one per page.`
          : "Every page has exactly one H1.",
    });
  }

  if (flags.includeH2) {
    const none = ok.filter((r) => (r.h2s ?? []).length === 0).length;
    out.push({
      key: "h2",
      label: "H2 Tags",
      total,
      segments: [
        { name: "Has H2(s)", value: total - none, tone: "ok" },
        { name: "No H2", value: none, tone: "warn" },
      ],
      insight: none
        ? `${none} page${none === 1 ? "" : "s"} (${pct(none)}%) have no H2 — sub-headings help structure content.`
        : "All pages use H2 sub-headings.",
    });
  }

  if (flags.includeH3) {
    const none = ok.filter((r) => (r.h3s ?? []).length === 0).length;
    out.push({
      key: "h3",
      label: "H3 Tags",
      total,
      segments: [
        { name: "Has H3(s)", value: total - none, tone: "ok" },
        { name: "No H3", value: none, tone: "muted" },
      ],
      insight: none ? `${none} page${none === 1 ? "" : "s"} have no H3 sections.` : "All pages use H3 sub-headings.",
    });
  }

  if (flags.includeImages) {
    const totalImgs = ok.reduce((s, r) => s + (r.images ?? []).length, 0);
    const missingAlt = ok.reduce((s, r) => s + (r.images ?? []).filter((i) => !i.alt).length, 0);
    const withAlt = totalImgs - missingAlt;
    out.push({
      key: "img",
      label: "Image Alt Texts",
      total: totalImgs,
      segments: [
        { name: "With alt", value: withAlt, tone: "ok" },
        { name: "Missing alt", value: missingAlt, tone: "bad" },
      ],
      insight: !totalImgs
        ? "No images detected on these pages."
        : missingAlt
          ? `${missingAlt} of ${totalImgs} image${totalImgs === 1 ? "" : "s"} are missing alt text.`
          : "Every image has descriptive alt text.",
    });
  }

  if (flags.includeRobots) {
    const noindex = ok.filter((r) => /noindex/i.test(r.robots ?? "")).length;
    const nofollow = ok.filter((r) => /nofollow/i.test(r.robots ?? "")).length;
    const indexable = total - noindex;
    out.push({
      key: "robots",
      label: "Meta Robots",
      total,
      segments: [
        { name: "Indexable", value: indexable, tone: "ok" },
        { name: "Noindex", value: noindex, tone: "bad" },
        { name: "Nofollow (any)", value: nofollow, tone: "warn" },
      ],
      insight: noindex
        ? `${noindex} page${noindex === 1 ? "" : "s"} (${pct(noindex)}%) are blocked from indexing.`
        : "All crawled pages are indexable by search engines.",
    });
  }

  if (flags.includeCanonical) {
    const selfRef = ok.filter((r) => r.canonicalStatus === "Self Referencing").length;
    const canonicalised = ok.filter((r) => r.canonicalStatus === "Canonicalised").length;
    const missing = ok.filter((r) => r.canonicalStatus === "Missing").length;
    out.push({
      key: "canonical",
      label: "Canonicals",
      total,
      segments: [
        { name: "Self-referencing", value: selfRef, tone: "ok" },
        { name: "Canonicalised away", value: canonicalised, tone: "warn" },
        { name: "Missing", value: missing, tone: "bad" },
      ],
      insight: missing
        ? `${missing} page${missing === 1 ? "" : "s"} have no canonical tag — duplicate-content risk.`
        : canonicalised
          ? `${canonicalised} page${canonicalised === 1 ? "" : "s"} canonicalize away from themselves — verify intentional.`
          : "All pages self-canonicalize correctly.",
    });
  }

  if (flags.includeHreflangs) {
    const has = ok.filter((r) => (r.hreflangs ?? []).length > 0).length;
    const none = total - has;
    out.push({
      key: "hreflang",
      label: "Hreflang",
      total,
      segments: [
        { name: "Has hreflang", value: has, tone: "ok" },
        { name: "No hreflang", value: none, tone: "muted" },
      ],
      insight: has
        ? `${has} page${has === 1 ? "" : "s"} declare hreflang alternates.`
        : "No hreflang annotations detected (skip if your site is single-language).",
    });
  }

  if (flags.includeSchemas) {
    const has = ok.filter((r) => (r.schemas ?? []).length > 0).length;
    const none = total - has;
    out.push({
      key: "schema",
      label: "Schema Markup",
      total,
      segments: [
        { name: "Has schema", value: has, tone: "ok" },
        { name: "No schema", value: none, tone: "warn" },
      ],
      insight: has
        ? `${has} page${has === 1 ? "" : "s"} (${pct(has)}%) include structured data.`
        : "No structured data found — adding JSON-LD can unlock rich results.",
    });
  }

  if (flags.includeInternalLinks) {
    const orphan = ok.filter((r) => (r.internalLinks ?? []).length === 0).length;
    const linked = total - orphan;
    out.push({
      key: "links",
      label: "Internal Links",
      total,
      segments: [
        { name: "Has internal links", value: linked, tone: "ok" },
        { name: "No internal links", value: orphan, tone: "warn" },
      ],
      insight: orphan
        ? `${orphan} page${orphan === 1 ? "" : "s"} have zero internal outbound links — risk of poor crawlability.`
        : "All pages link to at least one internal URL.",
    });
  }

  if (flags.includeSocialTags) {
    const hasOg = ok.filter((r) => Array.isArray(r.socialTags) && r.socialTags.length > 0).length;
    const noOg = total - hasOg;
    out.push({
      key: "social",
      label: "Open Graph & Twitter",
      total,
      segments: [
        { name: "Has OG/Twitter tags", value: hasOg, tone: "ok" },
        { name: "Missing", value: noOg, tone: "warn" },
      ],
      insight: noOg
        ? `${noOg} page${noOg === 1 ? "" : "s"} (${pct(noOg)}%) lack OG/Twitter tags — link previews will fall back to defaults.`
        : "All pages share rich previews on social.",
    });
  }

  return out;
}

function PerFieldDonuts({ results, flags }: { results: CrawlResult[]; flags: FieldFlags }) {
  const stats = useMemo(() => buildFieldStats(results, flags), [results, flags]);
  if (stats.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-3 sm:p-4">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h3 className="text-xs font-semibold">Field-by-field health</h3>
        <span className="text-[10px] text-muted-foreground">
          {stats.length} extracted field{stats.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => {
          const data = s.segments.filter((seg) => seg.value > 0);
          return (
            <div key={s.key} className="rounded-md border border-border/60 bg-background/40 p-3">
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-[11px] font-semibold">{s.label}</h4>
                <span className="text-[10px] text-muted-foreground">{s.total.toLocaleString()}</span>
              </div>
              <div className="h-[120px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={28}
                      outerRadius={50}
                      paddingAngle={2}
                      stroke="hsl(var(--background))"
                      strokeWidth={2}
                    >
                      {data.map((seg, i) => (
                        <Cell key={i} fill={TONE_COLOR[seg.tone]} />
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
              <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5">
                {s.segments.map((seg) => (
                  <div key={seg.name} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: TONE_COLOR[seg.tone] }} />
                    <span className="truncate" title={seg.name}>
                      {seg.name}
                    </span>
                    <span className="ml-auto tabular-nums text-foreground/80">{seg.value}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] leading-snug text-muted-foreground">{s.insight}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
