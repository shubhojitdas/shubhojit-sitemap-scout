import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AI_PROVIDERS, getProvider } from "@/lib/ai-providers";
import { chat, type ChatMessage } from "@/lib/ai-client";
import { useAiSettings } from "@/hooks/use-ai-keys";
import { toast } from "sonner";
import {
  ExternalLink, Sparkles, Loader2, Eye, EyeOff, Copy, Trash2,
  ChevronDown, ChevronRight, Link2, Link2Off,
} from "lucide-react";
import type { CrawlResult } from "@/lib/crawl-api";

interface Props { results: CrawlResult[]; }

interface Turn {
  id: string;
  prompt: string;
  answer: string;
  provider: string;
  model: string;
  createdAt: number;
  usedContext: boolean;
}

const LS_TURNS = "sitemap-scout-ai-turns-v1";

function loadTurns(): Turn[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_TURNS) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch { return []; }
}
function saveTurns(turns: Turn[]) {
  try { localStorage.setItem(LS_TURNS, JSON.stringify(turns.slice(-50))); } catch { /* ignore */ }
}

export function AiInsightsPanel({ results }: Props) {
  const { keys, settings, setKey, clearKey, setProvider, setModel } = useAiSettings();
  const provider = getProvider(settings.providerId) ?? AI_PROVIDERS[0];
  const model = settings.modelByProvider[provider.id] ?? provider.defaultModel;
  const apiKey = keys[provider.id] ?? "";

  const [showKey, setShowKey] = useState(false);
  const [prompt, setPrompt] = useState(
    "Analyse this SEO crawl. Highlight the top 5 issues with the biggest potential impact and provide concrete, prioritised recommendations.",
  );
  const [loading, setLoading] = useState(false);
  const [useContext, setUseContext] = useState(true);
  const [turns, setTurns] = useState<Turn[]>(() => loadTurns());
  const [openTurns, setOpenTurns] = useState<Record<string, boolean>>({});
  const answerEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { saveTurns(turns); }, [turns]);

  const summary = useMemo(() => buildCrawlSummary(results), [results]);

  const run = async () => {
    if (!prompt.trim()) { toast.error("Enter a prompt first."); return; }
    if (provider.requiresKey && !apiKey) {
      toast.error(`Add your ${provider.label} API key first.`);
      return;
    }
    setLoading(true);
    try {
      const messages: ChatMessage[] = [
        {
          role: "system",
          content:
            "You are a senior technical SEO consultant. Be concise, prioritise by impact, and give action-ready recommendations. Use rich markdown: headings, bullet lists, numbered steps, **bold** for key terms, `code` for URLs/tags, and tables when comparing items.",
        },
        {
          role: "user",
          content: `Crawl summary (JSON):\n\n${summary}`,
        },
      ];
      // Include prior turns as conversation memory when user opts in.
      if (useContext && turns.length > 0) {
        for (const t of turns) {
          messages.push({ role: "user", content: t.prompt });
          messages.push({ role: "assistant", content: t.answer });
        }
      }
      messages.push({ role: "user", content: prompt });

      const out = await chat({ providerId: provider.id, apiKey, model, messages, temperature: 0.4 });
      const turn: Turn = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        prompt,
        answer: out || "(no response)",
        provider: provider.label,
        model,
        createdAt: Date.now(),
        usedContext: useContext && turns.length > 0,
      };
      setTurns((prev) => [...prev, turn]);
      setOpenTurns((s) => ({ ...s, [turn.id]: true }));
      setPrompt(""); // ready for a follow-up
      // scroll to newest
      setTimeout(() => answerEndRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    } catch (e: any) {
      toast.error(e?.message || "AI request failed");
    } finally {
      setLoading(false);
    }
  };

  const clearAll = () => {
    setTurns([]);
    setOpenTurns({});
    toast.success("AI history cleared");
  };

  const toggleTurn = (id: string) =>
    setOpenTurns((s) => ({ ...s, [id]: !(s[id] ?? false) }));

  const expandAll = () => setOpenTurns(Object.fromEntries(turns.map((t) => [t.id, true])));
  const collapseAll = () => setOpenTurns({});

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
              Keys and answers stay in your browser — nothing is sent to our servers.
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
          <div className="flex items-center justify-between">
            <Label className="text-xs">
              {turns.length > 0 ? "Ask a follow-up about this crawl" : "Ask about this crawl"}
            </Label>
            {turns.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  {useContext ? <Link2 className="h-3 w-3" /> : <Link2Off className="h-3 w-3" />}
                  Use previous answers
                </span>
                <Switch checked={useContext} onCheckedChange={setUseContext} />
              </div>
            )}
          </div>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            placeholder={turns.length > 0 ? "e.g. Now dive deeper into the redirect issues and suggest a rewrite plan." : undefined}
            className="mt-1 text-sm"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); run(); }
            }}
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">
            {results.length.toLocaleString()} URLs summarised as context.
            {turns.length > 0 && useContext && ` · ${turns.length} prior answer${turns.length === 1 ? "" : "s"} attached.`}
          </span>
          <Button onClick={run} disabled={loading} size="sm">
            {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
            {loading ? "Analysing…" : turns.length > 0 ? "Ask follow-up" : "Run analysis"}
          </Button>
        </div>
      </div>

      {turns.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Conversation ({turns.length})
          </h4>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={expandAll} className="h-7 text-xs">Expand all</Button>
            <Button variant="ghost" size="sm" onClick={collapseAll} className="h-7 text-xs">Collapse all</Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear all
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear all AI results?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes every prompt and answer in this conversation.
                    Follow-up questions will no longer reference them, and you will need to spend
                    tokens again to regenerate anything you still need. This can't be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={clearAll}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Yes, clear everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}

      {turns.map((t, i) => {
        const open = openTurns[t.id] ?? false;
        return (
          <Collapsible
            key={t.id}
            open={open}
            onOpenChange={() => toggleTurn(t.id)}
            className="rounded-lg border border-border bg-card"
          >
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="w-full flex items-start gap-2 p-3 text-left hover:bg-accent/40 transition-colors rounded-lg"
              >
                {open ? <ChevronDown className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                      : <ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      #{i + 1}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {t.provider} · {t.model}
                    </span>
                    {t.usedContext && (
                      <span className="text-[10px] text-primary inline-flex items-center gap-1">
                        <Link2 className="h-3 w-3" /> linked
                      </span>
                    )}
                    <span className="text-[11px] text-muted-foreground ml-auto">
                      {new Date(t.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm font-medium mt-1 line-clamp-2">{t.prompt}</p>
                </div>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-4 border-t border-border">
                <div className="flex items-center justify-end pt-2">
                  <Button
                    variant="ghost" size="sm" className="h-7 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(t.answer);
                      toast.success("Copied");
                    }}
                  >
                    <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                  </Button>
                </div>
                <MarkdownAnswer content={t.answer} />
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
      <div ref={answerEndRef} />
    </div>
  );
}

function MarkdownAnswer({ content }: { content: string }) {
  return (
    <div
      className="
        text-sm leading-relaxed text-foreground
        [&>*:first-child]:mt-0
        [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-foreground
        [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-foreground
        [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:text-foreground
        [&_h4]:text-sm [&_h4]:font-semibold [&_h4]:mt-3 [&_h4]:mb-1
        [&_p]:my-2
        [&_ul]:my-2 [&_ul]:pl-5 [&_ul]:list-disc [&_ul_ul]:my-1
        [&_ol]:my-2 [&_ol]:pl-5 [&_ol]:list-decimal
        [&_li]:my-1
        [&_strong]:font-semibold [&_strong]:text-primary
        [&_em]:italic [&_em]:text-foreground
        [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-primary/40 hover:[&_a]:decoration-primary
        [&_code]:font-mono [&_code]:text-[0.85em] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded
        [&_code]:bg-primary/10 [&_code]:text-primary [&_code]:border [&_code]:border-primary/20
        [&_pre]:my-3 [&_pre]:p-3 [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:border [&_pre]:border-border [&_pre]:overflow-x-auto
        [&_pre_code]:bg-transparent [&_pre_code]:border-0 [&_pre_code]:p-0 [&_pre_code]:text-foreground
        [&_blockquote]:my-3 [&_blockquote]:pl-3 [&_blockquote]:border-l-2 [&_blockquote]:border-primary/50
        [&_blockquote]:text-muted-foreground [&_blockquote]:italic
        [&_hr]:my-4 [&_hr]:border-border
        [&_table]:my-3 [&_table]:w-full [&_table]:text-xs [&_table]:border [&_table]:border-border [&_table]:rounded-md [&_table]:overflow-hidden
        [&_thead]:bg-muted
        [&_th]:text-left [&_th]:font-semibold [&_th]:px-2 [&_th]:py-1.5 [&_th]:border-b [&_th]:border-border
        [&_td]:px-2 [&_td]:py-1.5 [&_td]:border-b [&_td]:border-border/50
        [&_tr:last-child_td]:border-b-0
        [&_mark]:bg-yellow-500/25 [&_mark]:text-foreground [&_mark]:px-1 [&_mark]:rounded
      "
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
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
