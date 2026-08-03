// Unified BYOK AI chat client. All keys stay client-side.

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatArgs {
  providerId: string;
  apiKey?: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  signal?: AbortSignal;
}

class AiError extends Error {
  status?: number;
  constructor(msg: string, status?: number) { super(msg); this.status = status; }
}

async function readErr(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  let raw = text || `HTTP ${res.status}`;
  try {
    const j = JSON.parse(text);
    raw = j?.error?.message || j?.error?.metadata?.raw || j?.error || j?.message || raw;
    if (typeof raw !== "string") raw = JSON.stringify(raw);
  } catch { /* keep text */ }
  return friendlyError(raw, res.status);
}

// Turn opaque provider errors into guidance the user can act on.
function friendlyError(msg: string, status?: number): string {
  const m = msg.toLowerCase();
  if (m.includes("no longer available") || m.includes("is not found") || m.includes("not found for api version")) {
    return `${msg}\n\nTip: click “Refresh models” to load the models your key can actually use, or pick one of the *-latest aliases.`;
  }
  if (status === 429 && (m.includes("quota") || m.includes("insufficient_quota") || m.includes("billing"))) {
    return `${msg}\n\nTip: this provider has no usable free credit on your key. OpenAI/Anthropic API access is billed separately from ChatGPT/Claude subscriptions — add credit, or switch to a free-tier provider (Groq, Google AI Studio, Cerebras, or an OpenRouter “:free” model).`;
  }
  if (status === 429) {
    return `${msg}\n\nTip: rate limit hit — wait a moment and retry, or switch to a smaller/faster model.`;
  }
  if (status === 401 || status === 403) {
    return `${msg}\n\nTip: the API key was rejected. Re-copy it from the provider console and make sure it belongs to the selected provider.`;
  }
  return msg;
}

// OpenAI-compatible chat completions (OpenAI, Groq, OpenRouter, Mistral, Cerebras).
async function openaiCompat(
  baseUrl: string, apiKey: string, args: ChatArgs, extraHeaders: Record<string, string> = {},
): Promise<string> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    signal: args.signal,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify({
      model: args.model,
      messages: args.messages,
      temperature: args.temperature ?? 0.7,
    }),
  });
  if (!res.ok) throw new AiError(await readErr(res), res.status);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

async function googleGemini(apiKey: string, args: ChatArgs): Promise<string> {
  const systemMsgs = args.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
  const contents = args.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  const body: any = { contents, generationConfig: { temperature: args.temperature ?? 0.7 } };
  if (systemMsgs) body.systemInstruction = { parts: [{ text: systemMsgs }] };
  const model = args.model.replace(/^models\//, "");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST", signal: args.signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new AiError(await readErr(res), res.status);
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join("\n") ?? "";
}

async function anthropic(apiKey: string, args: ChatArgs): Promise<string> {
  const system = args.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n") || undefined;
  const msgs = args.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", signal: args.signal,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: args.model,
      max_tokens: 2048,
      temperature: args.temperature ?? 0.7,
      ...(system ? { system } : {}),
      messages: msgs,
    }),
  });
  if (!res.ok) throw new AiError(await readErr(res), res.status);
  const data = await res.json();
  return (data?.content ?? []).map((c: any) => c?.text).filter(Boolean).join("\n");
}

export async function chat(args: ChatArgs): Promise<string> {
  switch (args.providerId) {
    case "google":
      if (!args.apiKey) throw new AiError("Missing Google AI Studio API key");
      return googleGemini(args.apiKey, args);
    case "anthropic":
      if (!args.apiKey) throw new AiError("Missing Anthropic API key");
      return anthropic(args.apiKey, args);
    case "openai":
      if (!args.apiKey) throw new AiError("Missing OpenAI API key");
      return openaiCompat("https://api.openai.com/v1", args.apiKey, args);
    case "groq":
      if (!args.apiKey) throw new AiError("Missing Groq API key");
      return openaiCompat("https://api.groq.com/openai/v1", args.apiKey, args);
    case "cerebras":
      if (!args.apiKey) throw new AiError("Missing Cerebras API key");
      return openaiCompat("https://api.cerebras.ai/v1", args.apiKey, args);
    case "openrouter":
      if (!args.apiKey) throw new AiError("Missing OpenRouter API key");
      return openaiCompat("https://openrouter.ai/api/v1", args.apiKey, args, {
        "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "",
        "X-Title": "Sitemap Scout",
      });
    case "mistral":
      if (!args.apiKey) throw new AiError("Missing Mistral API key");
      return openaiCompat("https://api.mistral.ai/v1", args.apiKey, args);
    default:
      throw new AiError(`Unknown provider: ${args.providerId}`);
  }
}

// ---- Live model discovery, so a key only ever sees models it can actually call ----

async function listOpenaiCompat(
  baseUrl: string, apiKey: string, extraHeaders: Record<string, string> = {},
): Promise<string[]> {
  const res = await fetch(`${baseUrl}/models`, {
    headers: { "Authorization": `Bearer ${apiKey}`, ...extraHeaders },
  });
  if (!res.ok) throw new AiError(await readErr(res), res.status);
  const data = await res.json();
  return (data?.data ?? []).map((m: any) => m?.id).filter(Boolean);
}

export async function listModels(providerId: string, apiKey: string): Promise<string[]> {
  if (!apiKey) throw new AiError("Add your API key first");
  switch (providerId) {
    case "google": {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${encodeURIComponent(apiKey)}`,
      );
      if (!res.ok) throw new AiError(await readErr(res), res.status);
      const data = await res.json();
      return (data?.models ?? [])
        .filter((m: any) => (m?.supportedGenerationMethods ?? []).includes("generateContent"))
        .map((m: any) => String(m?.name ?? "").replace(/^models\//, ""))
        .filter((id: string) => id && !id.includes("embedding") && !id.includes("aqa"))
        .sort();
    }
    case "openai":
      return (await listOpenaiCompat("https://api.openai.com/v1", apiKey))
        .filter((id) => /^(gpt|o\d)/.test(id) && !/(audio|realtime|image|tts|whisper|embedding|moderation)/.test(id))
        .sort();
    case "groq":
      return (await listOpenaiCompat("https://api.groq.com/openai/v1", apiKey))
        .filter((id) => !/(whisper|tts|guard)/i.test(id))
        .sort();
    case "cerebras":
      return (await listOpenaiCompat("https://api.cerebras.ai/v1", apiKey)).sort();
    case "mistral":
      return (await listOpenaiCompat("https://api.mistral.ai/v1", apiKey))
        .filter((id) => !/(embed|ocr|moderation)/i.test(id))
        .sort();
    case "openrouter": {
      const ids = await listOpenaiCompat("https://openrouter.ai/api/v1", apiKey);
      const free = ids.filter((id) => id.endsWith(":free")).sort();
      const paid = ids.filter((id) => !id.endsWith(":free")).sort();
      return [...free, ...paid];
    }
    case "anthropic": {
      const res = await fetch("https://api.anthropic.com/v1/models?limit=100", {
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
      });
      if (!res.ok) throw new AiError(await readErr(res), res.status);
      const data = await res.json();
      return (data?.data ?? []).map((m: any) => m?.id).filter(Boolean);
    }
    default:
      throw new AiError("Model discovery is not supported for this provider");
  }
}
