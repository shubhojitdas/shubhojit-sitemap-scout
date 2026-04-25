import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard, FileText, AlignLeft, Heading1, Heading2, Heading3,
  Image as ImageIcon, Code, Bot, Link2, Languages, LinkIcon, Share2,
  FileCode2, Network, ServerCrash, ListTree,
} from "lucide-react";
import type { CrawlResult } from "@/lib/crawl-api";

export type ResultsView =
  | "overview"
  | "internal"
  | "response-codes"
  | "combined"
  | "page-titles"
  | "meta-description"
  | "h1" | "h2" | "h3"
  | "images"
  | "canonicals"
  | "hreflang"
  | "schema"
  | "meta-robots"
  | "social"
  | "internal-links"
  | "link-graph"
  | "sitemap"
  | "robots-txt";

interface Item {
  view: ResultsView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
  visible?: boolean;
}

interface Props {
  view: ResultsView;
  setView: (v: ResultsView) => void;
  results: CrawlResult[];
  flags: {
    includeTitle: boolean;
    includeDesc: boolean;
    includeH1: boolean;
    includeH2: boolean;
    includeH3: boolean;
    includeImages: boolean;
    includeSchemas: boolean;
    includeRobots: boolean;
    includeCanonical: boolean;
    includeHreflangs: boolean;
    includeInternalLinks: boolean;
    includeSocialTags: boolean;
  };
  crawlSource: "sitemap" | "site" | "urls" | null;
}

export function ResultsSidebar({ view, setView, results, flags, crawlSource }: Props) {
  const total = results.length;
  const c3xx = results.filter((r) => (r.redirectChain?.length ?? 0) > 0 || (r.statusCode >= 300 && r.statusCode < 400)).length;
  const c4xx = results.filter((r) => r.statusCode >= 400 && r.statusCode < 500).length;
  const c5xx = results.filter((r) => r.statusCode >= 500).length;
  const errors = results.filter((r) => r.status === "Error").length;

  // True if at least one metadata field was crawled — used to gate the Combined view.
  const anyMetaCrawled =
    flags.includeTitle || flags.includeDesc || flags.includeH1 || flags.includeH2 ||
    flags.includeH3 || flags.includeRobots || flags.includeCanonical ||
    flags.includeHreflangs || flags.includeSchemas || flags.includeImages ||
    flags.includeInternalLinks || flags.includeSocialTags;

  const overviewItems: Item[] = [
    { view: "overview", label: "Overview", icon: LayoutDashboard },
    { view: "internal", label: "Internal", icon: ListTree, count: total },
    { view: "response-codes", label: "Response Codes", icon: ServerCrash, count: errors + c3xx + c4xx + c5xx },
  ];

  const seoItems: Item[] = [
    { view: "combined", label: "Combined Meta Data", icon: LayoutDashboard, count: total, visible: anyMetaCrawled },
    { view: "page-titles", label: "Page Titles", icon: FileText, count: total, visible: flags.includeTitle },
    { view: "meta-description", label: "Meta Description", icon: AlignLeft, count: total, visible: flags.includeDesc },
    { view: "h1", label: "H1", icon: Heading1, count: total, visible: flags.includeH1 },
    { view: "h2", label: "H2", icon: Heading2, count: total, visible: flags.includeH2 },
    { view: "h3", label: "H3", icon: Heading3, count: total, visible: flags.includeH3 },
    { view: "meta-robots", label: "Meta Robots", icon: Bot, count: total, visible: flags.includeRobots },
    { view: "canonicals", label: "Canonicals", icon: Link2, count: total, visible: flags.includeCanonical },
    { view: "hreflang", label: "Hreflang", icon: Languages, count: total, visible: flags.includeHreflangs },
    { view: "schema", label: "Schema", icon: Code, count: total, visible: flags.includeSchemas },
    { view: "images", label: "Images", icon: ImageIcon, count: total, visible: flags.includeImages },
    { view: "internal-links", label: "Internal Links", icon: LinkIcon, count: total, visible: flags.includeInternalLinks },
    { view: "social", label: "Social Tags", icon: Share2, count: total, visible: flags.includeSocialTags },
  ];

  const toolItems: Item[] = [
    { view: "link-graph", label: "Link Graph", icon: Network },
    { view: "sitemap", label: "Sitemap", icon: FileCode2, visible: crawlSource === "site" || crawlSource === "sitemap" },
    { view: "robots-txt", label: "Robots.txt", icon: Bot },
  ];

  const renderGroup = (label: string, items: Item[]) => {
    const visible = items.filter((i) => i.visible !== false);
    if (visible.length === 0) return null;
    return (
      <SidebarGroup>
        <SidebarGroupLabel className="text-[10px] uppercase tracking-wider">
          {label}
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {visible.map((it) => {
              const Icon = it.icon;
              const active = view === it.view;
              return (
                <SidebarMenuItem key={it.view}>
                  <SidebarMenuButton
                    isActive={active}
                    onClick={() => setView(it.view)}
                    className="h-8 text-xs"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="flex-1 truncate">{it.label}</span>
                    {it.count !== undefined && it.count > 0 && (
                      <span className={`ml-auto text-[10px] tabular-nums px-1.5 py-0.5 rounded ${
                        active ? "bg-background/20 text-background" : "bg-muted text-muted-foreground"
                      }`}>
                        {it.count.toLocaleString()}
                      </span>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-r">
      {/* Spacer matches the sticky header (h-14 = 56px) + CrawlBar (~52px) so the
          first menu item is never hidden behind the fixed top bars. */}
      <SidebarContent className="pt-[108px]">
        {renderGroup("Crawl", overviewItems)}
        {renderGroup("SEO Data", seoItems)}
        {renderGroup("Tools", toolItems)}
      </SidebarContent>
    </Sidebar>
  );
}
