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
    defaultModel: "gemini-2.5-flash",
    models: [
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
      "gemini-2.5-pro",
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
      "gemini-1.5-flash",
      "gemini-1.5-pro",
    ],
    note: "Free tier available at aistudio.google.com/apikey.",
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
    note: "Paid — get a key at console.anthropic.com.",
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
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1", "o4-mini"],
    note: "Paid — get a key at platform.openai.com/api-keys.",
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
      "mixtral-8x7b-32768",
      "gemma2-9b-it",
    ],
    note: "Generous free tier at console.groq.com.",
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
    note: "Models tagged :free are usable with an OpenRouter key at no cost.",
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
    note: "Free tier at console.mistral.ai.",
  },
];

export function getProvider(id: string): AiProvider | undefined {
  return AI_PROVIDERS.find((p) => p.id === id);
}
