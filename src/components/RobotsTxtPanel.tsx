import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Bot, Copy, Download, Pencil, Play, RefreshCw, Globe, ChevronDown,
  CheckCircle2, XCircle, AlertTriangle, Loader2, FileX,
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

type LiveState = "idle" | "loading" | "found" | "missing" | "error";

/**
 * Robots.txt panel — live-first workflow:
 *  1) Auto-fetch the site's live robots.txt on mount.
 *  2) If 200 → show it in the editor; if 404 → notify user, offer blank editor + generator.
 *  3) Tester accepts a URL to test against either the editor's current content
 *     OR a separately-pasted robots.txt block (technicalseo.com style).
 */
export function RobotsTxtPanel({ results, domain }: Props) {
  const { toast } = useToast();

  // ── Live fetch state ──────────────────────────────────────────────────────
  const [liveState, setLiveState] = useState<LiveState>("idle");
  const [liveContent, setLiveContent] = useState<string>("");
  const [liveStatus, setLiveStatus] = useState<number | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);

  const fetchLive = async () => {
    if (!domain) {
      setLiveState("error");
      setLiveError("No domain available — crawl a site first.");
      return;
    }
    setLiveState("loading");
    setLiveError(null);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-robots", {
        body: { domain },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const status = data.status as number | null;
      const content = (data.content as string) ?? "";
      setLiveStatus(status);
      setLiveContent(content);

      if (status === 200 && content.trim()) {
        setLiveState("found");
        setEditorText(content);
      } else if (status === 404 || !content.trim()) {
        setLiveState("missing");
      } else {
        setLiveState("found");
        setEditorText(content);
      }
    } catch (err) {
      setLiveState("error");
      setLiveError(err instanceof Error ? err.message : "Fetch failed");
    }
  };

  useEffect(() => {
    if (domain && liveState === "idle") fetchLive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain]);

  // ── Editor state ──────────────────────────────────────────────────────────
  const [editorText, setEditorText] = useState<string>("");
  const generated = useMemo(
    () => generateRobotsTxt(results, domain || "yourdomain.com"),
    [results, domain],
  );
  const editorParsed = useMemo(() => parseRobotsTxt(editorText), [editorText]);
  const lineCount = Math.max(1, editorText.split("\n").length);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  // ── Tester state ──────────────────────────────────────────────────────────
  const [tab, setTab] = useState<"editor" | "tester">("editor");
  const [testUrlInput, setTestUrlInput] = useState(
    domain ? `https://${domain}/` : "",
  );
  /** Source of robots rules used by the tester. */
  const [testSource, setTestSource] = useState<"editor" | "live" | "custom">("editor");
  const [customRobots, setCustomRobots] = useState<string>("");

  const [selectedBots, setSelectedBots] = useState<string[]>([
    "Googlebot", "Bingbot", "GPTBot", "ClaudeBot", "PerplexityBot",
  ]);
  const [customUa, setCustomUa] = useState("");

  const sourceText =
    testSource === "editor" ? editorText :
    testSource === "live" ? liveContent :
    customRobots;
  const testerParsed = useMemo(() => parseRobotsTxt(sourceText), [sourceText]);

  const allUas = [
    ...selectedBots,
    ...(customUa.trim() ? [customUa.trim()] : []),
  ];
  const testResults = useMemo(() => {
    if (!testUrlInput.trim() || allUas.length === 0) return [];
    return allUas.map((ua) => ({
      ua,
      result: testUrl(testerParsed, testUrlInput.trim(), ua),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testerParsed, testUrlInput, allUas.join("|")]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const copy = (text: string, label = "robots.txt") => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: `${label} copied to clipboard.` });
  };
  const download = (text: string) => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "robots.txt"; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Downloaded", description: "robots.txt saved." });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="flex items-center gap-2 flex-wrap">
        <Bot className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Robots.txt</h2>
        <span className="text-[11px] text-muted-foreground hidden sm:inline">
          Fetch live · edit · test
        </span>
      </div>

      {/* ── Live status banner ──────────────────────────────────────────── */}
      <LiveStatusBanner
        state={liveState}
        status={liveStatus}
        error={liveError}
        domain={domain}
        onRefetch={fetchLive}
        onUseGenerated={() => { setEditorText(generated); setTab("editor"); }}
        onStartBlank={() => { setEditorText(""); setTab("editor"); }}
      />

      {/* Single unified view: editor on top, tester directly below — no tabs.
          Mirrors technicalseo.com's UX so users don't have to switch tabs to test. */}
      <Tabs value="editor" onValueChange={() => {}}>
        <TabsList className="hidden">
          <TabsTrigger value="editor">e</TabsTrigger>
          <TabsTrigger value="tester">t</TabsTrigger>
        </TabsList>

        {/* ── Editor ── */}
        <TabsContent value="editor" className="mt-4 space-y-3">
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 justify-between px-3 py-2 border-b border-border bg-muted/30">
              <span className="text-[11px] text-muted-foreground font-medium">
                {lineCount} line{lineCount === 1 ? "" : "s"}
                {editorParsed.warnings.length > 0 && (
                  <span className="ml-2 text-warning">
                    · {editorParsed.warnings.length} warning{editorParsed.warnings.length === 1 ? "" : "s"}
                  </span>
                )}
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => copy(editorText)} disabled={!editorText}>
                  <Copy className="h-3 w-3 mr-1" /> Copy
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => download(editorText)} disabled={!editorText}>
                  <Download className="h-3 w-3 mr-1" /> Download
                </Button>
                {liveState === "found" && (
                  <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => setEditorText(liveContent)}>
                    <RefreshCw className="h-3 w-3 mr-1" /> Reset to live
                  </Button>
                )}
                {liveState === "missing" && (
                  <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => setEditorText(generated)}>
                    Insert generated
                  </Button>
                )}
              </div>
            </div>
            <div className="flex">
              <div
                ref={gutterRef}
                className="select-none px-2 py-3 text-right font-mono text-[11px] leading-relaxed text-muted-foreground/60 bg-muted/20 border-r border-border min-w-[2.5rem] max-h-[400px] overflow-hidden"
              >
                {Array.from({ length: lineCount }).map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
              <Textarea
                ref={textareaRef}
                value={editorText}
                onChange={(e) => setEditorText(e.target.value)}
                onScroll={(e) => {
                  // Keep the line-number gutter in sync with the textarea scroll
                  // so users always see the correct line numbers next to the
                  // visible rules.
                  if (gutterRef.current) {
                    gutterRef.current.scrollTop = (e.target as HTMLTextAreaElement).scrollTop;
                  }
                }}
                spellCheck={false}
                placeholder={liveState === "missing"
                  ? "# This site has no live robots.txt yet. Type your rules here, or click 'Insert generated' above to start from the auto-suggested draft."
                  : "User-agent: *\nDisallow:"}
                className="font-mono text-xs leading-relaxed resize-none border-0 rounded-none min-h-[400px] focus-visible:ring-0"
              />
            </div>
          </div>

          {editorParsed.warnings.length > 0 && (
            <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-warning">
                <AlertTriangle className="h-3.5 w-3.5" />
                Validation warnings
              </div>
              <ul className="text-[11px] space-y-0.5 text-muted-foreground">
                {editorParsed.warnings.map((w, i) => (
                  <li key={i}>
                    <span className="font-mono">L{w.line}</span> — {w.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="text-[11px] text-muted-foreground space-y-1">
            <div>
              Detected groups: <strong>{editorParsed.groups.length}</strong> ·{" "}
              Sitemaps: <strong>{editorParsed.sitemaps.length}</strong>
            </div>
            {editorParsed.sitemaps.map((s, i) => (
              <div key={i} className="font-mono text-muted-foreground/70 truncate">↳ {s}</div>
            ))}
          </div>
        </TabsContent>

        {/* ── Tester (rendered in same tab as Editor — single unified view) ── */}
        <TabsContent value="editor" className="mt-6 space-y-3 border-t border-border pt-6">
          <div className="flex items-center gap-2">
            <Play className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Test URLs against your rules</h3>
          </div>
          {/* Source picker */}
          <div className="rounded-lg border border-border bg-card p-3 space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Robots.txt source to test against
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button
                size="sm"
                variant={testSource === "editor" ? "default" : "outline"}
                onClick={() => setTestSource("editor")}
                className="h-8 text-[11px] gap-1.5"
              >
                <Pencil className="h-3 w-3" /> Editor
              </Button>
              <Button
                size="sm"
                variant={testSource === "live" ? "default" : "outline"}
                onClick={() => {
                  setTestSource("live");
                  if (liveState === "idle") fetchLive();
                }}
                disabled={!domain}
                className="h-8 text-[11px] gap-1.5"
              >
                <Globe className="h-3 w-3" /> Live
                {liveState === "loading" && <Loader2 className="h-3 w-3 animate-spin" />}
              </Button>
              <Button
                size="sm"
                variant={testSource === "custom" ? "default" : "outline"}
                onClick={() => setTestSource("custom")}
                className="h-8 text-[11px] gap-1.5"
              >
                <Pencil className="h-3 w-3" /> Custom
              </Button>
              <span className="text-[11px] text-muted-foreground self-center ml-2">
                {testSource === "editor" && `Using your editor draft (${editorText.split("\n").length} lines)`}
                {testSource === "live" && (liveContent ? `Live ${domain}/robots.txt · HTTP ${liveStatus ?? "?"}` : "No live content loaded")}
                {testSource === "custom" && `Custom paste (${customRobots.split("\n").length} lines)`}
              </span>
            </div>

            {testSource === "custom" && (
              <Textarea
                value={customRobots}
                onChange={(e) => setCustomRobots(e.target.value)}
                placeholder={"User-agent: *\nDisallow: /private/\nAllow: /\nSitemap: https://example.com/sitemap.xml"}
                spellCheck={false}
                className="font-mono text-xs min-h-[140px] resize-y mt-2"
              />
            )}
          </div>

          {/* URL input */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              URL to test
            </div>
            <Input
              value={testUrlInput}
              onChange={(e) => setTestUrlInput(e.target.value)}
              placeholder="https://example.com/some-page"
              className="font-mono text-xs h-9"
            />
          </div>

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
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[480px]">
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
                        <td className="px-3 py-2 text-[11px] text-muted-foreground font-mono break-all">
                          {r.result.matchedRule
                            ? `${r.result.matchedRule.type === "allow" ? "Allow" : "Disallow"}: ${r.result.matchedRule.path || "/"} (L${r.result.matchedRule.line})`
                            : r.result.reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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

// ─── Live status banner ─────────────────────────────────────────────────────

function LiveStatusBanner({
  state, status, error, domain, onRefetch, onUseGenerated, onStartBlank,
}: {
  state: LiveState;
  status: number | null;
  error: string | null;
  domain: string;
  onRefetch: () => void;
  onUseGenerated: () => void;
  onStartBlank: () => void;
}) {
  if (state === "loading") {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-center gap-2 text-xs">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Fetching <span className="font-mono">{domain}/robots.txt</span>…
      </div>
    );
  }

  if (state === "found") {
    return (
      <div className="rounded-lg border border-success/30 bg-success/10 p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-success" />
          <span>
            Live robots.txt loaded from{" "}
            <span className="font-mono">{domain}/robots.txt</span>
            {status !== null && ` · HTTP ${status}`}
          </span>
        </div>
        <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={onRefetch}>
          <RefreshCw className="h-3 w-3 mr-1" /> Refetch
        </Button>
      </div>
    );
  }

  if (state === "missing") {
    return (
      <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 space-y-2">
        <div className="flex items-start gap-2 text-xs">
          <FileX className="h-4 w-4 text-warning mt-0.5 shrink-0" />
          <div>
            <strong>No robots.txt found</strong> at{" "}
            <span className="font-mono">{domain}/robots.txt</span>
            {status !== null && ` (HTTP ${status})`}. You can write one manually
            below, or generate a starter draft from your crawl results.
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="default" className="h-7 text-[11px]" onClick={onUseGenerated}>
            Generate from crawl
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={onStartBlank}>
            Start blank
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={onRefetch}>
            <RefreshCw className="h-3 w-3 mr-1" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <XCircle className="h-4 w-4 text-destructive shrink-0" />
          <span className="truncate">Couldn't fetch live robots.txt: {error}</span>
        </div>
        <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={onRefetch}>
          <RefreshCw className="h-3 w-3 mr-1" /> Retry
        </Button>
      </div>
    );
  }

  return null;
}
