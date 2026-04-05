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
import { Maximize2, X, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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

  // Build graph data
  const graphData: GraphData = useMemo(() => {
    const data = buildGraphFromUrls(urls, maxDepth, maxNodes);
    // Small delay so spinner shows while force sim stabilises
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
          height: Math.max(450, entry.contentRect.height),
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
      const radius = isRoot ? 6 : Math.max(2, 4 - n.depth + 1);
      const isHighlighted = !hoveredNode || highlightNodes.has(n.id);
      const alpha = hoveredNode ? (isHighlighted ? 1 : 0.12) : 0.85;
      const color = getGroupColor(n.group);

      ctx.beginPath();
      ctx.arc(n.x, n.y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = isRoot ? "#f59e0b" : color;
      ctx.globalAlpha = alpha;
      ctx.fill();

      if (isRoot || (isHighlighted && globalScale > 1.5)) {
        ctx.font = `${Math.max(10 / globalScale, 2)}px Inter, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = isRoot ? "#f59e0b" : color;
        ctx.globalAlpha = alpha;
        ctx.fillText(n.label, n.x, n.y + radius + 1);
      }

      ctx.globalAlpha = 1;
    },
    [hoveredNode, highlightNodes]
  );

  const linkColor = useCallback(
    (link: any) => {
      if (!hoveredNode) return "hsla(0,0%,50%,0.15)";
      const src = typeof link.source === "object" ? link.source.id : link.source;
      const tgt = typeof link.target === "object" ? link.target.id : link.target;
      if (highlightNodes.has(src) && highlightNodes.has(tgt))
        return "hsla(0,0%,70%,0.6)";
      return "hsla(0,0%,50%,0.05)";
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
    return Math.min(max, 10);
  }, [urls]);

  return (
    <div className="relative w-full rounded-xl border border-border bg-card overflow-hidden" ref={containerRef} style={{ minHeight: 500 }}>
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
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-2 bg-card/90 backdrop-blur-md border border-border rounded-lg p-3 max-w-[200px]">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-foreground">Controls</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleZoomToFit}>
            <Maximize2 className="h-3 w-3" />
          </Button>
        </div>

        <div>
          <label className="text-[10px] text-muted-foreground">Max Depth: {maxDepth}</label>
          <Slider
            value={[maxDepth]}
            onValueChange={(v) => setMaxDepth(v[0])}
            min={1}
            max={maxPossibleDepth}
            step={1}
            className="mt-1"
          />
        </div>

        <div>
          <label className="text-[10px] text-muted-foreground">Max Nodes: {maxNodes}</label>
          <Slider
            value={[maxNodes]}
            onValueChange={(v) => setMaxNodes(v[0])}
            min={50}
            max={Math.min(urls.length + 50, 2000)}
            step={50}
            className="mt-1"
          />
        </div>

        <div className="text-[10px] text-muted-foreground">
          {graphData.nodes.length} nodes · {graphData.links.length} links
        </div>
      </div>

      {/* Legend */}
      <div className="absolute top-3 right-3 z-10 bg-card/90 backdrop-blur-md border border-border rounded-lg p-2 max-w-[160px] max-h-[200px] overflow-y-auto">
        <span className="text-[10px] font-medium text-foreground block mb-1">Legend</span>
        {Object.entries(legend).map(([group, color]) => (
          <div key={group} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: color }} />
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
            className="absolute bottom-3 left-3 z-10 bg-popover border border-border rounded-lg p-2.5 max-w-xs shadow-lg"
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
                <a
                  href={selectedNode.fullUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-foreground hover:underline break-all"
                >
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
        linkWidth={0.5}
        onNodeHover={(node: any) => setHoveredNode(node as GraphNode | null)}
        onNodeClick={(node: any) => setSelectedNode(node as GraphNode)}
        cooldownTicks={100}
        d3AlphaDecay={0.04}
        d3VelocityDecay={0.3}
        enableZoomInteraction
        enablePanInteraction
      />
    </div>
  );
}
