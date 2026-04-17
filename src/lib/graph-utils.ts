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

function stripWww(hostname: string): string {
  return hostname.replace(/^www\./i, "");
}

function normalizeGraphUrl(rawUrl: string): URL | null {
  try {
    const parsed = new URL(rawUrl);
    parsed.hostname = stripWww(parsed.hostname);
    parsed.hash = "";
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed;
  } catch {
    return null;
  }
}

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
 * Groups URLs by their origin (domain) so different domains are never mixed.
 * maxDepth & maxNodes allow filtering for performance.
 */
export function buildGraphFromUrls(
  urls: string[],
  maxDepth = 3,
  maxNodes = 500
): GraphData {
  resetGroupColors();

  const nodeMap = new Map<string, GraphNode>();
  const links: GraphLink[] = [];

  if (urls.length === 0) return { nodes: [], links: [] };

  // Group URLs by origin
  const urlsByOrigin = new Map<string, URL[]>();
  for (const rawUrl of urls) {
    const parsed = normalizeGraphUrl(rawUrl);
    if (!parsed) {
      continue;
    }
    const origin = parsed.origin;
    if (!urlsByOrigin.has(origin)) urlsByOrigin.set(origin, []);
    urlsByOrigin.get(origin)!.push(parsed);
  }

  // Process each origin independently – no super-root, domains stay separate
  for (const [origin, parsedUrls] of urlsByOrigin) {
    const rootId = origin + "/";

    // Add domain root node
    if (!nodeMap.has(rootId)) {
      nodeMap.set(rootId, {
        id: rootId,
        label: new URL(origin).hostname,
        group: new URL(origin).hostname,
        depth: 0,
        fullUrl: rootId,
        parentId: null,
        val: 8,
      });
      getGroupColor(new URL(origin).hostname);
    }

    // Process each URL under this origin
    for (const parsed of parsedUrls) {
      const pathParts = parsed.pathname
        .split("/")
        .filter((p) => p.length > 0);

      const hostname = new URL(origin).hostname;
      const topGroup = pathParts.length > 0
        ? `${hostname}/${pathParts[0]}`
        : hostname;

      let parentId = rootId;

      for (let i = 0; i < pathParts.length; i++) {
        const normId = origin + "/" + pathParts.slice(0, i + 1).join("/");
        const depth = i + 1;

        if (depth > maxDepth) break;

        if (!nodeMap.has(normId)) {
          const group = i === 0 ? topGroup : topGroup;
          getGroupColor(group);
          nodeMap.set(normId, {
            id: normId,
            label: "/" + pathParts.slice(0, i + 1).join("/"),
            group,
            depth,
            fullUrl: origin + "/" + pathParts.slice(0, i + 1).join("/"),
            parentId,
            val: Math.max(1, 4 - depth),
          });
        }

        // Add link parent -> child (avoid duplicates)
        if (parentId !== normId) {
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
  }

  // Enforce maxNodes
  let nodes = Array.from(nodeMap.values());
  if (nodes.length > maxNodes) {
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
