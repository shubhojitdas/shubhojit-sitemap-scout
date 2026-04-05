/**
 * Utilities to transform a flat list of URLs into graph nodes & links
 * for react-force-graph-2d.
 */

export interface GraphNode {
  id: string;
  label: string;
  group: string;
  depth: number;
  fullUrl: string;
  parentId: string | null;
  val: number; // node size
}

export interface GraphLink {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

// Predefined palette for groups – easy on the eyes
const GROUP_COLORS = [
  "#3b82f6", // blue
  "#22c55e", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
  "#14b8a6", // teal
  "#a855f7", // purple
  "#64748b", // slate
  "#84cc16", // lime
];

let groupColorMap: Record<string, string> = {};

export function getGroupColor(group: string): string {
  if (!groupColorMap[group]) {
    const idx = Object.keys(groupColorMap).length % GROUP_COLORS.length;
    groupColorMap[group] = GROUP_COLORS[idx];
  }
  return groupColorMap[group];
}

export function resetGroupColors() {
  groupColorMap = {};
}

/**
 * Build a graph from a flat array of URL strings.
 * maxDepth & maxNodes allow filtering for performance.
 */
export function buildGraphFromUrls(
  urls: string[],
  maxDepth = Infinity,
  maxNodes = 500
): GraphData {
  resetGroupColors();

  const nodeMap = new Map<string, GraphNode>();
  const links: GraphLink[] = [];

  // Ensure we have a root
  if (urls.length === 0) return { nodes: [], links: [] };

  // Determine root origin from the first URL
  let rootOrigin: string;
  try {
    rootOrigin = new URL(urls[0]).origin;
  } catch {
    rootOrigin = "https://unknown.com";
  }

  const rootId = rootOrigin + "/";

  // Always add root node
  nodeMap.set(rootId, {
    id: rootId,
    label: "/",
    group: "root",
    depth: 0,
    fullUrl: rootId,
    parentId: null,
    val: 8,
  });
  getGroupColor("root"); // assign color

  // Process each URL
  for (const rawUrl of urls) {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      continue;
    }

    const pathParts = parsed.pathname
      .split("/")
      .filter((p) => p.length > 0);

    const topGroup = pathParts.length > 0 ? `/${pathParts[0]}/` : "root";

    // Build intermediate nodes up to the leaf
    let currentPath = rootOrigin;
    let parentId = rootId;

    for (let i = 0; i < pathParts.length; i++) {
      currentPath += "/" + pathParts[i];
      const nodeId = currentPath.endsWith("/") ? currentPath : currentPath + (i < pathParts.length - 1 ? "/" : "");
      // normalise: intermediate segments get trailing slash, leaf doesn't
      const normId = i < pathParts.length - 1 ? currentPath + "/" : currentPath;
      const depth = i + 1;

      if (depth > maxDepth) break;

      if (!nodeMap.has(normId)) {
        const group = i === 0 ? `/${pathParts[0]}/` : topGroup;
        getGroupColor(group);
        nodeMap.set(normId, {
          id: normId,
          label: "/" + pathParts.slice(0, i + 1).join("/"),
          group,
          depth,
          fullUrl: parsed.origin + "/" + pathParts.slice(0, i + 1).join("/"),
          parentId,
          val: Math.max(1, 4 - depth),
        });
      }

      // Add link parent -> child
      const linkKey = `${parentId}|${normId}`;
      if (parentId !== normId) {
        // Avoid duplicate links
        const exists = links.some(
          (l) => l.source === parentId && l.target === normId
        );
        if (!exists) {
          links.push({ source: parentId, target: normId });
        }
      }

      parentId = normId;
    }
  }

  // Enforce maxNodes
  let nodes = Array.from(nodeMap.values());
  if (nodes.length > maxNodes) {
    // Prioritise lower depth nodes
    nodes.sort((a, b) => a.depth - b.depth);
    nodes = nodes.slice(0, maxNodes);
    const nodeIds = new Set(nodes.map((n) => n.id));
    const filteredLinks = links.filter(
      (l) => nodeIds.has(l.source as string) && nodeIds.has(l.target as string)
    );
    return { nodes, links: filteredLinks };
  }

  return { nodes, links };
}

export function getGroupLegend(): Record<string, string> {
  return { ...groupColorMap };
}
