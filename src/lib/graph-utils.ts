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
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      continue;
    }
    const origin = parsed.origin;
    if (!urlsByOrigin.has(origin)) urlsByOrigin.set(origin, []);
    urlsByOrigin.get(origin)!.push(parsed);
  }

  const multiDomain = urlsByOrigin.size > 1;

  // If multiple domains, create a virtual super-root
  const superRootId = "__super_root__";
  if (multiDomain) {
    nodeMap.set(superRootId, {
      id: superRootId,
      label: "All Domains",
      group: "root",
      depth: 0,
      fullUrl: "",
      parentId: null,
      val: 10,
    });
    getGroupColor("root");
  }

  // Process each origin independently
  for (const [origin, parsedUrls] of urlsByOrigin) {
    const rootId = origin + "/";
    const domainDepthOffset = multiDomain ? 1 : 0;

    // Add domain root node
    if (!nodeMap.has(rootId)) {
      nodeMap.set(rootId, {
        id: rootId,
        label: multiDomain ? new URL(origin).hostname : "/",
        group: multiDomain ? new URL(origin).hostname : "root",
        depth: domainDepthOffset,
        fullUrl: rootId,
        parentId: multiDomain ? superRootId : null,
        val: 8,
      });
      if (multiDomain) {
        getGroupColor(new URL(origin).hostname);
      } else {
        getGroupColor("root");
      }

      // Link super-root -> domain root
      if (multiDomain) {
        links.push({ source: superRootId, target: rootId });
      }
    }

    // Process each URL under this origin
    for (const parsed of parsedUrls) {
      const pathParts = parsed.pathname
        .split("/")
        .filter((p) => p.length > 0);

      const topGroup = pathParts.length > 0
        ? (multiDomain ? `${new URL(origin).hostname}/${pathParts[0]}` : `/${pathParts[0]}/`)
        : (multiDomain ? new URL(origin).hostname : "root");

      let parentId = rootId;

      for (let i = 0; i < pathParts.length; i++) {
        const normId = origin + "/" + pathParts.slice(0, i + 1).join("/");
        const depth = i + 1 + domainDepthOffset;

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
