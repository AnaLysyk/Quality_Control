import "server-only";

import {
  canUseFreeProvider,
  estimateBrainTokens,
  recordFreeProviderUsage,
  type FreeProvider,
} from "@/lib/brain/freeApiGuard";
import {
  getBrainProviderRuntimeConfig,
  type BrainProviderConfigView,
  type BrainProviderRuntimeConfig,
} from "@/lib/brain/providerConfig";

export type BrainModelProvider = "groq" | "gemini" | "openrouter" | "mock";

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

const DEFAULT_GROQ_MODELS = [
  "llama-3.1-8b-instant",
  "llama-3.3-70b-versatile",
  "qwen/qwen3-32b",
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
];

const DEFAULT_GEMINI_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
];

const DEFAULT_OPENROUTER_MODELS = [
  "openrouter/free",
];

const GROQ_FREE_MODELS = new Set(DEFAULT_GROQ_MODELS);

function boolEnv(name: string, fallback = false) {
  const value = String(process.env[name] ?? "").trim().toLowerCase();
  if (!value) return fallback;
  return value === "true" || value === "1" || value === "yes" || value === "sim";
}

function numberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function configuredPositiveInt(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : null;
}

function timeoutMs(config?: Pick<BrainProviderConfigView, "timeoutMs"> | null) {
  return configuredPositiveInt(config?.timeoutMs) ?? numberEnv("BRAIN_ONLINE_PROVIDER_TIMEOUT_MS", 2500);
}

function maxOutputTokens(input?: BrainModelInput, config?: Pick<BrainProviderConfigView, "maxOutputTokens"> | null) {
  const configured = configuredPositiveInt(config?.maxOutputTokens);
  const requested = input?.maxTokens ?? configured ?? numberEnv("BRAIN_MAX_OUTPUT_TOKENS", 500);
  return Math.min(requested, configured ?? 900, 900);
}

function compactText(value: unknown, max = 9000) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutValue = timeoutMs()) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutValue);

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

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function csvEnv(name: string) {
  return String(process.env[name] ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
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

function providerModels(provider: FreeProvider) {
  switch (provider) {
    case "groq":
      return unique([
        ...csvEnv("GROQ_MODELS"),
        process.env.GROQ_MODEL || "",
        ...DEFAULT_GROQ_MODELS,
      ]);
    case "gemini":
      return unique([
        ...csvEnv("GEMINI_MODELS"),
        process.env.GEMINI_MODEL || "",
        ...DEFAULT_GEMINI_MODELS,
      ]);
    case "openrouter":
      return unique([
        ...csvEnv("OPENROUTER_MODELS"),
        process.env.OPENROUTER_MODEL || "",
        ...DEFAULT_OPENROUTER_MODELS,
      ]);
  }
}

function isFreeModelAllowed(provider: FreeProvider, model: string, strictFreeModels = boolEnv("BRAIN_STRICT_FREE_MODELS", true)) {
  if (!strictFreeModels) return true;

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
    "Brain respondeu com o template interno.",
    "",
    "Motivo: nenhuma API gratuita estava disponível agora por falta de chave, falta de cota, limite, erro ou timeout.",
    "Base usada: banco, RAG e templates internos do Quality Control.",
    "",
    "Pedido recebido:",
    compactText(lastUser, 1200),
  ].join("\n");
}

async function callGroq(input: BrainModelInput, model: string, config?: BrainProviderConfigView | null): Promise<BrainModelResult> {
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
      max_completion_tokens: maxOutputTokens(input, config),
      stream: false,
    }),
  }, timeoutMs(config));

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

async function callGemini(input: BrainModelInput, model: string, config?: BrainProviderConfigView | null): Promise<BrainModelResult> {
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
          maxOutputTokens: maxOutputTokens(input, config),
        },
      }),
    },
    timeoutMs(config),
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

async function callOpenRouter(input: BrainModelInput, model: string, config?: BrainProviderConfigView | null): Promise<BrainModelResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY ausente.");

  const safeModel = model === "openrouter/free" || model.endsWith(":free")
    ? model
    : "openrouter/free";

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
      max_tokens: maxOutputTokens(input, config),
      stream: false,
    }),
  }, timeoutMs(config));

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

async function callProvider(provider: FreeProvider, input: BrainModelInput, model: string, config?: BrainProviderConfigView | null) {
  switch (provider) {
    case "groq":
      return callGroq(input, model, config);
    case "gemini":
      return callGemini(input, model, config);
    case "openrouter":
      return callOpenRouter(input, model, config);
  }
}

async function readRuntimeConfigSafe(): Promise<BrainProviderRuntimeConfig | null> {
  try {
    return await getBrainProviderRuntimeConfig();
  } catch (error) {
    console.warn("[brain/modelProvider] provider config fallback:", error instanceof Error ? error.message : String(error));
    return null;
  }
}

function configForProvider(runtime: BrainProviderRuntimeConfig | null, provider: FreeProvider) {
  return runtime?.configs.find((config) => config.provider === provider) ?? null;
}

function providerOrder(runtime: BrainProviderRuntimeConfig | null) {
  return runtime?.order.length ? runtime.order : readProviderOrder();
}

function providerModelsFromConfig(provider: FreeProvider, config?: BrainProviderConfigView | null) {
  return config?.models?.length ? config.models : providerModels(provider);
}

export async function runBrainModel(input: BrainModelInput): Promise<BrainModelResult> {
  const onlineEnabled = boolEnv("BRAIN_ONLINE_MODEL_ENABLED", true);
  const runtimeConfig = await readRuntimeConfigSafe();
  const errors: string[] = [];

  if (onlineEnabled) {
    for (const provider of providerOrder(runtimeConfig)) {
      const providerConfig = configForProvider(runtimeConfig, provider);
      const estimatedTokens = estimateBrainTokens(input.messages, maxOutputTokens(input, providerConfig));

      if (!providerHasKey(provider)) {
        errors.push(`${provider}: chave ausente`);
        continue;
      }

      const guard = await canUseFreeProvider(provider, estimatedTokens, providerConfig ?? undefined);
      if (!guard.allowed) {
        errors.push(`${provider}: ${guard.reason}`);
        continue;
      }

      for (const model of providerModelsFromConfig(provider, providerConfig)) {
        if (!isFreeModelAllowed(provider, model, providerConfig?.strictFreeModels ?? boolEnv("BRAIN_STRICT_FREE_MODELS", true))) {
          errors.push(`${provider}: modelo bloqueado por modo grátis (${model})`);
          continue;
        }

        try {
          const result = await callProvider(provider, input, model, providerConfig);
          await recordFreeProviderUsage(provider, estimatedTokens, 200, null);
          return result;
        } catch (error) {
          const status = error instanceof ProviderHttpError ? error.status : 0;
          const retry = error instanceof ProviderHttpError ? error.retryAfterSeconds : null;
          if (status) await recordFreeProviderUsage(provider, estimatedTokens, status, retry);
          errors.push(`${provider}/${model}: ${error instanceof Error ? error.message : String(error)}`);

          if ([402, 403, 429].includes(status)) break;
        }
      }
    }
  } else {
    errors.push("modo online desativado");
  }

  if (errors.length) {
    console.warn("[brain/modelProvider] fallback:", errors.join(" | "));
  }

  return {
    provider: "mock",
    model: "brain-internal-rag-template",
    text: fallbackAnswer(input.messages),
  };
}

export type BrainBehaviorPromptProfile = {
  name: string;
  instructions: string;
  tone?: string | null;
  formality?: string | null;
  responseLength?: string | null;
};

function behaviorProfileDirectives(profile?: BrainBehaviorPromptProfile | null) {
  if (!profile) return [];

  const responseLengthHint: Record<string, string> = {
    short: "Priorize respostas curtas.",
    medium: "Mantenha respostas de tamanho medio, sem excesso de detalhe.",
    long: "Pode detalhar mais quando o contexto exigir.",
  };

  return [
    "",
    `Modo de conversa selecionado: ${profile.name}.`,
    profile.instructions,
    profile.formality ? `Nivel de formalidade: ${profile.formality}.` : "",
    profile.responseLength ? responseLengthHint[profile.responseLength] ?? "" : "",
    "Este modo de conversa ajusta tom e estilo, mas nunca substitui as regras de seguranca, permissao e escopo acima.",
  ].filter(Boolean);
}

export function buildBrainSystemPrompt(behaviorProfile?: BrainBehaviorPromptProfile | null) {
  return [
    "Você é o Brain do Quality Control.",
    "Você apoia QA, debug, automação, documentação, evidências, análise de risco, permissões, banco de dados, RAG, templates internos e APIs gratuitas configuradas.",
    "O banco de dados e o RAG são sempre a fonte principal da verdade.",
    "A API externa gratuita, quando disponível, é apenas uma camada para melhorar a conversa e organizar melhor a resposta.",
    "Use RAG e memória para contexto antes de qualquer resposta.",
    "Use apenas providers gratuitos configurados: Groq, Gemini e OpenRouter.",
    "Nunca use modelo pago.",
    "Quando uma API gratuita atingir limite, falhar ou estourar timeout, use a próxima da ordem configurada.",
    "Se não houver chave configurada, cota disponível ou resposta das APIs externas, responda com o template interno do Brain.",
    "Responda em português brasileiro.",
    "Seja direto, prático e operacional.",
    "Respeite empresa, usuário, perfil, permissão e escopo.",
    "Nunca exponha senha, token, segredo, cookie, credencial ou dado sensível.",
    "Quando uma ação alterar dados reais, peça confirmação antes.",
    ...behaviorProfileDirectives(behaviorProfile),
  ].join("\n");
}
