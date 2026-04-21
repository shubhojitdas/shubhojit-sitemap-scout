import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Bot, Copy, Download, FileText, Pencil, Play, RefreshCw, Search,
  CheckCircle2, XCircle, AlertTriangle, Globe, ChevronDown,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  COMMON_BOTS, generateRobotsTxt, parseRobotsTxt, testUrl,
} from "@/lib/robots-txt";
import type { CrawlResult } from "@/lib/crawl-api";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  results: CrawlResult[];
  domain: string;
}

/**
 * Robots.txt panel with three tabs:
 *   1. Generate — auto-suggest from crawl results
 *   2. Editor   — edit & validate
 *   3. Tester   — test URLs against draft or live robots.txt
 */
export function RobotsTxtPanel({ results, domain }: Props) {
  const { toast } = useToast();
  const generated = useMemo(
    () => generateRobotsTxt(results, domain || "yourdomain.com"),
    [results, domain],
  );

  const [tab, setTab] = useState<"generate" | "editor" | "tester">("generate");
  const [draft, setDraft] = useState(generated);

  // Re-seed draft when generated changes (e.g. new crawl) but only if user hasn't customised yet.
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!touched) setDraft(generated);
  }, [generated, touched]);

  // ── Tester state ──────────────────────────────────────────────────────────
  const [testUrlInput, setTestUrlInput] = useState(
    domain ? `https://${domain}/` : "",
  );
  const [selectedBots, setSelectedBots] = useState<string[]>([
    "Googlebot",
    "Bingbot",
    "GPTBot",
    "ClaudeBot",
    "PerplexityBot",
  ]);
  const [customUa, setCustomUa] = useState("");
  const [testSource, setTestSource] = useState<"draft" | "live">("draft");
  const [liveContent, setLiveContent] = useState<string | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveStatus, setLiveStatus] = useState<number | null>(null);

  const fetchLive = async () => {
    if (!domain) return;
    setLiveLoading(true);
    setLiveError(null);
    setLiveContent(null);
    setLiveStatus(null);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-robots", {
        body: { domain },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setLiveContent(data.content ?? "");
      setLiveStatus(data.status ?? null);
      if (data.status === 404) {
        setLiveError("No robots.txt found at this domain (404).");
      }
    } catch (err) {
      setLiveError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setLiveLoading(false);
    }
  };

  // Parse whichever source is selected for the tester.
  const sourceText = testSource === "draft"
    ? draft
    : (liveContent ?? "");
  const parsed = useMemo(() => parseRobotsTxt(sourceText), [sourceText]);
  const draftParsed = useMemo(() => parseRobotsTxt(draft), [draft]);

  const allUas = [
    ...selectedBots,
    ...(customUa.trim() ? [customUa.trim()] : []),
  ];
  const testResults = useMemo(() => {
    if (!testUrlInput.trim() || allUas.length === 0) return [];
    return allUas.map((ua) => ({
      ua,
      result: testUrl(parsed, testUrlInput.trim(), ua),
    }));
  }, [parsed, testUrlInput, allUas.join("|")]);

  const copy = (text: string, label = "robots.txt") => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: `${label} copied to clipboard.` });
  };

  const download = (text: string) => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "robots.txt";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Downloaded", description: "robots.txt saved." });
  };

  const lineCount = draft.split("\n").length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="flex items-center gap-2">
        <Bot className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Robots.txt</h2>
        <span className="text-[11px] text-muted-foreground">
          Generate, edit, and test crawl rules.
        </span>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="h-9 bg-muted p-1 rounded-lg">
          <TabsTrigger value="generate" className="text-xs gap-1.5 h-7 px-3">
            <FileText className="h-3 w-3" /> Generate
          </TabsTrigger>
          <TabsTrigger value="editor" className="text-xs gap-1.5 h-7 px-3">
            <Pencil className="h-3 w-3" /> Editor
          </TabsTrigger>
          <TabsTrigger value="tester" className="text-xs gap-1.5 h-7 px-3">
            <Play className="h-3 w-3" /> Tester
          </TabsTrigger>
        </TabsList>

        {/* ── Generate ── */}
        <TabsContent value="generate" className="mt-4 space-y-3">
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
              <span className="text-[11px] text-muted-foreground font-medium">
                Suggested robots.txt — derived from your crawl
              </span>
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => copy(generated)}>
                  <Copy className="h-3 w-3 mr-1" /> Copy
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => download(generated)}>
                  <Download className="h-3 w-3 mr-1" /> Download
                </Button>
                <Button
                  size="sm"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => {
                    setDraft(generated);
                    setTouched(false);
                    setTab("editor");
                  }}
                >
                  Send to Editor
                </Button>
              </div>
            </div>
            <pre className="p-3 text-xs font-mono leading-relaxed overflow-x-auto whitespace-pre max-h-[400px] overflow-y-auto">
              {generated}
            </pre>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Disallow rules are only added for path prefixes where ≥2 URLs returned 401/403/404/410 during the crawl. Review carefully before deploying.
          </p>
        </TabsContent>

        {/* ── Editor ── */}
        <TabsContent value="editor" className="mt-4 space-y-3">
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
              <span className="text-[11px] text-muted-foreground font-medium">
                {lineCount} line{lineCount === 1 ? "" : "s"}
                {draftParsed.warnings.length > 0 && (
                  <span className="ml-2 text-warning">
                    · {draftParsed.warnings.length} warning{draftParsed.warnings.length === 1 ? "" : "s"}
                  </span>
                )}
              </span>
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => copy(draft)}>
                  <Copy className="h-3 w-3 mr-1" /> Copy
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => download(draft)}>
                  <Download className="h-3 w-3 mr-1" /> Download
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => { setDraft(generated); setTouched(false); }}
                >
                  <RefreshCw className="h-3 w-3 mr-1" /> Reset
                </Button>
              </div>
            </div>
            <div className="flex">
              <div className="select-none px-2 py-3 text-right font-mono text-[11px] leading-relaxed text-muted-foreground/60 bg-muted/20 border-r border-border min-w-[2.5rem]">
                {Array.from({ length: lineCount }).map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
              <Textarea
                value={draft}
                onChange={(e) => { setDraft(e.target.value); setTouched(true); }}
                spellCheck={false}
                className="font-mono text-xs leading-relaxed resize-none border-0 rounded-none min-h-[400px] focus-visible:ring-0"
              />
            </div>
          </div>

          {draftParsed.warnings.length > 0 && (
            <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-warning">
                <AlertTriangle className="h-3.5 w-3.5" />
                Validation warnings
              </div>
              <ul className="text-[11px] space-y-0.5 text-muted-foreground">
                {draftParsed.warnings.map((w, i) => (
                  <li key={i}>
                    <span className="font-mono">L{w.line}</span> — {w.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="text-[11px] text-muted-foreground space-y-1">
            <div>Detected groups: <strong>{draftParsed.groups.length}</strong> · Sitemaps: <strong>{draftParsed.sitemaps.length}</strong></div>
            {draftParsed.sitemaps.map((s, i) => (
              <div key={i} className="font-mono text-muted-foreground/70 truncate">↳ {s}</div>
            ))}
          </div>
        </TabsContent>

        {/* ── Tester ── */}
        <TabsContent value="tester" className="mt-4 space-y-3">
          <div className="grid sm:grid-cols-[1fr_auto] gap-2 items-start">
            <Input
              value={testUrlInput}
              onChange={(e) => setTestUrlInput(e.target.value)}
              placeholder="https://example.com/some-page"
              className="font-mono text-xs h-9"
            />
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant={testSource === "draft" ? "default" : "outline"}
                onClick={() => setTestSource("draft")}
                className="h-9 text-[11px]"
              >
                Draft
              </Button>
              <Button
                size="sm"
                variant={testSource === "live" ? "default" : "outline"}
                onClick={() => {
                  setTestSource("live");
                  if (!liveContent && !liveLoading) fetchLive();
                }}
                disabled={!domain}
                className="h-9 text-[11px] gap-1.5"
              >
                <Globe className="h-3 w-3" /> Live
              </Button>
              {testSource === "live" && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={fetchLive}
                  disabled={liveLoading || !domain}
                  className="h-9 text-[11px]"
                >
                  <RefreshCw className={`h-3 w-3 ${liveLoading ? "animate-spin" : ""}`} />
                </Button>
              )}
            </div>
          </div>

          {testSource === "live" && (
            <div className="text-[11px] text-muted-foreground">
              {liveLoading && "Fetching live robots.txt…"}
              {liveError && <span className="text-destructive">{liveError}</span>}
              {!liveLoading && !liveError && liveContent !== null && (
                <span>
                  Loaded from <span className="font-mono">{domain}/robots.txt</span>
                  {liveStatus !== null && ` · HTTP ${liveStatus}`}
                </span>
              )}
            </div>
          )}

          {/* Bot selector */}
          <details open className="rounded-lg border border-border bg-card">
            <summary className="cursor-pointer px-3 py-2 text-xs font-medium flex items-center justify-between hover:bg-muted/30">
              <span>User-agents ({allUas.length} selected)</span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </summary>
            <div className="p-3 space-y-3 border-t border-border">
              {Array.from(new Set(COMMON_BOTS.map((b) => b.group))).map((group) => (
                <div key={group}>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    {group}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {COMMON_BOTS.filter((b) => b.group === group).map((b) => {
                      const active = selectedBots.includes(b.ua);
                      return (
                        <button
                          key={b.ua}
                          type="button"
                          onClick={() =>
                            setSelectedBots((prev) =>
                              active ? prev.filter((u) => u !== b.ua) : [...prev, b.ua],
                            )
                          }
                          className={`px-2 py-1 rounded-md text-[11px] border transition-colors ${
                            active
                              ? "border-foreground bg-foreground text-background"
                              : "border-border text-muted-foreground hover:border-foreground/50 hover:text-foreground"
                          }`}
                        >
                          {b.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div className="pt-2 border-t border-border">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Custom User-agent
                </label>
                <Input
                  value={customUa}
                  onChange={(e) => setCustomUa(e.target.value)}
                  placeholder="MyCustomBot"
                  className="mt-1 h-8 text-xs font-mono"
                />
              </div>
            </div>
          </details>

          {/* Results */}
          {testResults.length > 0 && testUrlInput.trim() && (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    <th className="text-left font-semibold px-3 py-2 w-[14rem]">User-agent</th>
                    <th className="text-left font-semibold px-3 py-2 w-[6rem]">Verdict</th>
                    <th className="text-left font-semibold px-3 py-2">Matched rule</th>
                  </tr>
                </thead>
                <tbody>
                  {testResults.map((r, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 font-mono text-[11px]">{r.ua}</td>
                      <td className="px-3 py-2">
                        {r.result.allowed ? (
                          <Badge variant="outline" className="gap-1 border-success/40 bg-success/10 text-success">
                            <CheckCircle2 className="h-3 w-3" /> Allowed
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 border-destructive/40 bg-destructive/10 text-destructive">
                            <XCircle className="h-3 w-3" /> Blocked
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-[11px] text-muted-foreground font-mono">
                        {r.result.matchedRule
                          ? `${r.result.matchedRule.type === "allow" ? "Allow" : "Disallow"}: ${r.result.matchedRule.path || "/"} (L${r.result.matchedRule.line})`
                          : r.result.reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {testResults.length === 0 && (
            <p className="text-[11px] text-muted-foreground">
              Enter a URL above and select at least one user-agent to see results.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
