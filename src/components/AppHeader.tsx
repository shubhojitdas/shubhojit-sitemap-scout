import { Link, useLocation } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Linkedin } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Fixed top header. Persists across every route.
 * Pages must add `pt-14` (or use a spacer) to avoid being hidden underneath.
 */
export function AppHeader() {
  const { pathname } = useLocation();
  const isActive = (p: string) =>
    p === "/" ? pathname === "/" : pathname.startsWith(p);

  const navItem = (to: string, label: string) => {
    // About page (and any non-root nav target) opens in a new tab so the
    // crawler state in the current tab is never reset.
    const openInNewTab = to !== "/";
    const baseClass = `relative text-xs font-medium px-2 py-1 rounded-md transition-colors ${
      isActive(to)
        ? "text-foreground"
        : "text-muted-foreground hover:text-foreground"
    }`;

    if (openInNewTab) {
      return (
        <a
          href={to}
          target="_blank"
          rel="noopener noreferrer"
          className={baseClass}
        >
          {label}
        </a>
      );
    }

    return (
      <Link to={to} className={baseClass}>
        {label}
        {isActive(to) && (
          <span className="absolute -bottom-[10px] left-1/2 -translate-x-1/2 h-[2px] w-6 bg-foreground rounded-full" />
        )}
      </Link>
    );
  };

  return (
    <header className="fixed top-0 inset-x-0 h-14 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="container max-w-7xl mx-auto h-full flex items-center justify-between px-4">
        {/* Left: wordmark */}
        <Link to="/" className="flex items-center gap-2">
          <span className="font-semibold text-sm tracking-tight text-foreground">
            SEO Sitemap Scout
          </span>
        </Link>

        {/* Center: nav */}
        <nav className="hidden sm:flex items-center gap-1">
          {navItem("/", "Crawler")}
          {navItem("/shubhojit-das", "About")}
        </nav>

        {/* Right: by Shubhojit + utilities */}
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-[11px] text-muted-foreground">
            by{" "}
            <a
              href="/shubhojit-das"
              target="_blank"
              rel="noopener noreferrer"
              className="story-link text-foreground font-medium"
            >
              Shubhojit Das
            </a>
          </span>
          <ThemeToggle />
          <a
            href="https://www.linkedin.com/in/shubhojitdas/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
            >
              <Linkedin className="h-3.5 w-3.5" />
            </Button>
          </a>
        </div>
      </div>
    </header>
  );
}
