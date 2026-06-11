import { Facebook, Twitter, ImageOff, Linkedin } from "lucide-react";

export interface SocialPreviewData {
  title: string;
  description: string;
  image: string;
  url: string;
  card?: "summary" | "summary_large_image" | string;
  siteName?: string;
}

function domainOf(u: string): string {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; }
}

export function FacebookPreview({ data }: { data: SocialPreviewData }) {
  const { title, description, image, url } = data;
  const domain = domainOf(url);
  return (
    <div className="rounded-md border border-border bg-background overflow-hidden">
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-border bg-muted/30">
        <Facebook className="h-3 w-3 text-primary" />
        <span className="text-[10px] font-medium text-muted-foreground">Facebook / Open Graph preview</span>
      </div>
      {image ? (
        <div className="aspect-[1.91/1] bg-muted overflow-hidden">
          <img src={image} alt="" className="w-full h-full object-cover" loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        </div>
      ) : (
        <div className="aspect-[1.91/1] bg-muted flex items-center justify-center text-muted-foreground">
          <ImageOff className="h-6 w-6 opacity-40" />
        </div>
      )}
      <div className="p-2.5 space-y-1 bg-muted/20">
        {domain && <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{domain}</div>}
        <div className="text-[12px] font-semibold text-foreground line-clamp-2 leading-snug">{title || "Untitled"}</div>
        {description && <div className="text-[11px] text-muted-foreground line-clamp-2 leading-snug">{description}</div>}
      </div>
    </div>
  );
}

export function TwitterPreview({ data }: { data: SocialPreviewData }) {
  const { title, description, image, url, card } = data;
  const domain = domainOf(url);
  const isLarge = (card || "summary") === "summary_large_image";
  return (
    <div className="rounded-2xl border border-border bg-background overflow-hidden">
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border bg-muted/30">
        <div className="flex items-center gap-1.5">
          <Twitter className="h-3 w-3 text-foreground" />
          <span className="text-[10px] font-medium text-muted-foreground">Twitter / X card preview</span>
        </div>
        <span className="text-[9px] font-mono text-muted-foreground">{card || "summary"}</span>
      </div>
      {isLarge ? (
        <div>
          {image ? (
            <div className="aspect-[2/1] bg-muted overflow-hidden">
              <img src={image} alt="" className="w-full h-full object-cover" loading="lazy"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            </div>
          ) : (
            <div className="aspect-[2/1] bg-muted flex items-center justify-center text-muted-foreground">
              <ImageOff className="h-6 w-6 opacity-40" />
            </div>
          )}
          <div className="p-2.5 space-y-0.5">
            <div className="text-[12px] font-semibold text-foreground line-clamp-2 leading-snug">{title || "Untitled"}</div>
            {description && <div className="text-[11px] text-muted-foreground line-clamp-2 leading-snug">{description}</div>}
            {domain && <div className="text-[10px] text-muted-foreground">{domain}</div>}
          </div>
        </div>
      ) : (
        <div className="flex">
          {image ? (
            <div className="w-20 h-20 bg-muted shrink-0 overflow-hidden">
              <img src={image} alt="" className="w-full h-full object-cover" loading="lazy"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            </div>
          ) : (
            <div className="w-20 h-20 bg-muted shrink-0 flex items-center justify-center text-muted-foreground">
              <ImageOff className="h-5 w-5 opacity-40" />
            </div>
          )}
          <div className="p-2.5 space-y-0.5 min-w-0 flex-1">
            <div className="text-[12px] font-semibold text-foreground line-clamp-2 leading-snug">{title || "Untitled"}</div>
            {description && <div className="text-[11px] text-muted-foreground line-clamp-2 leading-snug">{description}</div>}
            {domain && <div className="text-[10px] text-muted-foreground">{domain}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

export function LinkedInPreview({ data }: { data: SocialPreviewData }) {
  const { title, description, image, url } = data;
  const domain = domainOf(url);
  return (
    <div className="rounded-md border border-border bg-background overflow-hidden">
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-border bg-muted/30">
        <Linkedin className="h-3 w-3 text-primary" />
        <span className="text-[10px] font-medium text-muted-foreground">LinkedIn preview</span>
      </div>
      {image ? (
        <div className="aspect-[1.91/1] bg-muted overflow-hidden">
          <img src={image} alt="" className="w-full h-full object-cover" loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        </div>
      ) : (
        <div className="aspect-[1.91/1] bg-muted flex items-center justify-center text-muted-foreground">
          <ImageOff className="h-6 w-6 opacity-40" />
        </div>
      )}
      <div className="p-2.5 space-y-1 bg-muted/10">
        <div className="text-[12px] font-semibold text-foreground line-clamp-2 leading-snug">{title || "Untitled"}</div>
        {description && <div className="text-[11px] text-muted-foreground line-clamp-2 leading-snug">{description}</div>}
        {domain && <div className="text-[10px] text-muted-foreground">{domain}</div>}
      </div>
    </div>
  );
}

export interface ParsedSocialTags {
  og: Record<string, string>;
  twitter: Record<string, string>;
  raw: Array<{ network: "og" | "twitter"; property: string; content: string }>;
  title?: string;
  description?: string;
  canonical?: string;
}

/** Parse a blob of HTML (or just <meta> tags) and extract OG/Twitter metadata. */
export function parseSocialHtml(html: string): ParsedSocialTags {
  const og: Record<string, string> = {};
  const twitter: Record<string, string> = {};
  const raw: ParsedSocialTags["raw"] = [];
  let title: string | undefined;
  let description: string | undefined;
  let canonical: string | undefined;

  try {
    const wrapped = /<html[\s>]/i.test(html) ? html : `<!doctype html><html><head>${html}</head></html>`;
    const doc = new DOMParser().parseFromString(wrapped, "text/html");

    const t = doc.querySelector("title");
    if (t?.textContent) title = t.textContent.trim();

    const metaDesc = doc.querySelector('meta[name="description" i]') as HTMLMetaElement | null;
    if (metaDesc?.content) description = metaDesc.content;

    const can = doc.querySelector('link[rel="canonical" i]') as HTMLLinkElement | null;
    if (can?.href) canonical = can.getAttribute("href") || undefined;

    doc.querySelectorAll("meta").forEach((m) => {
      const property = (m.getAttribute("property") || "").toLowerCase().trim();
      const name = (m.getAttribute("name") || "").toLowerCase().trim();
      const content = m.getAttribute("content") || "";
      if (!content) return;
      if (property.startsWith("og:")) {
        og[property] = content;
        raw.push({ network: "og", property, content });
      } else if (name.startsWith("twitter:")) {
        twitter[name] = content;
        raw.push({ network: "twitter", property: name, content });
      } else if (property.startsWith("twitter:")) {
        // Some sites incorrectly use property for twitter — still capture
        twitter[property] = content;
        raw.push({ network: "twitter", property, content });
      }
    });
  } catch {
    // Fall through with empty results
  }

  return { og, twitter, raw, title, description, canonical };
}

export function ogToPreview(parsed: ParsedSocialTags, fallbackUrl = ""): SocialPreviewData {
  return {
    title: parsed.og["og:title"] || parsed.title || "",
    description: parsed.og["og:description"] || parsed.description || "",
    image: parsed.og["og:image"] || parsed.og["og:image:secure_url"] || "",
    url: parsed.og["og:url"] || parsed.canonical || fallbackUrl,
    siteName: parsed.og["og:site_name"],
  };
}

export function twitterToPreview(parsed: ParsedSocialTags, fallbackUrl = ""): SocialPreviewData {
  return {
    title: parsed.twitter["twitter:title"] || parsed.og["og:title"] || parsed.title || "",
    description: parsed.twitter["twitter:description"] || parsed.og["og:description"] || parsed.description || "",
    image: parsed.twitter["twitter:image"] || parsed.og["og:image"] || "",
    url: parsed.twitter["twitter:url"] || parsed.og["og:url"] || parsed.canonical || fallbackUrl,
    card: (parsed.twitter["twitter:card"] as SocialPreviewData["card"]) || "summary",
  };
}
