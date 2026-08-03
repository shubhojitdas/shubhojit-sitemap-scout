export interface AiProvider {
  id: string;
  label: string;
  keyLabel: string;
  keyPlaceholder: string;
  docsUrl: string;
  freeTier: boolean;
  requiresKey: boolean;
  defaultModel: string;
  models: string[];
  /** Provider exposes a live model list we can fetch with the user's key. */
  discoverModels?: boolean;
  note?: string;
}

// Registry of BYOK-friendly providers the AI Insights panel supports.
// Adding a new OpenAI-compatible provider is a one-line addition below +
// a `case` in `ai-client.ts` if it needs a custom endpoint.
export const AI_PROVIDERS: AiProvider[] = [
  {
    id: "google",
    label: "Google AI Studio (Gemini)",
    keyLabel: "Google AI Studio API Key",
    keyPlaceholder: "AIza...",
    docsUrl: "https://aistudio.google.com/apikey",
    freeTier: true,
    requiresKey: true,
    // Floating aliases always resolve to a model that is still open to new keys.
    defaultModel: "gemini-flash-latest",
    models: [
      "gemini-flash-latest",
      "gemini-flash-lite-latest",
      "gemini-pro-latest",
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
    ],
    discoverModels: true,
    note:
      "Free tier at aistudio.google.com/apikey. Older pinned models (e.g. gemini-2.5-flash) are closed to new keys — use the *-latest aliases or click Refresh models to load exactly what your key can access.",
  },
  {
    id: "groq",
    label: "Groq (free tier, very fast)",
    keyLabel: "Groq API Key",
    keyPlaceholder: "gsk_...",
    docsUrl: "https://console.groq.com/keys",
    freeTier: true,
    requiresKey: true,
    defaultModel: "llama-3.3-70b-versatile",
    models: [
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b",
      "gemma2-9b-it",
    ],
    discoverModels: true,
    note: "Generous free tier at console.groq.com — no billing details required.",
  },
  {
    id: "openrouter",
    label: "OpenRouter (many models incl. free)",
    keyLabel: "OpenRouter API Key",
    keyPlaceholder: "sk-or-...",
    docsUrl: "https://openrouter.ai/keys",
    freeTier: true,
    requiresKey: true,
    defaultModel: "google/gemini-2.0-flash-exp:free",
    models: [
      "google/gemini-2.0-flash-exp:free",
      "meta-llama/llama-3.3-70b-instruct:free",
      "deepseek/deepseek-chat-v3.1:free",
      "qwen/qwen-2.5-72b-instruct:free",
      "google/gemini-2.5-flash",
      "anthropic/claude-3.5-sonnet",
      "openai/gpt-4o-mini",
    ],
    discoverModels: true,
    note: "Models tagged :free are usable with an OpenRouter key at no cost. Refresh models to list every free model live.",
  },
  {
    id: "cerebras",
    label: "Cerebras (free tier, fastest inference)",
    keyLabel: "Cerebras API Key",
    keyPlaceholder: "csk-...",
    docsUrl: "https://cloud.cerebras.ai/",
    freeTier: true,
    requiresKey: true,
    defaultModel: "llama-3.3-70b",
    models: ["llama-3.3-70b", "llama3.1-8b", "qwen-3-32b", "gpt-oss-120b"],
    discoverModels: true,
    note: "Free developer tier at cloud.cerebras.ai — no card needed.",
  },
  {
    id: "mistral",
    label: "Mistral AI (free tier)",
    keyLabel: "Mistral API Key",
    keyPlaceholder: "",
    docsUrl: "https://console.mistral.ai/api-keys",
    freeTier: true,
    requiresKey: true,
    defaultModel: "mistral-small-latest",
    models: ["mistral-small-latest", "mistral-large-latest", "open-mistral-nemo", "codestral-latest"],
    discoverModels: true,
    note: "Free tier at console.mistral.ai (activate the free 'Experiment' plan first).",
  },
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    keyLabel: "Anthropic API Key",
    keyPlaceholder: "sk-ant-...",
    docsUrl: "https://console.anthropic.com/settings/keys",
    freeTier: false,
    requiresKey: true,
    defaultModel: "claude-3-5-haiku-latest",
    models: [
      "claude-sonnet-4-5-20250929",
      "claude-opus-4-1-20250805",
      "claude-3-5-sonnet-latest",
      "claude-3-5-haiku-latest",
      "claude-3-haiku-20240307",
    ],
    discoverModels: true,
    note: "Paid only — Anthropic has no free tier, the key needs purchased credits in console.anthropic.com → Billing.",
  },
  {
    id: "openai",
    label: "OpenAI",
    keyLabel: "OpenAI API Key",
    keyPlaceholder: "sk-...",
    docsUrl: "https://platform.openai.com/api-keys",
    freeTier: false,
    requiresKey: true,
    defaultModel: "gpt-4o-mini",
    models: ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4.1", "gpt-4o", "o4-mini"],
    discoverModels: true,
    note:
      "Paid only — API usage is billed separately from ChatGPT Plus. A brand-new key returns 'exceeded your current quota' until you add credit in platform.openai.com → Billing. For a free option use Groq, Google AI Studio, Cerebras or OpenRouter :free models.",
  },
];

export function getProvider(id: string): AiProvider | undefined {
  return AI_PROVIDERS.find((p) => p.id === id);
}
