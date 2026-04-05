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
  const [nodeDistance, setNodeDistance] = useState(30);
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

  // Update force distance when nodeDistance changes
  useEffect(() => {
    if (fgRef.current) {
      (fgRef.current as any).d3Force?.("link")?.distance?.(nodeDistance);
      (fgRef.current as any).d3ReheatSimulation?.();
    }
  }, [nodeDistance]);

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

      // Labels
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
      if (!hoveredNode) return "hsla(220,15%,50%,0.18)";
      const src = typeof link.source === "object" ? link.source.id : link.source;
      const tgt = typeof link.target === "object" ? link.target.id : link.target;
      if (highlightNodes.has(src) && highlightNodes.has(tgt))
        return "hsla(45,100%,60%,0.7)";
      return "hsla(0,0%,50%,0.03)";
    },
    [hoveredNode, highlightNodes]
  );

  const maxPossibleDepth = 10;

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

  const buildInteractiveHtml = (): string => {
    // Serialize graph data for embedding
    const serializableNodes = graphData.nodes.map(n => ({
      id: n.id, label: n.label, group: n.group, depth: n.depth,
      fullUrl: n.fullUrl, parentId: n.parentId, val: n.val,
    }));
    const serializableLinks = graphData.links.map(l => ({
      source: typeof l.source === "object" ? (l.source as any).id : l.source,
      target: typeof l.target === "object" ? (l.target as any).id : l.target,
    }));
    const legendData = { ...legend };

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Link Graph - Sitemap Scout</title>
<script src="https://unpkg.com/force-graph@1.47.3/dist/force-graph.min.js"><\/script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0a0a0a;color:#e5e5e5;font-family:Inter,system-ui,sans-serif;overflow:hidden}
#graph{width:100vw;height:100vh}
.controls{position:fixed;top:12px;left:12px;z-index:10;background:rgba(20,20,20,0.95);
border:1px solid #333;border-radius:10px;padding:14px;width:220px;backdrop-filter:blur(12px)}
.controls h3{font-size:11px;font-weight:600;margin-bottom:8px;color:#e5e5e5}
.control-group{margin-bottom:10px}
.control-group label{font-size:10px;color:#999;display:block;margin-bottom:4px}
.control-group input[type=range]{width:100%;accent-color:#3b82f6;height:6px}
.control-group .value{font-size:10px;color:#ccc;float:right}
.legend{position:fixed;top:12px;right:12px;z-index:10;background:rgba(20,20,20,0.95);
border:1px solid #333;border-radius:10px;padding:12px;max-width:160px;max-height:300px;
overflow-y:auto;backdrop-filter:blur(12px)}
.legend h3{font-size:10px;font-weight:600;margin-bottom:6px;color:#e5e5e5}
.legend-item{display:flex;align-items:center;gap:6px;font-size:10px;color:#999;padding:2px 0}
.legend-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.tooltip{position:fixed;bottom:12px;left:12px;z-index:10;background:rgba(20,20,20,0.95);
border:1px solid #333;border-radius:8px;padding:10px;max-width:350px;display:none;backdrop-filter:blur(12px)}
.tooltip .url{font-size:11px;font-weight:500;color:#e5e5e5;word-break:break-all}
.tooltip .meta{font-size:10px;color:#999;margin-top:2px}
.stats{font-size:10px;color:#666;margin-top:4px}
.btn{background:#222;border:1px solid #444;color:#ccc;padding:4px 10px;border-radius:6px;
cursor:pointer;font-size:10px;margin-top:6px}
.btn:hover{background:#333}
.checkbox-label{font-size:10px;color:#999;display:flex;align-items:center;gap:4px;cursor:pointer}
.checkbox-label input{width:12px;height:12px}
</style>
</head>
<body>
<div id="graph"></div>
<div class="controls">
  <h3>Controls</h3>
  <div class="control-group">
    <label>Max Depth: <span class="value" id="depthVal">${maxDepth}</span></label>
    <input type="range" id="depthSlider" min="1" max="10" value="${maxDepth}">
  </div>
  <div class="control-group">
    <label>Max Nodes: <span class="value" id="nodesVal">${maxNodes}</span></label>
    <input type="range" id="nodesSlider" min="50" max="5000" step="50" value="${maxNodes}">
  </div>
  <div class="control-group">
    <label>Node Distance: <span class="value" id="distVal">${nodeDistance}</span></label>
    <input type="range" id="distSlider" min="5" max="150" value="${nodeDistance}">
  </div>
  <div class="control-group">
    <label class="checkbox-label"><input type="checkbox" id="labelsToggle" checked> Show Labels</label>
  </div>
  <div class="stats" id="stats"></div>
  <button class="btn" id="zoomBtn">Zoom to Fit</button>
</div>
<div class="legend" id="legend">
  <h3>Legend</h3>
</div>
<div class="tooltip" id="tooltip">
  <div class="url" id="tipUrl"></div>
  <div class="meta" id="tipMeta"></div>
</div>
<script>
const allNodes = ${JSON.stringify(serializableNodes)};
const allLinks = ${JSON.stringify(serializableLinks)};
const legendData = ${JSON.stringify(legendData)};
const GROUP_COLORS = ["#3b82f6","#22c55e","#f59e0b","#ef4444","#8b5cf6","#ec4899","#06b6d4","#f97316","#14b8a6","#a855f7","#64748b","#84cc16"];
let colorMap = {};
function getColor(g) {
  if (!colorMap[g]) { colorMap[g] = GROUP_COLORS[Object.keys(colorMap).length % GROUP_COLORS.length]; }
  return colorMap[g];
}
// Init color map from legend
Object.entries(legendData).forEach(([g,c]) => { colorMap[g] = c; });

let currentDepth = ${maxDepth}, currentMaxNodes = ${maxNodes}, currentDist = ${nodeDistance}, showLabels = true;
let hoveredNode = null, highlightSet = new Set();

function filterData() {
  let nodes = allNodes.filter(n => n.depth <= currentDepth);
  nodes.sort((a,b) => a.depth - b.depth);
  if (nodes.length > currentMaxNodes) nodes = nodes.slice(0, currentMaxNodes);
  const ids = new Set(nodes.map(n => n.id));
  const links = allLinks.filter(l => ids.has(l.source) && ids.has(l.target));
  document.getElementById('stats').textContent = nodes.length + ' nodes · ' + links.length + ' links';
  return { nodes: nodes.map(n => ({...n})), links: links.map(l => ({...l})) };
}

// Legend
const legendEl = document.getElementById('legend');
Object.entries(legendData).forEach(([g,c]) => {
  const d = document.createElement('div'); d.className = 'legend-item';
  d.innerHTML = '<span class="legend-dot" style="background:'+c+'"></span><span>'+(g==='root'?'/':g)+'</span>';
  legendEl.appendChild(d);
});

const tooltip = document.getElementById('tooltip');
const tipUrl = document.getElementById('tipUrl');
const tipMeta = document.getElementById('tipMeta');

const Graph = ForceGraph()(document.getElementById('graph'))
  .graphData(filterData())
  .backgroundColor('#0a0a0a')
  .linkColor(link => {
    if (!hoveredNode) return 'rgba(100,120,160,0.18)';
    const s = typeof link.source === 'object' ? link.source.id : link.source;
    const t = typeof link.target === 'object' ? link.target.id : link.target;
    return (highlightSet.has(s) && highlightSet.has(t)) ? 'rgba(250,200,50,0.7)' : 'rgba(100,100,100,0.03)';
  })
  .linkWidth(l => {
    if (!hoveredNode) return 0.5;
    const s = typeof l.source === 'object' ? l.source.id : l.source;
    const t = typeof l.target === 'object' ? l.target.id : l.target;
    return (highlightSet.has(s) && highlightSet.has(t)) ? 1.5 : 0.2;
  })
  .nodeCanvasObject((node, ctx, globalScale) => {
    const isRoot = node.group === 'root';
    const r = isRoot ? 7 : Math.max(1.5, 3.5 - node.depth * 0.4);
    const isHl = !hoveredNode || highlightSet.has(node.id);
    const alpha = hoveredNode ? (isHl ? 1 : 0.08) : 0.9;
    const col = isRoot ? '#f59e0b' : getColor(node.group);
    if (isHl && hoveredNode) {
      ctx.beginPath(); ctx.arc(node.x, node.y, r+3, 0, 2*Math.PI);
      ctx.fillStyle = isRoot ? 'rgba(245,158,11,0.15)' : col+'26';
      ctx.globalAlpha = 1; ctx.fill();
    }
    ctx.beginPath(); ctx.arc(node.x, node.y, r, 0, 2*Math.PI);
    ctx.fillStyle = col; ctx.globalAlpha = alpha; ctx.fill();
    const shouldLabel = isRoot || (showLabels && isHl && globalScale > 2.2);
    if (shouldLabel) {
      const fs = Math.max(9/globalScale, 1.5);
      ctx.font = fs+'px Inter,system-ui,sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillStyle = col; ctx.globalAlpha = alpha;
      const lbl = node.depth <= 1 ? node.label : '/' + node.label.split('/').pop();
      ctx.fillText(lbl, node.x, node.y + r + 1.5);
    }
    ctx.globalAlpha = 1;
  })
  .nodePointerAreaPaint((node, color, ctx) => {
    const r = node.group === 'root' ? 8 : 5;
    ctx.beginPath(); ctx.arc(node.x, node.y, r, 0, 2*Math.PI);
    ctx.fillStyle = color; ctx.fill();
  })
  .onNodeHover(node => {
    hoveredNode = node || null;
    highlightSet.clear();
    if (node) {
      highlightSet.add(node.id);
      const data = Graph.graphData();
      data.links.forEach(l => {
        const s = typeof l.source === 'object' ? l.source.id : l.source;
        const t = typeof l.target === 'object' ? l.target.id : l.target;
        if (s === node.id) highlightSet.add(t);
        if (t === node.id) highlightSet.add(s);
      });
      tipUrl.textContent = node.fullUrl;
      tipMeta.textContent = 'Depth: ' + node.depth + ' · Group: ' + (node.group === 'root' ? '/' : node.group);
      tooltip.style.display = 'block';
    } else {
      tooltip.style.display = 'none';
    }
  })
  .onNodeClick(node => {
    if (node && node.fullUrl) window.open(node.fullUrl, '_blank');
  })
  .cooldownTicks(100)
  .d3AlphaDecay(0.05)
  .d3VelocityDecay(0.35);

Graph.d3Force('link').distance(currentDist);
setTimeout(() => Graph.zoomToFit(600, 40), 800);

function rebuild() {
  Graph.graphData(filterData());
  Graph.d3Force('link').distance(currentDist);
  setTimeout(() => Graph.zoomToFit(400, 40), 300);
}

document.getElementById('depthSlider').addEventListener('input', e => {
  currentDepth = +e.target.value;
  document.getElementById('depthVal').textContent = currentDepth;
  rebuild();
});
document.getElementById('nodesSlider').addEventListener('input', e => {
  currentMaxNodes = +e.target.value;
  document.getElementById('nodesVal').textContent = currentMaxNodes;
  rebuild();
});
document.getElementById('distSlider').addEventListener('input', e => {
  currentDist = +e.target.value;
  document.getElementById('distVal').textContent = currentDist;
  Graph.d3Force('link').distance(currentDist);
  Graph.d3ReheatSimulation();
});
document.getElementById('labelsToggle').addEventListener('change', e => {
  showLabels = e.target.checked;
});
document.getElementById('zoomBtn').addEventListener('click', () => Graph.zoomToFit(400, 40));
<\/script>
</body>
</html>`;
  };

  const exportAsHtml = () => {
    const html = buildInteractiveHtml();
    const blob = new Blob([html], { type: "text/html" });
    const link = document.createElement("a");
    link.download = "link-graph.html";
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const openInNewTab = () => {
    const html = buildInteractiveHtml();
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
          <Slider value={[maxNodes]} onValueChange={(v) => setMaxNodes(v[0])} min={50} max={5000} step={50} className="mt-1" />
        </div>

        <div>
          <label className="text-[10px] text-muted-foreground">Node Distance: {nodeDistance}</label>
          <Slider value={[nodeDistance]} onValueChange={(v) => setNodeDistance(v[0])} min={5} max={150} step={1} className="mt-1" />
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
            <DropdownMenuItem onClick={exportAsHtml} className="text-xs">Interactive HTML</DropdownMenuItem>
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
        linkWidth={(link: any) => {
          if (!hoveredNode) return 0.5;
          const src = typeof link.source === "object" ? link.source.id : link.source;
          const tgt = typeof link.target === "object" ? link.target.id : link.target;
          if (highlightNodes.has(src) && highlightNodes.has(tgt)) return 1.5;
          return 0.2;
        }}
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
