import "server-only";

import {
  canUseFreeProvider,
  estimateBrainTokens,
  recordFreeProviderUsage,
  type FreeProvider,
} from "@/lib/brain/freeApiGuard";

export type BrainModelProvider =
  | "groq"
  | "gemini"
  | "openrouter"
  | "mock";

export type BrainModelMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type BrainModelInput = {
  messages: BrainModelMessage[];
  temperature?: number;
  maxTokens?: number;
};

type BrainModelResult = {
  provider: BrainModelProvider;
  model?: string;
  text: string;
};

class ProviderHttpError extends Error {
  status: number;
  retryAfterSeconds?: number | null;

  constructor(provider: string, status: number, retryAfterSeconds?: number | null) {
    super(`${provider} retornou ${status}`);
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds ?? null;
  }
}

const DEFAULT_GROQ_MODEL = "llama-3.1-8b-instant";
const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";
const DEFAULT_OPENROUTER_MODEL = "openrouter/free";

const GROQ_FREE_MODELS = new Set([
  "llama-3.1-8b-instant",
  "llama-3.3-70b-versatile",
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
  "qwen/qwen3-32b",
]);

function boolEnv(name: string, fallback = false) {
  const value = String(process.env[name] ?? "").trim().toLowerCase();
  if (!value) return fallback;
  return value === "true" || value === "1" || value === "yes" || value === "sim";
}

function numberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function timeoutMs() {
  return numberEnv("BRAIN_ONLINE_PROVIDER_TIMEOUT_MS", 4500);
}

function maxOutputTokens(input?: BrainModelInput) {
  return Math.min(input?.maxTokens ?? numberEnv("BRAIN_MAX_OUTPUT_TOKENS", 700), 900);
}

function compactText(value: unknown, max = 9000) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs());

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function retryAfter(response: Response) {
  const raw = response.headers.get("retry-after");
  const value = raw ? Number(raw) : NaN;
  return Number.isFinite(value) && value > 0 ? value : null;
}

function readProviderOrder(): FreeProvider[] {
  const raw = String(process.env.BRAIN_FREE_PROVIDER_ORDER ?? "groq,gemini,openrouter");
  const allowed = new Set<FreeProvider>(["groq", "gemini", "openrouter"]);

  return raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item): item is FreeProvider => allowed.has(item as FreeProvider));
}

function providerHasKey(provider: FreeProvider) {
  switch (provider) {
    case "groq":
      return Boolean(process.env.GROQ_API_KEY);
    case "gemini":
      return Boolean(process.env.GEMINI_API_KEY);
    case "openrouter":
      return Boolean(process.env.OPENROUTER_API_KEY);
  }
}

function providerModel(provider: FreeProvider) {
  switch (provider) {
    case "groq":
      return process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL;
    case "gemini":
      return process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
    case "openrouter":
      return process.env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL;
  }
}

function isFreeModelAllowed(provider: FreeProvider, model: string) {
  if (!boolEnv("BRAIN_STRICT_FREE_MODELS", true)) return true;

  if (provider === "groq") {
    return GROQ_FREE_MODELS.has(model);
  }

  if (provider === "gemini") {
    return model.startsWith("gemini-") && model.includes("flash");
  }

  if (provider === "openrouter") {
    return model === "openrouter/free" || model.endsWith(":free");
  }

  return false;
}

function toOpenAiMessages(messages: BrainModelMessage[]) {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

function fallbackAnswer(messages: BrainModelMessage[]) {
  const lastUser = [...messages].reverse().find((item) => item.role === "user")?.content ?? "";

  return [
    "Brain respondeu em modo rápido.",
    "",
    "Não usei API paga. As APIs grátis configuradas não tinham chave, estavam bloqueadas por limite ou não responderam a tempo.",
    "Base usada: banco/RAG/templates do Quality Control.",
    "",
    "Pedido recebido:",
    compactText(lastUser, 1200),
  ].join("\n");
}

async function callGroq(input: BrainModelInput, model: string): Promise<BrainModelResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY ausente.");

  const response = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: toOpenAiMessages(input.messages),
      temperature: input.temperature ?? 0.2,
      max_completion_tokens: maxOutputTokens(input),
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new ProviderHttpError("Groq", response.status, retryAfter(response));
  }

  const payload = await response.json().catch(() => null) as {
    choices?: Array<{ message?: { content?: string } }>;
  } | null;

  const text = compactText(payload?.choices?.[0]?.message?.content ?? "");
  if (!text) throw new Error("Groq retornou vazio.");

  return { provider: "groq", model, text };
}

async function callGemini(input: BrainModelInput, model: string): Promise<BrainModelResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY ausente.");

  const systemText = input.messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");

  const contents = input.messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));

  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
        contents,
        generationConfig: {
          temperature: input.temperature ?? 0.2,
          maxOutputTokens: maxOutputTokens(input),
        },
      }),
    },
  );

  if (!response.ok) {
    throw new ProviderHttpError("Gemini", response.status, retryAfter(response));
  }

  const payload = await response.json().catch(() => null) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  } | null;

  const text = compactText(
    payload?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("\n") ?? "",
  );

  if (!text) throw new Error("Gemini retornou vazio.");

  return { provider: "gemini", model, text };
}

async function callOpenRouter(input: BrainModelInput, model: string): Promise<BrainModelResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY ausente.");

  const safeModel = model === "openrouter/free" || model.endsWith(":free")
    ? model
    : DEFAULT_OPENROUTER_MODEL;

  const response = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-OpenRouter-Title": "Quality Control Brain",
    },
    body: JSON.stringify({
      model: safeModel,
      messages: toOpenAiMessages(input.messages),
      temperature: input.temperature ?? 0.2,
      max_tokens: maxOutputTokens(input),
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new ProviderHttpError("OpenRouter", response.status, retryAfter(response));
  }

  const payload = await response.json().catch(() => null) as {
    model?: string;
    choices?: Array<{ message?: { content?: string } }>;
  } | null;

  const text = compactText(payload?.choices?.[0]?.message?.content ?? "");
  if (!text) throw new Error("OpenRouter retornou vazio.");

  return { provider: "openrouter", model: payload?.model ?? safeModel, text };
}

async function callProvider(provider: FreeProvider, input: BrainModelInput, model: string) {
  switch (provider) {
    case "groq":
      return callGroq(input, model);
    case "gemini":
      return callGemini(input, model);
    case "openrouter":
      return callOpenRouter(input, model);
  }
}

export async function runBrainModel(input: BrainModelInput): Promise<BrainModelResult> {
  const onlineEnabled = boolEnv("BRAIN_ONLINE_MODEL_ENABLED", true);
  const estimatedTokens = estimateBrainTokens(input.messages, maxOutputTokens(input));
  const errors: string[] = [];

  if (onlineEnabled) {
    for (const provider of readProviderOrder()) {
      const model = providerModel(provider);

      if (!providerHasKey(provider)) {
        errors.push(`${provider}: chave ausente`);
        continue;
      }

      if (!isFreeModelAllowed(provider, model)) {
        errors.push(`${provider}: modelo bloqueado por modo grátis (${model})`);
        continue;
      }

      const guard = await canUseFreeProvider(provider, estimatedTokens);
      if (!guard.allowed) {
        errors.push(`${provider}: ${guard.reason}`);
        continue;
      }

      try {
        const result = await callProvider(provider, input, model);
        await recordFreeProviderUsage(provider, estimatedTokens, 200, null);
        return result;
      } catch (error) {
        const status = error instanceof ProviderHttpError ? error.status : 0;
        const retry = error instanceof ProviderHttpError ? error.retryAfterSeconds : null;
        if (status) await recordFreeProviderUsage(provider, estimatedTokens, status, retry);
        errors.push(`${provider}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  if (errors.length) {
    console.warn("[brain/modelProvider] fallback:", errors.join(" | "));
  }

  return {
    provider: "mock",
    model: "brain-fast-template",
    text: fallbackAnswer(input.messages),
  };
}

export function buildBrainSystemPrompt() {
  return [
    "Você é o Brain do Quality Control.",
    "Você apoia QA, debug, automação, documentação, evidências, análise de risco, permissões, banco de dados, RAG e web.",
    "O banco de dados é sempre a fonte principal da verdade.",
    "Use RAG e memória para contexto.",
    "Use apenas providers grátis configurados.",
    "Nunca use modelo pago.",
    "Se APIs externas falharem, responda com o template interno do Brain.",
    "Responda em português brasileiro.",
    "Seja direto, prático e operacional.",
    "Respeite empresa, usuário, perfil, permissão e escopo.",
    "Nunca exponha senha, token, segredo, cookie, credencial ou dado sensível.",
    "Quando uma ação alterar dados reais, peça confirmação antes.",
  ].join("\n");
}
