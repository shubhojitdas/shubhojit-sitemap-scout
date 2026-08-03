// Site-scoped AI conversation history. Kept in localStorage, never leaves the browser.

export interface AiTurn {
  id: string;
  prompt: string;
  answer: string;
  provider: string;
  model: string;
  createdAt: number;
  usedContext: boolean;
}

const PREFIX = "sitemap-scout-ai-turns-v2:";
const LEGACY_KEY = "sitemap-scout-ai-turns-v1";

/** Stable per-site scope so audits of different websites never share a thread. */
export function siteScopeFromUrls(urls: string[]): string {
  for (const u of urls) {
    try {
      const host = new URL(u).hostname.replace(/^www\./, "").toLowerCase();
      if (host) return host;
    } catch { /* skip */ }
  }
  return "unscoped";
}

export function loadAiTurns(scope: string): AiTurn[] {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFIX + scope) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch { return []; }
}

export function saveAiTurns(scope: string, turns: AiTurn[]) {
  try {
    if (turns.length === 0) localStorage.removeItem(PREFIX + scope);
    else localStorage.setItem(PREFIX + scope, JSON.stringify(turns.slice(-50)));
  } catch { /* ignore */ }
}

/** Wipe every stored AI conversation — used when the crawl is cleared/reset. */
export function clearAllAiTurns() {
  try {
    localStorage.removeItem(LEGACY_KEY);
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) doomed.push(k);
    }
    doomed.forEach((k) => localStorage.removeItem(k));
  } catch { /* ignore */ }
}
