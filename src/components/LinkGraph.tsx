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
import { Maximize2, X, ExternalLink, Download, ExternalLink as OpenIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface LinkGraphProps {
  urls: string[];
}

export function LinkGraph({ urls }: LinkGraphProps) {
  const fgRef = useRef<ForceGraphMethods | undefined>();
  const containerRef = useRef<HTMLDivElement>(null);
  const [maxDepth, setMaxDepth] = useState(3);
  const [maxNodes, setMaxNodes] = useState(500);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const [isReady, setIsReady] = useState(false);
  const [showLabels, setShowLabels] = useState(true);

  // Build graph data
  const graphData: GraphData = useMemo(() => {
    const data = buildGraphFromUrls(urls, maxDepth, maxNodes);
    setIsReady(false);
    setTimeout(() => setIsReady(true), 300);
    return data;
  }, [urls, maxDepth, maxNodes]);

  const legend = useMemo(() => getGroupLegend(), [graphData]);

  // Resize observer
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

  // Auto zoom to fit on first render
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
      const isRoot = n.group === "root";
      const radius = isRoot ? 7 : Math.max(1.5, 3.5 - n.depth * 0.4);
      const isHighlighted = !hoveredNode || highlightNodes.has(n.id);
      const alpha = hoveredNode ? (isHighlighted ? 1 : 0.08) : 0.9;
      const color = getGroupColor(n.group);

      // Glow for highlighted nodes
      if (isHighlighted && hoveredNode) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius + 3, 0, 2 * Math.PI);
        ctx.fillStyle = isRoot ? "rgba(245,158,11,0.15)" : color.replace(")", ",0.15)").replace("rgb", "rgba");
        ctx.globalAlpha = 1;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(n.x, n.y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = isRoot ? "#f59e0b" : color;
      ctx.globalAlpha = alpha;
      ctx.fill();

      // Labels: root always, others only when zoomed in enough and showLabels is on
      const shouldLabel = isRoot || (showLabels && isHighlighted && globalScale > 2.2);
      if (shouldLabel) {
        const fontSize = Math.max(9 / globalScale, 1.5);
        ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = isRoot ? "#fbbf24" : color;
        ctx.globalAlpha = alpha;
        const label = n.depth <= 1 ? n.label : "/" + n.label.split("/").pop();
        ctx.fillText(label, n.x, n.y + radius + 1.5);
      }

      ctx.globalAlpha = 1;
    },
    [hoveredNode, highlightNodes, showLabels]
  );

  const linkColor = useCallback(
    (link: any) => {
      if (!hoveredNode) return "hsla(0,0%,40%,0.08)";
      const src = typeof link.source === "object" ? link.source.id : link.source;
      const tgt = typeof link.target === "object" ? link.target.id : link.target;
      if (highlightNodes.has(src) && highlightNodes.has(tgt))
        return "hsla(0,0%,70%,0.5)";
      return "hsla(0,0%,50%,0.02)";
    },
    [hoveredNode, highlightNodes]
  );

  const maxPossibleDepth = useMemo(() => {
    let max = 1;
    urls.forEach((u) => {
      try {
        const parts = new URL(u).pathname.split("/").filter(Boolean);
        if (parts.length > max) max = parts.length;
      } catch {}
    });
    return Math.min(max, 7);
  }, [urls]);

  // --- Export functions ---
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
    // Convert canvas to SVG wrapper with embedded image
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
    const canvas = getCanvasElement();
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Link Graph - Sitemap Scout</title>
<style>body{margin:0;background:#0a0a0a;display:flex;align-items:center;justify-content:center;min-height:100vh}
img{max-width:100%;height:auto}</style></head>
<body><img src="${dataUrl}" alt="Link Graph Visualization"/></body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const link = document.createElement("a");
    link.download = "link-graph.html";
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const openInNewTab = () => {
    const canvas = getCanvasElement();
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const html = `<!DOCTYPE html><html><head><title>Link Graph</title>
<style>body{margin:0;background:#0a0a0a;display:flex;align-items:center;justify-content:center;min-height:100vh}
img{max-width:100%;height:auto}</style></head>
<body><img src="${dataUrl}" alt="Link Graph"/></body></html>`;
    const w = window.open();
    if (w) { w.document.write(html); w.document.close(); }
  };

  return (
    <div className="relative w-full rounded-xl border border-border bg-card overflow-hidden" ref={containerRef} style={{ minHeight: 540 }}>
      {/* Loading */}
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-card z-20">
          <div className="flex flex-col items-center gap-2">
            <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-muted-foreground">Calculating layout…</span>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-2.5 bg-card/95 backdrop-blur-md border border-border rounded-lg p-3 max-w-[210px] shadow-lg">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-foreground">Controls</span>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleZoomToFit} title="Zoom to fit">
              <Maximize2 className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={openInNewTab} title="Open in new tab">
              <OpenIcon className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <div>
          <label className="text-[10px] text-muted-foreground">Max Depth: {maxDepth}</label>
          <Slider value={[maxDepth]} onValueChange={(v) => setMaxDepth(v[0])} min={1} max={maxPossibleDepth} step={1} className="mt-1" />
        </div>

        <div>
          <label className="text-[10px] text-muted-foreground">Max Nodes: {maxNodes}</label>
          <Slider value={[maxNodes]} onValueChange={(v) => setMaxNodes(v[0])} min={50} max={Math.min(urls.length + 50, 5000)} step={50} className="mt-1" />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-[10px] text-muted-foreground cursor-pointer flex items-center gap-1">
            <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} className="rounded border-border h-3 w-3" />
            Labels
          </label>
        </div>

        <div className="text-[10px] text-muted-foreground">
          {graphData.nodes.length} nodes · {graphData.links.length} links
        </div>

        {/* Export */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-[10px] w-full">
              <Download className="h-3 w-3 mr-1" /> Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[120px]">
            <DropdownMenuItem onClick={() => exportAsImage("png")} className="text-xs">PNG</DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportAsImage("jpeg")} className="text-xs">JPEG</DropdownMenuItem>
            <DropdownMenuItem onClick={exportAsSvg} className="text-xs">SVG</DropdownMenuItem>
            <DropdownMenuItem onClick={exportAsHtml} className="text-xs">HTML</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Legend */}
      <div className="absolute top-3 right-3 z-10 bg-card/95 backdrop-blur-md border border-border rounded-lg p-2.5 max-w-[160px] max-h-[220px] overflow-y-auto shadow-lg">
        <span className="text-[10px] font-semibold text-foreground block mb-1.5">Legend</span>
        {Object.entries(legend).map(([group, color]) => (
          <div key={group} className="flex items-center gap-1.5 text-[10px] text-muted-foreground py-0.5">
            <span className="h-2.5 w-2.5 rounded-full shrink-0 shadow-sm" style={{ background: color }} />
            <span className="truncate">{group === "root" ? "/" : group}</span>
          </div>
        ))}
      </div>

      {/* Tooltip */}
      <AnimatePresence>
        {hoveredNode && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-3 left-3 z-10 bg-popover border border-border rounded-lg p-2.5 max-w-xs shadow-xl"
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
            className="absolute top-14 right-3 z-20 bg-popover border border-border rounded-lg p-3 w-64 shadow-xl"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-foreground">Node Details</span>
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setSelectedNode(null)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
            <div className="space-y-1.5 text-[11px]">
              <div>
                <span className="text-muted-foreground">Full URL</span>
                <a href={selectedNode.fullUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-foreground hover:underline break-all">
                  {selectedNode.fullUrl}
                  <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                </a>
              </div>
              <div>
                <span className="text-muted-foreground">Path</span>
                <p className="text-foreground">{selectedNode.label}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Parent</span>
                <p className="text-foreground">{selectedNode.parentId || "None (root)"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Crawl Depth</span>
                <p className="text-foreground">{selectedNode.depth}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Group</span>
                <div className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ background: getGroupColor(selectedNode.group) }} />
                  <span className="text-foreground">{selectedNode.group === "root" ? "/" : selectedNode.group}</span>
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
          const r = node.group === "root" ? 8 : 5;
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
        }}
        linkColor={linkColor}
        linkWidth={0.3}
        onNodeHover={(node: any) => setHoveredNode(node as GraphNode | null)}
        onNodeClick={(node: any) => setSelectedNode(node as GraphNode)}
        cooldownTicks={100}
        d3AlphaDecay={0.05}
        d3VelocityDecay={0.35}
        enableZoomInteraction
        enablePanInteraction
      />
    </div>
  );
}
