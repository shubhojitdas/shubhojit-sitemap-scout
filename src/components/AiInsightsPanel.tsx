import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AI_PROVIDERS, getProvider } from "@/lib/ai-providers";
import { chat, type ChatMessage } from "@/lib/ai-client";
import { useAiSettings } from "@/hooks/use-ai-keys";
import { toast } from "sonner";
import { ExternalLink, Sparkles, Loader2, Eye, EyeOff, Copy, Trash2 } from "lucide-react";
import type { CrawlResult } from "@/lib/crawl-api";

interface Props { results: CrawlResult[]; }

/**
 * BYOK AI Insights panel. Users add API keys for their chosen provider
 * (Google AI Studio, Anthropic, OpenAI, Groq, OpenRouter, Mistral, …).
 * All keys are stored only in localStorage.
 */
export function AiInsightsPanel({ results }: Props) {
  const { keys, settings, setKey, clearKey, setProvider, setModel } = useAiSettings();
  const provider = getProvider(settings.providerId) ?? AI_PROVIDERS[0];
  const model = settings.modelByProvider[provider.id] ?? provider.defaultModel;
  const apiKey = keys[provider.id] ?? "";

  const [showKey, setShowKey] = useState(false);
  const [prompt, setPrompt] = useState(
    "Analyse this SEO crawl. Highlight the top 5 issues with the biggest potential impact and provide concrete, prioritised recommendations.",
  );
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  const summary = useMemo(() => buildCrawlSummary(results), [results]);

  const run = async () => {
    if (provider.requiresKey && !apiKey) {
      toast.error(`Add your ${provider.label} API key first.`);
      return;
    }
    setLoading(true);
    setAnswer("");
    try {
      const messages: ChatMessage[] = [
        {
          role: "system",
          content:
            "You are a senior technical SEO consultant. Be concise, prioritise by impact, and give action-ready recommendations. Use short markdown when helpful.",
        },
        {
          role: "user",
          content: `Crawl summary (JSON):\n\n${summary}\n\nUser question:\n${prompt}`,
        },
      ];
      const out = await chat({ providerId: provider.id, apiKey, model, messages, temperature: 0.4 });
      setAnswer(out || "(no response)");
    } catch (e: any) {
      toast.error(e?.message || "AI request failed");
      setAnswer("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> AI Insights (Bring Your Own Key)
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Choose any supported provider, paste your API key, and ask questions about this crawl.
              Keys are stored only in your browser — nothing is sent to our servers.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Provider</Label>
            <Select value={provider.id} onValueChange={setProvider}>
              <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {AI_PROVIDERS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}{p.freeTier ? "  ·  free tier" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Model</Label>
            <Select value={model} onValueChange={(m) => setModel(provider.id, m)}>
              <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {provider.models.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {provider.requiresKey && (
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">{provider.keyLabel}</Label>
              <a
                href={provider.docsUrl} target="_blank" rel="noreferrer"
                className="text-[11px] text-primary inline-flex items-center gap-1 hover:underline"
              >
                Get a key <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className="relative flex-1">
                <Input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setKey(provider.id, e.target.value)}
                  placeholder={provider.keyPlaceholder}
                  className="h-9 pr-9 font-mono text-xs"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showKey ? "Hide key" : "Show key"}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {apiKey && (
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => clearKey(provider.id)} title="Remove key">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            {provider.note && (
              <p className="text-[11px] text-muted-foreground mt-1">{provider.note}</p>
            )}
          </div>
        )}

        <div>
          <Label className="text-xs">Ask about this crawl</Label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            className="mt-1 text-sm"
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            {results.length.toLocaleString()} URLs will be summarised as context.
          </span>
          <Button onClick={run} disabled={loading} size="sm">
            {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
            {loading ? "Analysing…" : "Run analysis"}
          </Button>
        </div>
      </div>

      {answer && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Response</h4>
            <Button
              variant="ghost" size="sm"
              onClick={() => { navigator.clipboard.writeText(answer); toast.success("Copied"); }}
            >
              <Copy className="h-3.5 w-3.5 mr-1" /> Copy
            </Button>
          </div>
          <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:mt-4 prose-headings:mb-2 prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:bg-muted prose-code:before:content-none prose-code:after:content-none prose-pre:bg-muted prose-pre:text-foreground prose-a:text-primary prose-table:text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}

// Build a compact JSON summary of the crawl so we don't blow past token limits.
function buildCrawlSummary(results: CrawlResult[]): string {
  const total = results.length;
  const status: Record<string, number> = {};
  let missingTitle = 0, missingDesc = 0, missingH1 = 0, multipleH1 = 0;
  let longTitles = 0, shortTitles = 0, longDesc = 0, shortDesc = 0;
  let noindex = 0, redirects = 0, errors = 0;

  for (const r of results) {
    const bucket = `${Math.floor(r.statusCode / 100)}xx`;
    status[bucket] = (status[bucket] || 0) + 1;
    if (r.statusCode >= 400) errors++;
    if ((r.redirectChain?.length ?? 0) > 0) redirects++;
    if (!r.title) missingTitle++;
    else {
      if (r.title.length > 60) longTitles++;
      if (r.title.length < 30) shortTitles++;
    }
    if (!r.description) missingDesc++;
    else {
      if (r.description.length > 160) longDesc++;
      if (r.description.length < 70) shortDesc++;
    }
    const h1s = r.h1s ?? [];
    if (h1s.length === 0) missingH1++;
    if (h1s.length > 1) multipleH1++;
    if ((r.robots || "").toLowerCase().includes("noindex")) noindex++;
  }

  const sample = results.slice(0, 25).map((r) => ({
    url: r.url,
    status: r.statusCode,
    title: r.title?.slice(0, 120),
    description: r.description?.slice(0, 200),
    h1: (r.h1s ?? [])[0]?.slice(0, 120),
  }));

  return JSON.stringify(
    {
      totals: { urls: total, errors, redirects, noindex },
      statusBuckets: status,
      titles: { missing: missingTitle, tooLong: longTitles, tooShort: shortTitles },
      descriptions: { missing: missingDesc, tooLong: longDesc, tooShort: shortDesc },
      h1: { missing: missingH1, multiple: multipleH1 },
      sample,
    },
    null,
    2,
  );
}
