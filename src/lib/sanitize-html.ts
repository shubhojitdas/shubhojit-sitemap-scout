import DOMPurify from "dompurify";

// Central HTML sanitizer for content authored via the CMS WYSIWYG editor.
// Allows the tags TipTap emits (headings, lists, tables, links, images, code)
// but strips scripts, iframes, and dangerous attributes/handlers.
export function sanitizeHtml(input: string | null | undefined): string {
  if (!input) return "";
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [
      "p", "br", "hr", "span", "div",
      "b", "strong", "i", "em", "u", "s", "strike", "sup", "sub",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "ul", "ol", "li",
      "blockquote", "pre", "code",
      "a", "img",
      "table", "thead", "tbody", "tr", "th", "td",
    ],
    ALLOWED_ATTR: ["href", "target", "rel", "src", "alt", "title", "class", "colspan", "rowspan"],
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ["target"],
  });
}
