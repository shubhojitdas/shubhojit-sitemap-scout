import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import ForceGraph2D, { ForceGraphMethods } from "react-force-graph-2d";
import {
  buildGraphFromUrls,
  getGroupColor,
  getGroupLegend,
  GraphNode,
  GraphData,
} from "@/lib/graph-utils";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Maximize2, X, ExternalLink, Download, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/* ─── Slider + Number Input combo ───────────────────────────── */
function SliderWithInput({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] text-muted-foreground font-medium">{label}</label>
      <div className="flex items-center gap-2">
        <Slider
          value={[value]}
          onValueChange={(v) => onChange(v[0])}
          min={min}
          max={max}
          step={step}
          className="flex-1"
        />
        <Input
          type="number"
          value={value}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
          }}
          min={min}
          max={max}
          step={step}
          className="w-14 h-6 text-[10px] text-center px-1 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
      </div>
    </div>
  );
}

export default function LinkGraphView() {
  const fgRef = useRef<ForceGraphMethods | undefined>();
  const containerRef = useRef<HTMLDivElement>(null);
  const [maxDepth, setMaxDepth] = useState(3);
  const [maxNodes, setMaxNodes] = useState(500);
  const [nodeDistance, setNodeDistance] = useState(15);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const [isReady, setIsReady] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [controlsCollapsed, setControlsCollapsed] = useState(false);
  const [legendCollapsed, setLegendCollapsed] = useState(false);

  const urls: string[] = useMemo(() => {
    try {
      const stored = sessionStorage.getItem("linkGraphUrls");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }, []);

  const graphData: GraphData = useMemo(() => {
    const data = buildGraphFromUrls(urls, maxDepth, maxNodes);
    setIsReady(false);
    setTimeout(() => setIsReady(true), 300);
    return data;
  }, [urls, maxDepth, maxNodes]);

  const legend = useMemo(() => getGroupLegend(), [graphData]);

  useEffect(() => {
    if (fgRef.current) {
      (fgRef.current as any).d3Force?.("link")?.distance?.(nodeDistance);
      (fgRef.current as any).d3ReheatSimulation?.();
    }
  }, [nodeDistance]);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: Math.max(500, entry.contentRect.height),
        });
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const handleZoomToFit = useCallback(() => {
    fgRef.current?.zoomToFit(400, 40);
  }, []);

  useEffect(() => {
    if (isReady && graphData.nodes.length > 0) {
      setTimeout(() => fgRef.current?.zoomToFit(600, 40), 500);
    }
  }, [isReady, graphData]);

  const highlightNodes = useMemo(() => {
    if (!hoveredNode) return new Set<string>();
    const s = new Set<string>();
    s.add(hoveredNode.id);
    graphData.links.forEach((l) => {
      const src = typeof l.source === "object" ? (l.source as any).id : l.source;
      const tgt = typeof l.target === "object" ? (l.target as any).id : l.target;
      if (src === hoveredNode.id) s.add(tgt);
      if (tgt === hoveredNode.id) s.add(src);
    });
    return s;
  }, [hoveredNode, graphData.links]);

  const nodeCanvasObject = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const n = node as GraphNode & { x: number; y: number };
      const isRoot = n.depth === 0;
      const radius = isRoot ? 6 : Math.max(2, 4 - n.depth * 0.4);
      const isHighlighted = !hoveredNode || highlightNodes.has(n.id);
      const alpha = hoveredNode ? (isHighlighted ? 1 : 0.15) : 0.9;
      const color = getGroupColor(n.group);

      // Node circle
      ctx.beginPath();
      ctx.arc(n.x, n.y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      ctx.fill();

      // Subtle ring for root nodes
      if (isRoot) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2 / globalScale;
        ctx.globalAlpha = alpha * 0.5;
        ctx.stroke();
      }

      // Labels — clean, no shadows
      const shouldLabel = isRoot || (showLabels && isHighlighted && globalScale > 1.8);
      if (shouldLabel) {
        const fontSize = Math.max(isRoot ? 10 / globalScale : 8 / globalScale, 1.5);
        ctx.font = `${isRoot ? 600 : 400} ${fontSize}px Inter, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.globalAlpha = alpha * 0.85;
        const label = n.depth <= 1 ? n.label : "/" + n.label.split("/").pop();
        ctx.fillStyle = isRoot ? "#fff" : color;
        ctx.fillText(label, n.x, n.y + radius + 2);
      }

      ctx.globalAlpha = 1;
    },
    [hoveredNode, highlightNodes, showLabels]
  );

  const linkColor = useCallback(
    (link: any) => {
      if (!hoveredNode) return "hsla(220,12%,50%,0.15)";
      const src = typeof link.source === "object" ? link.source.id : link.source;
      const tgt = typeof link.target === "object" ? link.target.id : link.target;
      if (highlightNodes.has(src) && highlightNodes.has(tgt))
        return "hsla(45,100%,65%,0.8)";
      return "hsla(0,0%,50%,0.04)";
    },
    [hoveredNode, highlightNodes]
  );

  const getCanvasElement = (): HTMLCanvasElement | null => {
    return containerRef.current?.querySelector("canvas") || null;
  };

  const exportAsImage = (format: "png" | "jpeg") => {
    const canvas = getCanvasElement();
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `link-graph.${format}`;
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
    link.download = "link-graph.svg";
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const exportAsHtml = () => {
    const serializableNodes = graphData.nodes.map((n) => ({
      id: n.id, label: n.label, group: n.group, depth: n.depth,
      fullUrl: n.fullUrl, parentId: n.parentId, val: n.val,
    }));
    const serializableLinks = graphData.links.map((l: any) => ({
      source: typeof l.source === "object" ? l.source.id : l.source,
      target: typeof l.target === "object" ? l.target.id : l.target,
    }));
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Sitemap Link Graph</title>
<script src="https://unpkg.com/force-graph@1.47.3/dist/force-graph.min.js"><\/script>
<style>body{margin:0;background:#0a0a0a;color:#e5e5e5;font-family:Inter,system-ui,sans-serif}#g{width:100vw;height:100vh}</style>
</head><body><div id="g"></div><script>
const N=${JSON.stringify(serializableNodes)};const L=${JSON.stringify(serializableLinks)};
const C=${JSON.stringify(legend)};
ForceGraph()(document.getElementById('g')).graphData({nodes:N.map(n=>({...n})),links:L.map(l=>({...l}))})
.backgroundColor('#0a0a0a').nodeColor(n=>C[n.group]||'#64748b').nodeLabel(n=>n.fullUrl)
.linkColor(()=>'rgba(120,140,170,0.18)').onNodeClick(n=>n.fullUrl&&window.open(n.fullUrl,'_blank'));
<\/script></body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const link = document.createElement("a");
    link.download = "link-graph.html";
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  };

  if (urls.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-muted-foreground text-sm">No graph data found. Crawl a sitemap first.</p>
          <Button variant="outline" size="sm" onClick={() => window.close()}>
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative bg-background overflow-hidden" ref={containerRef} style={{ height: "calc(100vh - 3.5rem)" }}>
      {/* Loading */}
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-background z-20">
          <div className="flex flex-col items-center gap-2">
            <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-muted-foreground">Calculating layout…</span>
          </div>
        </div>
      )}

      {/* Controls Panel */}
      <div className="absolute top-3 left-3 z-10 bg-card/95 backdrop-blur-md border border-border rounded-xl p-3 max-w-[240px] shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-foreground">Controls</span>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleZoomToFit} title="Zoom to fit">
              <Maximize2 className="h-3 w-3" />
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
              <SliderWithInput label="Max Depth" value={maxDepth} onChange={setMaxDepth} min={1} max={10} step={1} />
              <SliderWithInput label="Max Nodes" value={maxNodes} onChange={setMaxNodes} min={50} max={5000} step={50} />
              <SliderWithInput label="Node Distance" value={nodeDistance} onChange={setNodeDistance} min={5} max={150} step={1} />

              <div className="flex items-center gap-2">
                <label className="text-[10px] text-muted-foreground cursor-pointer flex items-center gap-1.5">
                  <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} className="rounded border-border h-3 w-3 accent-primary" />
                  Show Labels
                </label>
              </div>

              <div className="text-[10px] text-muted-foreground pt-1 border-t border-border">
                {graphData.nodes.length} nodes · {graphData.links.length} links
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

      {/* Legend - positioned below selected node panel or at top-right */}
      <div className="fixed bottom-3 right-3 z-10 bg-card/95 backdrop-blur-md border border-border rounded-xl p-2.5 max-w-[160px] shadow-xl">
        <button
          onClick={() => setLegendCollapsed(!legendCollapsed)}
          className="flex items-center justify-between w-full text-[10px] font-semibold text-foreground mb-1"
        >
          Legend ({Object.keys(legend).length})
          {legendCollapsed ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        <AnimatePresence>
          {!legendCollapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden max-h-[200px] overflow-y-auto"
            >
              {Object.entries(legend).map(([group, color]) => (
                <div key={group} className="flex items-center gap-1.5 text-[10px] text-muted-foreground py-0.5">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0 shadow-sm" style={{ background: color }} />
                  <span className="truncate">{group === "root" ? "/" : group}</span>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Hover Tooltip */}
      <AnimatePresence>
        {hoveredNode && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-3 left-3 z-10 bg-popover border border-border rounded-xl p-2.5 max-w-xs shadow-xl"
          >
            <p className="text-[11px] font-medium text-foreground truncate">{hoveredNode.fullUrl}</p>
            <p className="text-[10px] text-muted-foreground">
              Depth: {hoveredNode.depth} · Group: {hoveredNode.group === "root" ? "/" : hoveredNode.group}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selected Node Panel */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute top-3 right-3 z-20 bg-popover border border-border rounded-xl p-3 w-72 shadow-xl"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-foreground">Node Details</span>
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setSelectedNode(null)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
            <div className="space-y-2 text-[11px]">
              <div>
                <span className="text-muted-foreground text-[10px]">Full URL</span>
                <a href={selectedNode.fullUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-foreground hover:underline break-all mt-0.5">
                  {selectedNode.fullUrl}
                  <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                </a>
              </div>
              <div>
                <span className="text-muted-foreground text-[10px]">Path</span>
                <p className="text-foreground mt-0.5">{selectedNode.label}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-[10px]">Parent</span>
                <p className="text-foreground mt-0.5 break-all">{selectedNode.parentId || "None (root)"}</p>
              </div>
              <div className="flex gap-4">
                <div>
                  <span className="text-muted-foreground text-[10px]">Depth</span>
                  <p className="text-foreground mt-0.5">{selectedNode.depth}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-[10px]">Group</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: getGroupColor(selectedNode.group) }} />
                    <span className="text-foreground">{selectedNode.group === "root" ? "/" : selectedNode.group}</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Graph */}
      <ForceGraph2D
        ref={fgRef as any}
        graphData={graphData}
        width={dimensions.width}
        height={dimensions.height}
        nodeCanvasObject={nodeCanvasObject}
        nodePointerAreaPaint={(node: any, color, ctx) => {
          const r = node.depth === 0 ? 8 : 5;
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
        }}
        linkColor={linkColor}
        linkWidth={(link: any) => {
          if (!hoveredNode) return 0.5;
          const src = typeof link.source === "object" ? link.source.id : link.source;
          const tgt = typeof link.target === "object" ? link.target.id : link.target;
          if (highlightNodes.has(src) && highlightNodes.has(tgt)) return 2;
          return 0.15;
        }}
        onNodeHover={(node: any) => setHoveredNode(node as GraphNode | null)}
        onNodeClick={(node: any) => setSelectedNode(node as GraphNode)}
        cooldownTicks={120}
        d3AlphaDecay={0.04}
        d3VelocityDecay={0.25}
        warmupTicks={30}
        enableZoomInteraction
        enablePanInteraction
      />
    </div>
  );
}
