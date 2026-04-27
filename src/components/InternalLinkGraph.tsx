import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import ForceGraph2D, { ForceGraphMethods } from "react-force-graph-2d";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Maximize2, X, ExternalLink, ChevronDown, ChevronUp, AlertTriangle, ArrowDown, ArrowUp, Link as LinkIcon, Download, ExternalLink as OpenIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CrawlResult, InternalLinkData } from "@/lib/crawl-api";

interface ILGNode {
  id: string;          // normalized URL
  label: string;       // /path
  fullUrl: string;     // original URL
  inDegree: number;
  outDegree: number;
  cluster: string;     // first path segment, used for color
  val: number;         // node size
  isOrphan: boolean;
}

interface ILGLink {
  source: string;
  target: string;
  anchors: string[];   // every anchor text used between this source/target pair
}

interface GraphData {
  nodes: ILGNode[];
  links: ILGLink[];
}

const PALETTE = [
  "#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899",
  "#06b6d4", "#f97316", "#14b8a6", "#a855f7", "#64748b", "#84cc16",
];

function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    u.hash = "";
    if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
      u.pathname = u.pathname.slice(0, -1);
    }
    u.hostname = u.hostname.replace(/^www\./i, "");
    return u.toString();
  } catch {
    return null;
  }
}

function clusterOf(url: string): string {
  try {
    const u = new URL(url);
    const seg = u.pathname.split("/").filter(Boolean)[0];
    return seg ? `/${seg}` : "/";
  } catch {
    return "/";
  }
}

function shortLabel(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname === "/" ? u.hostname : u.pathname;
  } catch {
    return url;
  }
}

interface SidecarBuilt {
  graph: GraphData;
  clusterColors: Record<string, string>;
  /** id → CrawlResult.url so links open the original (un-normalized) URL. */
  originalUrlById: Map<string, string>;
}

function buildInternalLinkGraph(results: CrawlResult[]): SidecarBuilt {
  const nodeMap = new Map<string, ILGNode>();
  const originalUrlById = new Map<string, string>();
  // Map `${source}=>${target}` → anchor list
  const linkMap = new Map<string, ILGLink>();
  const clusterColors: Record<string, string> = {};
  const ensureColor = (cluster: string) => {
    if (!clusterColors[cluster]) {
      const idx = Object.keys(clusterColors).length % PALETTE.length;
      clusterColors[cluster] = PALETTE[idx];
    }
  };

  // 1) Seed every crawled URL as a node so orphans are visible.
  for (const r of results) {
    const id = normalizeUrl(r.url);
    if (!id) continue;
    if (!nodeMap.has(id)) {
      const cluster = clusterOf(id);
      ensureColor(cluster);
      nodeMap.set(id, {
        id,
        label: shortLabel(id),
        fullUrl: r.url,
        inDegree: 0,
        outDegree: 0,
        cluster,
        val: 2,
        isOrphan: false,
      });
      originalUrlById.set(id, r.url);
    }
  }

  // 2) Walk every result's internal links and create edges.
  for (const r of results) {
    const sourceId = normalizeUrl(r.url);
    if (!sourceId) continue;
    const links = (r.internalLinks ?? []).filter((l: InternalLinkData) => l.isInternal);
    for (const link of links) {
      const targetId = normalizeUrl(link.href);
      if (!targetId || targetId === sourceId) continue;

      // Add destination node if it wasn't itself crawled (still useful to render).
      if (!nodeMap.has(targetId)) {
        const cluster = clusterOf(targetId);
        ensureColor(cluster);
        nodeMap.set(targetId, {
          id: targetId,
          label: shortLabel(targetId),
          fullUrl: link.href,
          inDegree: 0,
          outDegree: 0,
          cluster,
          val: 2,
          isOrphan: false,
        });
        originalUrlById.set(targetId, link.href);
      }

      const key = `${sourceId}=>${targetId}`;
      const anchor = (link.anchorText || "").trim();
      const existing = linkMap.get(key);
      if (existing) {
        if (anchor && !existing.anchors.includes(anchor)) existing.anchors.push(anchor);
      } else {
        linkMap.set(key, {
          source: sourceId,
          target: targetId,
          anchors: anchor ? [anchor] : [],
        });
      }
    }
  }

  // 3) Compute in/out degree + orphan flag + node size.
  for (const link of linkMap.values()) {
    const src = nodeMap.get(link.source);
    const tgt = nodeMap.get(link.target);
    if (src) src.outDegree += 1;
    if (tgt) tgt.inDegree += 1;
  }
  for (const node of nodeMap.values()) {
    node.isOrphan = node.inDegree === 0;
    // Size scales with inDegree (more links pointing in → bigger).
    node.val = Math.min(12, 2 + Math.log2(1 + node.inDegree) * 2);
  }

  return {
    graph: { nodes: Array.from(nodeMap.values()), links: Array.from(linkMap.values()) },
    clusterColors,
    originalUrlById,
  };
}

interface Props {
  results: CrawlResult[];
}

function SliderWithInput({
  label, value, onChange, min, max, step,
}: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number; }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] text-muted-foreground font-medium">{label}</label>
      <div className="flex items-center gap-2">
        <Slider value={[value]} onValueChange={(v) => onChange(v[0])} min={min} max={max} step={step} className="flex-1" />
        <Input
          type="number" value={value} min={min} max={max} step={step}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
          }}
          className="w-16 h-6 text-[10px] text-center px-1 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
      </div>
    </div>
  );
}

export function InternalLinkGraph({ results }: Props) {
  const fgRef = useRef<ForceGraphMethods | undefined>();
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 540 });
  const [maxNodes, setMaxNodes] = useState(500);
  const [linkDistance, setLinkDistance] = useState(28);
  const [showLabels, setShowLabels] = useState(true);
  const [hideOrphans, setHideOrphans] = useState(false);
  const [controlsCollapsed, setControlsCollapsed] = useState(false);
  const [legendCollapsed, setLegendCollapsed] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const built = useMemo(() => buildInternalLinkGraph(results), [results]);

  // Filtered graph (orphans + max nodes cap).
  const graphData = useMemo<GraphData>(() => {
    let nodes = built.graph.nodes;
    if (hideOrphans) nodes = nodes.filter((n) => !n.isOrphan);
    // Sort by inDegree desc so highest-value nodes survive the cap.
    nodes = [...nodes].sort((a, b) => b.inDegree - a.inDegree).slice(0, maxNodes);
    const ids = new Set(nodes.map((n) => n.id));
    const links = built.graph.links.filter((l) => ids.has(l.source) && ids.has(l.target));
    setIsReady(false);
    setTimeout(() => setIsReady(true), 200);
    return { nodes: nodes.map((n) => ({ ...n })), links: links.map((l) => ({ ...l })) };
  }, [built, hideOrphans, maxNodes]);

  useEffect(() => {
    if (fgRef.current) {
      (fgRef.current as any).d3Force?.("link")?.distance?.(linkDistance);
      (fgRef.current as any).d3ReheatSimulation?.();
    }
  }, [linkDistance]);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: Math.max(540, entry.contentRect.height),
        });
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (isReady && graphData.nodes.length > 0) {
      setTimeout(() => fgRef.current?.zoomToFit(600, 40), 500);
    }
  }, [isReady, graphData]);

  // Highlight: hovered node + immediate neighbors.
  const highlightNodes = useMemo(() => {
    const id = hoveredId ?? selectedId;
    if (!id) return new Set<string>();
    const s = new Set<string>([id]);
    graphData.links.forEach((l) => {
      const src = typeof l.source === "object" ? (l.source as any).id : l.source;
      const tgt = typeof l.target === "object" ? (l.target as any).id : l.target;
      if (src === id) s.add(tgt);
      if (tgt === id) s.add(src);
    });
    return s;
  }, [hoveredId, selectedId, graphData.links]);

  const nodeCanvasObject = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const n = node as ILGNode & { x: number; y: number };
      const focusedId = hoveredId ?? selectedId;
      const isHighlighted = !focusedId || highlightNodes.has(n.id);
      const alpha = focusedId ? (isHighlighted ? 1 : 0.12) : 0.92;
      const baseColor = built.clusterColors[n.cluster] ?? "#64748b";
      const color = n.isOrphan ? "#ef4444" : baseColor;
      const radius = Math.max(2, n.val);

      ctx.beginPath();
      ctx.arc(n.x, n.y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      ctx.fill();

      if (n.isOrphan) {
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 1 / globalScale;
        ctx.globalAlpha = alpha * 0.7;
        ctx.stroke();
      }

      const shouldLabel = showLabels && (isHighlighted && globalScale > 1.6);
      if (shouldLabel) {
        const fontSize = Math.max(8 / globalScale, 1.5);
        ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = color;
        ctx.globalAlpha = alpha * 0.9;
        const label = n.label.length > 28 ? n.label.slice(0, 27) + "…" : n.label;
        ctx.fillText(label, n.x, n.y + radius + 2);
      }

      ctx.globalAlpha = 1;
    },
    [hoveredId, selectedId, highlightNodes, showLabels, built.clusterColors]
  );

  const linkColor = useCallback(
    (link: any) => {
      const focusedId = hoveredId ?? selectedId;
      if (!focusedId) return "hsla(220,12%,50%,0.12)";
      const src = typeof link.source === "object" ? link.source.id : link.source;
      const tgt = typeof link.target === "object" ? link.target.id : link.target;
      if (highlightNodes.has(src) && highlightNodes.has(tgt)) {
        // Outgoing = blue-ish, incoming = green-ish.
        if (src === focusedId) return "hsla(210,90%,60%,0.85)";
        if (tgt === focusedId) return "hsla(140,70%,50%,0.85)";
        return "hsla(45,100%,65%,0.7)";
      }
      return "hsla(0,0%,50%,0.03)";
    },
    [hoveredId, selectedId, highlightNodes]
  );

  // Selected node detail computation.
  const selectedDetail = useMemo(() => {
    if (!selectedId) return null;
    const node = graphData.nodes.find((n) => n.id === selectedId) ?? built.graph.nodes.find((n) => n.id === selectedId);
    if (!node) return null;
    const incoming: { url: string; anchors: string[] }[] = [];
    const outgoing: { url: string; anchors: string[] }[] = [];
    for (const l of built.graph.links) {
      if (l.target === selectedId) incoming.push({ url: built.originalUrlById.get(l.source) ?? l.source, anchors: l.anchors });
      if (l.source === selectedId) outgoing.push({ url: built.originalUrlById.get(l.target) ?? l.target, anchors: l.anchors });
    }
    return { node, incoming, outgoing };
  }, [selectedId, graphData.nodes, built]);

  const orphanCount = useMemo(() => built.graph.nodes.filter((n) => n.isOrphan).length, [built]);
  const totalLinks = built.graph.links.length;

  // ── Export helpers ────────────────────────────────────────────
  const getCanvasElement = (): HTMLCanvasElement | null =>
    containerRef.current?.querySelector("canvas") || null;

  const exportAsImage = (format: "png" | "jpeg") => {
    const canvas = getCanvasElement();
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `internal-link-graph.${format}`;
    link.href = canvas.toDataURL(`image/${format}`, 0.95);
    link.click();
  };

  const exportAsSvg = () => {
    const canvas = getCanvasElement();
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}">
      <image href="${dataUrl}" width="${canvas.width}" height="${canvas.height}"/>
    </svg>`;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const link = document.createElement("a");
    link.download = "internal-link-graph.svg";
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const buildPayload = () => ({
    nodes: built.graph.nodes,
    links: built.graph.links,
    clusterColors: built.clusterColors,
    originalUrlById: Array.from(built.originalUrlById.entries()),
  });

  const exportAsHtml = () => {
    const payload = buildPayload();
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Internal Link Graph</title>
<script src="https://unpkg.com/force-graph@1.47.3/dist/force-graph.min.js"><\/script>
<style>body{margin:0;background:#0a0a0a;color:#e5e5e5;font-family:Inter,system-ui,sans-serif}#g{width:100vw;height:100vh}
.legend{position:fixed;top:10px;right:10px;background:rgba(20,20,20,0.95);border:1px solid #333;border-radius:10px;padding:10px;font-size:11px;max-height:80vh;overflow:auto}
.legend .row{display:flex;align-items:center;gap:6px;margin:2px 0}.legend .dot{width:10px;height:10px;border-radius:50%}
</style></head><body><div id="g"></div><div class="legend" id="lg"></div><script>
const D=${JSON.stringify(payload)};
const L=document.getElementById('lg');L.innerHTML='<b>Clusters</b>';
Object.entries(D.clusterColors).forEach(([c,col])=>{L.innerHTML+='<div class="row"><span class="dot" style="background:'+col+'"></span>'+c+'</div>';});
L.innerHTML+='<div class="row" style="color:#ef4444"><span class="dot" style="background:#ef4444"></span>Orphan</div>';
const G=ForceGraph()(document.getElementById('g'))
.graphData({nodes:D.nodes.map(n=>({...n})),links:D.links.map(l=>({...l}))})
.backgroundColor('#0a0a0a')
.nodeColor(n=>n.isOrphan?'#ef4444':(D.clusterColors[n.cluster]||'#64748b'))
.nodeVal(n=>n.val)
.nodeLabel(n=>n.fullUrl+' (in:'+n.inDegree+' out:'+n.outDegree+')')
.linkColor(()=>'rgba(120,140,170,0.18)')
.linkDirectionalArrowLength(3).linkDirectionalArrowRelPos(1)
.onNodeClick(n=>n.fullUrl&&window.open(n.fullUrl,'_blank'));
G.d3Force('link').distance(${linkDistance});
setTimeout(()=>G.zoomToFit(600,40),800);
<\/script></body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const link = document.createElement("a");
    link.download = "internal-link-graph.html";
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const openInNewTab = () => {
    try {
      sessionStorage.setItem("internalLinkGraphData", JSON.stringify(buildPayload()));
      window.open("/internal-link-graph-view", "_blank");
    } catch {
      const blob = new Blob([/* fallback */], { type: "text/html" });
      window.open(URL.createObjectURL(blob), "_blank");
    }
  };

  if (built.graph.links.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <LinkIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm font-medium">No internal link data found</p>
        <p className="text-xs text-muted-foreground mt-1">
          Re-crawl with <span className="font-mono">Internal Links</span> enabled to build the graph.
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full rounded-xl border border-border bg-card overflow-hidden" ref={containerRef} style={{ minHeight: 600 }}>
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-card z-20">
          <div className="flex flex-col items-center gap-2">
            <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-muted-foreground">Building link graph…</span>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="absolute top-3 left-3 z-10 bg-card/95 backdrop-blur-md border border-border rounded-xl p-3 max-w-[240px] shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-foreground">Internal Link Graph</span>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => fgRef.current?.zoomToFit(400, 40)} title="Zoom to fit">
              <Maximize2 className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={openInNewTab} title="Open in new tab">
              <OpenIcon className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setControlsCollapsed(!controlsCollapsed)}>
              {controlsCollapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
            </Button>
          </div>
        </div>

        <AnimatePresence>
          {!controlsCollapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden space-y-3"
            >
              <SliderWithInput label="Max Nodes" value={maxNodes} onChange={setMaxNodes} min={50} max={3000} step={50} />
              <SliderWithInput label="Link Distance" value={linkDistance} onChange={setLinkDistance} min={5} max={120} step={1} />

              <div className="space-y-1.5">
                <label className="text-[10px] text-muted-foreground cursor-pointer flex items-center gap-1.5">
                  <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} className="rounded border-border h-3 w-3 accent-primary" />
                  Show labels
                </label>
                <label className="text-[10px] text-muted-foreground cursor-pointer flex items-center gap-1.5">
                  <input type="checkbox" checked={hideOrphans} onChange={(e) => setHideOrphans(e.target.checked)} className="rounded border-border h-3 w-3 accent-primary" />
                  Hide orphans
                </label>
              </div>

              <div className="text-[10px] text-muted-foreground pt-1 border-t border-border space-y-0.5">
                <div>{graphData.nodes.length.toLocaleString()} nodes · {graphData.links.length.toLocaleString()} links</div>
                <div className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-destructive" />
                  <span>{orphanCount} orphan{orphanCount === 1 ? "" : "s"}</span>
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-[10px] w-full">
                    <Download className="h-3 w-3 mr-1" /> Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[140px]">
                  <DropdownMenuItem onClick={() => exportAsImage("png")} className="text-xs">PNG</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportAsImage("jpeg")} className="text-xs">JPEG</DropdownMenuItem>
                  <DropdownMenuItem onClick={exportAsSvg} className="text-xs">SVG</DropdownMenuItem>
                  <DropdownMenuItem onClick={exportAsHtml} className="text-xs">Interactive HTML</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 right-3 z-10 bg-card/95 backdrop-blur-md border border-border rounded-xl p-2.5 max-w-[180px] shadow-xl">
        <button
          onClick={() => setLegendCollapsed(!legendCollapsed)}
          className="flex items-center justify-between w-full text-[10px] font-semibold text-foreground mb-1"
        >
          Clusters ({Object.keys(built.clusterColors).length})
          {legendCollapsed ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        <AnimatePresence>
          {!legendCollapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden max-h-[180px] overflow-y-auto"
            >
              {Object.entries(built.clusterColors).map(([cluster, color]) => (
                <div key={cluster} className="flex items-center gap-1.5 text-[10px] text-muted-foreground py-0.5">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: color }} />
                  <span className="truncate font-mono">{cluster}</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5 text-[10px] text-destructive py-0.5 mt-1 pt-1 border-t border-border">
                <span className="h-2.5 w-2.5 rounded-full shrink-0 border border-destructive" style={{ background: "#ef4444" }} />
                <span>Orphan (no inbound)</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Selected node panel */}
      <AnimatePresence>
        {selectedDetail && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute top-3 right-3 z-20 bg-popover border border-border rounded-xl p-3 w-80 max-h-[80%] overflow-y-auto shadow-xl"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-foreground">Node Details</span>
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setSelectedId(null)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
            <div className="space-y-2">
              <a
                href={selectedDetail.node.fullUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-foreground hover:underline break-all flex items-start gap-1"
              >
                {selectedDetail.node.fullUrl}
                <ExternalLink className="h-2.5 w-2.5 shrink-0 mt-0.5" />
              </a>
              <div className="flex flex-wrap gap-1.5 text-[10px]">
                <Badge variant="secondary" className="font-mono">
                  <ArrowDown className="h-3 w-3 mr-1" />in: {selectedDetail.incoming.length}
                </Badge>
                <Badge variant="secondary" className="font-mono">
                  <ArrowUp className="h-3 w-3 mr-1" />out: {selectedDetail.outgoing.length}
                </Badge>
                <Badge variant="secondary" className="font-mono">cluster: {selectedDetail.node.cluster}</Badge>
                {selectedDetail.node.isOrphan && (
                  <Badge variant="destructive" className="font-mono"><AlertTriangle className="h-3 w-3 mr-1" />Orphan</Badge>
                )}
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-2 mb-1">
                  Incoming ({selectedDetail.incoming.length})
                </div>
                {selectedDetail.incoming.length === 0 ? (
                  <div className="text-[10px] text-destructive italic">No internal pages link here.</div>
                ) : (
                  <ul className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {selectedDetail.incoming.slice(0, 50).map((it, i) => (
                      <li key={i} className="text-[10px] border-l-2 border-border pl-2">
                        <a href={it.url} target="_blank" rel="noopener noreferrer" className="text-foreground hover:underline break-all">{it.url}</a>
                        {it.anchors.length > 0 && (
                          <div className="text-muted-foreground mt-0.5 italic">"{it.anchors.slice(0, 3).join("\", \"")}"{it.anchors.length > 3 ? ` +${it.anchors.length - 3}` : ""}</div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-2 mb-1">
                  Outgoing ({selectedDetail.outgoing.length})
                </div>
                {selectedDetail.outgoing.length === 0 ? (
                  <div className="text-[10px] text-muted-foreground italic">This page links to no internal pages.</div>
                ) : (
                  <ul className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {selectedDetail.outgoing.slice(0, 50).map((it, i) => (
                      <li key={i} className="text-[10px] border-l-2 border-border pl-2">
                        <a href={it.url} target="_blank" rel="noopener noreferrer" className="text-foreground hover:underline break-all">{it.url}</a>
                        {it.anchors.length > 0 && (
                          <div className="text-muted-foreground mt-0.5 italic">"{it.anchors.slice(0, 3).join("\", \"")}"{it.anchors.length > 3 ? ` +${it.anchors.length - 3}` : ""}</div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hover tooltip */}
      <AnimatePresence>
        {hoveredId && !selectedId && (() => {
          const n = graphData.nodes.find((x) => x.id === hoveredId);
          if (!n) return null;
          return (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute bottom-3 left-3 z-10 bg-popover border border-border rounded-xl p-2.5 max-w-sm shadow-xl"
            >
              <p className="text-[11px] font-medium text-foreground truncate">{n.fullUrl}</p>
              <p className="text-[10px] text-muted-foreground">
                in: {n.inDegree} · out: {n.outDegree} · cluster: {n.cluster}
                {n.isOrphan && <span className="text-destructive"> · orphan</span>}
              </p>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      <ForceGraph2D
        ref={fgRef as any}
        graphData={graphData}
        width={dimensions.width}
        height={dimensions.height}
        nodeCanvasObject={nodeCanvasObject}
        nodePointerAreaPaint={(node: any, color, ctx) => {
          const r = Math.max(4, (node as ILGNode).val + 2);
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
        }}
        linkColor={linkColor}
        linkWidth={(link: any) => {
          const focusedId = hoveredId ?? selectedId;
          if (!focusedId) return 0.4;
          const src = typeof link.source === "object" ? link.source.id : link.source;
          const tgt = typeof link.target === "object" ? link.target.id : link.target;
          if (highlightNodes.has(src) && highlightNodes.has(tgt)) return 1.6;
          return 0.15;
        }}
        linkDirectionalArrowLength={(link: any) => {
          const focusedId = hoveredId ?? selectedId;
          if (!focusedId) return 0;
          const src = typeof link.source === "object" ? link.source.id : link.source;
          const tgt = typeof link.target === "object" ? link.target.id : link.target;
          return highlightNodes.has(src) && highlightNodes.has(tgt) ? 4 : 0;
        }}
        linkDirectionalArrowRelPos={1}
        onNodeHover={(node: any) => setHoveredId((node as ILGNode | null)?.id ?? null)}
        onNodeClick={(node: any) => setSelectedId((node as ILGNode).id)}
        onBackgroundClick={() => setSelectedId(null)}
        cooldownTicks={120}
        d3AlphaDecay={0.05}
        d3VelocityDecay={0.35}
      />
    </div>
  );
}
