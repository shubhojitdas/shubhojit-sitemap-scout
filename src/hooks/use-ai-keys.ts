import { useCallback, useEffect, useState } from "react";

const LS_KEYS = "sitemap-scout-ai-keys-v1";
const LS_SETTINGS = "sitemap-scout-ai-settings-v1";

interface Settings { providerId: string; modelByProvider: Record<string, string>; }

function loadKeys(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(LS_KEYS) || "{}") || {}; } catch { return {}; }
}
function saveKeys(v: Record<string, string>) {
  try { localStorage.setItem(LS_KEYS, JSON.stringify(v)); } catch { /* ignore */ }
}
function loadSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_SETTINGS) || "null");
    if (raw && typeof raw.providerId === "string") return { providerId: raw.providerId, modelByProvider: raw.modelByProvider || {} };
  } catch { /* ignore */ }
  return { providerId: "lovable", modelByProvider: {} };
}
function saveSettings(s: Settings) {
  try { localStorage.setItem(LS_SETTINGS, JSON.stringify(s)); } catch { /* ignore */ }
}

// Client-side only: API keys never leave the browser.
export function useAiSettings() {
  const [keys, setKeys] = useState<Record<string, string>>(() => loadKeys());
  const [settings, setSettingsState] = useState<Settings>(() => loadSettings());

  useEffect(() => { saveKeys(keys); }, [keys]);
  useEffect(() => { saveSettings(settings); }, [settings]);

  const setKey = useCallback((providerId: string, key: string) => {
    setKeys((prev) => ({ ...prev, [providerId]: key }));
  }, []);
  const clearKey = useCallback((providerId: string) => {
    setKeys((prev) => { const n = { ...prev }; delete n[providerId]; return n; });
  }, []);
  const setProvider = useCallback((providerId: string) => {
    setSettingsState((s) => ({ ...s, providerId }));
  }, []);
  const setModel = useCallback((providerId: string, model: string) => {
    setSettingsState((s) => ({ ...s, modelByProvider: { ...s.modelByProvider, [providerId]: model } }));
  }, []);

  return { keys, settings, setKey, clearKey, setProvider, setModel };
}
