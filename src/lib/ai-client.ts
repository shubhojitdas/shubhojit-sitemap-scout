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
  try {
    const j = JSON.parse(text);
    return j?.error?.message || j?.error || j?.message || text || `HTTP ${res.status}`;
  } catch { return text || `HTTP ${res.status}`; }
}

// OpenAI-compatible chat completions (used by OpenAI, Groq, OpenRouter, Mistral).
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
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(args.model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
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

async function lovable(args: ChatArgs): Promise<string> {
  // Route through an edge function that holds LOVABLE_API_KEY server-side.
  const { data, error } = await supabase.functions.invoke("ai-chat", {
    body: { model: args.model, messages: args.messages, temperature: args.temperature ?? 0.7 },
  });
  if (error) throw new AiError(error.message || "AI request failed");
  if ((data as any)?.error) throw new AiError((data as any).error);
  return (data as any)?.content ?? "";
}

export async function chat(args: ChatArgs): Promise<string> {
  switch (args.providerId) {
    case "lovable":
      return lovable(args);
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
