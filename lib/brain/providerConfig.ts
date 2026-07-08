import "server-only";

import type { BrainAccessContext } from "@/lib/brain/access";
import type { FreeProvider } from "@/lib/brain/freeApiGuard";
import { canAccess } from "@/lib/permissions/can-access";
import { prisma } from "@/lib/prismaClient";

type JsonRecord = Record<string, unknown>;

type BrainProviderConfigRow = {
  id?: string;
  provider: string;
  enabled?: boolean;
  model?: string | null;
  models?: unknown;
  priority?: number;
  dailyRequestLimit?: number | null;
  dailyTokenLimit?: number | null;
  strictFreeModels?: boolean;
  timeoutMs?: number | null;
  maxOutputTokens?: number | null;
  metadata?: unknown;
  updatedBy?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

type ModelDelegate = {
  findMany?: (args?: JsonRecord) => Promise<unknown[]>;
  upsert?: (args: JsonRecord) => Promise<unknown>;
};

export const BRAIN_PROVIDER_IDS = ["groq", "gemini", "openrouter"] as const;
export type BrainOnlineProvider = typeof BRAIN_PROVIDER_IDS[number];

export type BrainProviderLimits = {
  dailyRequestLimit: number | null;
  dailyTokenLimit: number | null;
  strictFreeModels: boolean;
  timeoutMs: number | null;
  maxOutputTokens: number | null;
};

export type BrainProviderConfigView = BrainProviderLimits & {
  provider: BrainOnlineProvider;
  enabled: boolean;
  model: string | null;
  models: string[];
  priority: number;
  metadata?: unknown;
  updatedBy?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type BrainProviderRuntimeConfig = {
  configs: BrainProviderConfigView[];
  order: FreeProvider[];
  keyStatus: BrainProviderKeyStatus;
};

export type BrainProviderKeyStatus = Record<BrainOnlineProvider, { configured: boolean }>;

export const DEFAULT_GROQ_MODELS = [
  "llama-3.1-8b-instant",
  "llama-3.3-70b-versatile",
  "qwen/qwen3-32b",
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
];

export const DEFAULT_GEMINI_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
];

export const DEFAULT_OPENROUTER_MODELS = [
  "openrouter/free",
];

const DEFAULT_PROVIDER_ORDER: FreeProvider[] = ["groq", "gemini", "openrouter"];
const PROVIDER_SET = new Set<string>(BRAIN_PROVIDER_IDS);
const SENSITIVE_PAYLOAD_MESSAGE = "Tokens devem ser configurados apenas no ambiente seguro do servidor.";
const SENSITIVE_FIELD_NAMES = new Set([
  "apikey",
  "token",
  "secret",
  "password",
  "credential",
  "key",
]);

export class BrainProviderConfigStorageUnavailableError extends Error {
  constructor(message = "As tabelas de configuracao dos providers do Brain ainda nao existem. Aplique a migration brain_provider_config.") {
    super(message);
    this.name = "BrainProviderConfigStorageUnavailableError";
  }
}

export class BrainProviderSensitivePayloadError extends Error {
  constructor() {
    super(SENSITIVE_PAYLOAD_MESSAGE);
    this.name = "BrainProviderSensitivePayloadError";
  }
}

function getDelegate(): ModelDelegate {
  const db = prisma as unknown as Record<string, ModelDelegate | undefined>;
  const delegate = db.brainProviderConfig;
  if (!delegate?.findMany || !delegate?.upsert) {
    throw new BrainProviderConfigStorageUnavailableError();
  }
  return delegate;
}

export function isBrainProviderConfigStorageUnavailable(error: unknown) {
  if (error instanceof BrainProviderConfigStorageUnavailableError) return true;
  const record = error as { code?: string; message?: string };
  return (
    record?.code === "P2021" ||
    record?.code === "P2022" ||
    /brain_provider_configs|does not exist|tabela|relation .* does not exist/i.test(record?.message ?? "")
  );
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function boolEnv(name: string, fallback = false) {
  const value = String(process.env[name] ?? "").trim().toLowerCase();
  if (!value) return fallback;
  return value === "true" || value === "1" || value === "yes" || value === "sim";
}

function numberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? Math.round(value) : fallback;
}

function positiveNumberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
}

function optionalInt(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : null;
}

function priorityValue(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : fallback;
}

function boolValue(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "sim"].includes(normalized)) return true;
    if (["false", "0", "no", "nao", "não"].includes(normalized)) return false;
  }
  return fallback;
}

function compactDate(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" ? value : null;
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

function asModelList(value: unknown) {
  if (Array.isArray(value)) {
    return unique(value.map((item) => String(item ?? "")));
  }

  const text = asString(value);
  return text ? unique(text.split(",")) : [];
}

function providerPrefix(provider: BrainOnlineProvider) {
  return provider.toUpperCase();
}

function normalizeProvider(value: unknown): BrainOnlineProvider | null {
  const provider = asString(value)?.toLowerCase();
  return provider && PROVIDER_SET.has(provider) ? provider as BrainOnlineProvider : null;
}

function defaultModels(provider: BrainOnlineProvider) {
  switch (provider) {
    case "groq":
      return DEFAULT_GROQ_MODELS;
    case "gemini":
      return DEFAULT_GEMINI_MODELS;
    case "openrouter":
      return DEFAULT_OPENROUTER_MODELS;
  }
}

function envProviderModels(provider: BrainOnlineProvider) {
  const prefix = providerPrefix(provider);
  return unique([
    ...csvEnv(`${prefix}_MODELS`),
    process.env[`${prefix}_MODEL`] || "",
    ...defaultModels(provider),
  ]);
}

function envProviderOrder() {
  const raw = String(process.env.BRAIN_FREE_PROVIDER_ORDER ?? DEFAULT_PROVIDER_ORDER.join(","));
  const order = unique(raw.split(",").map((item) => item.toLowerCase()));
  return order.filter((item): item is FreeProvider => PROVIDER_SET.has(item));
}

function envPriority(provider: BrainOnlineProvider) {
  const order = envProviderOrder();
  const index = order.indexOf(provider);
  if (index >= 0) return index + 1;
  return 100 + DEFAULT_PROVIDER_ORDER.indexOf(provider);
}

function envRequestLimit(provider: BrainOnlineProvider) {
  const fallback = provider === "groq" ? 700 : provider === "gemini" ? 80 : 40;
  return numberEnv(`BRAIN_FREE_DAILY_REQUEST_LIMIT_${providerPrefix(provider)}`, fallback);
}

function envTokenLimit(provider: BrainOnlineProvider) {
  const fallback = provider === "groq" ? 120000 : provider === "gemini" ? 60000 : 30000;
  return numberEnv(`BRAIN_FREE_DAILY_TOKEN_LIMIT_${providerPrefix(provider)}`, fallback);
}

function envConfig(provider: BrainOnlineProvider): BrainProviderConfigView {
  const models = envProviderModels(provider);
  const explicitModel = asString(process.env[`${providerPrefix(provider)}_MODEL`]);
  const envOrder = envProviderOrder();
  const hasExplicitOrder = process.env.BRAIN_FREE_PROVIDER_ORDER !== undefined;

  return {
    provider,
    enabled: !hasExplicitOrder || envOrder.includes(provider),
    model: explicitModel ?? models[0] ?? null,
    models,
    priority: envPriority(provider),
    dailyRequestLimit: envRequestLimit(provider),
    dailyTokenLimit: envTokenLimit(provider),
    strictFreeModels: boolEnv("BRAIN_STRICT_FREE_MODELS", true),
    timeoutMs: positiveNumberEnv("BRAIN_ONLINE_PROVIDER_TIMEOUT_MS", 2500),
    maxOutputTokens: positiveNumberEnv("BRAIN_MAX_OUTPUT_TOKENS", 500),
    metadata: null,
    updatedBy: null,
    createdAt: null,
    updatedAt: null,
  };
}

function normalizeRow(row: BrainProviderConfigRow | null | undefined, fallback: BrainProviderConfigView): BrainProviderConfigView {
  if (!row) return fallback;

  const rowModels = unique([
    asString(row.model) ?? "",
    ...asModelList(row.models),
  ]);
  const models = rowModels.length ? rowModels : fallback.models;

  return {
    provider: fallback.provider,
    enabled: boolValue(row.enabled, fallback.enabled),
    model: asString(row.model) ?? models[0] ?? fallback.model,
    models,
    priority: priorityValue(row.priority, fallback.priority),
    dailyRequestLimit: optionalInt(row.dailyRequestLimit) ?? fallback.dailyRequestLimit,
    dailyTokenLimit: optionalInt(row.dailyTokenLimit) ?? fallback.dailyTokenLimit,
    strictFreeModels: boolValue(row.strictFreeModels, fallback.strictFreeModels),
    timeoutMs: optionalInt(row.timeoutMs) ?? fallback.timeoutMs,
    maxOutputTokens: optionalInt(row.maxOutputTokens) ?? fallback.maxOutputTokens,
    metadata: row.metadata ?? null,
    updatedBy: row.updatedBy ?? null,
    createdAt: compactDate(row.createdAt),
    updatedAt: compactDate(row.updatedAt),
  };
}

async function readSavedRows() {
  const delegate = getDelegate();
  const rows = await delegate.findMany?.({
    orderBy: [{ priority: "asc" }, { provider: "asc" }],
  }) ?? [];
  return rows as BrainProviderConfigRow[];
}

function fallbackConfigs() {
  return BRAIN_PROVIDER_IDS
    .map((provider) => envConfig(provider))
    .sort(compareProviderConfigs);
}

function compareProviderConfigs(left: Pick<BrainProviderConfigView, "priority" | "provider">, right: Pick<BrainProviderConfigView, "priority" | "provider">) {
  if (left.priority !== right.priority) return left.priority - right.priority;
  return DEFAULT_PROVIDER_ORDER.indexOf(left.provider) - DEFAULT_PROVIDER_ORDER.indexOf(right.provider);
}

export async function readBrainProviderConfigs(): Promise<BrainProviderConfigView[]> {
  let rows: BrainProviderConfigRow[] = [];

  try {
    rows = await readSavedRows();
  } catch (error) {
    if (!isBrainProviderConfigStorageUnavailable(error)) throw error;
    return fallbackConfigs();
  }

  const byProvider = new Map<BrainOnlineProvider, BrainProviderConfigRow>();
  for (const row of rows) {
    const provider = normalizeProvider(row.provider);
    if (provider) byProvider.set(provider, row);
  }

  return BRAIN_PROVIDER_IDS
    .map((provider) => normalizeRow(byProvider.get(provider), envConfig(provider)))
    .sort(compareProviderConfigs);
}

export async function getBrainProviderRuntimeConfig(): Promise<BrainProviderRuntimeConfig> {
  const configs = await readBrainProviderConfigs();
  return {
    configs,
    order: configs
      .filter((config) => config.enabled)
      .sort(compareProviderConfigs)
      .map((config) => config.provider),
    keyStatus: getBrainProviderKeyStatus(),
  };
}

export async function resolveBrainProviderOrder() {
  return (await getBrainProviderRuntimeConfig()).order;
}

export async function resolveBrainProviderModels(provider: FreeProvider) {
  const runtime = await getBrainProviderRuntimeConfig();
  return runtime.configs.find((config) => config.provider === provider)?.models ?? envProviderModels(provider);
}

export async function resolveBrainProviderLimits(provider: FreeProvider): Promise<BrainProviderLimits> {
  const runtime = await getBrainProviderRuntimeConfig();
  const config = runtime.configs.find((item) => item.provider === provider) ?? envConfig(provider);
  return {
    dailyRequestLimit: config.dailyRequestLimit,
    dailyTokenLimit: config.dailyTokenLimit,
    strictFreeModels: config.strictFreeModels,
    timeoutMs: config.timeoutMs,
    maxOutputTokens: config.maxOutputTokens,
  };
}

export function getBrainProviderKeyStatus(): BrainProviderKeyStatus {
  return {
    groq: { configured: Boolean(process.env.GROQ_API_KEY) },
    gemini: { configured: Boolean(process.env.GEMINI_API_KEY) },
    openrouter: { configured: Boolean(process.env.OPENROUTER_API_KEY) },
  };
}

export function canManageBrainProviderConfig(access: BrainAccessContext) {
  return (
    access.hasGlobalVisibility ||
    canAccess(access.userAccess, { moduleId: "brain", action: "configure_sources" }) ||
    canAccess(access.userAccess, { moduleId: "brain", action: "admin" })
  );
}

function actorId(access: BrainAccessContext) {
  return access.user.id ?? access.user.email ?? null;
}

function normalizeFieldName(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isSensitivePayloadField(key: string) {
  const normalized = normalizeFieldName(key);
  return (
    SENSITIVE_FIELD_NAMES.has(normalized) ||
    normalized.endsWith("apikey") ||
    normalized.endsWith("token") ||
    normalized.endsWith("secret") ||
    normalized.endsWith("password") ||
    normalized.endsWith("credential") ||
    normalized.endsWith("key")
  );
}

export function assertNoSensitiveProviderConfigPayload(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) assertNoSensitiveProviderConfigPayload(item);
    return;
  }

  if (!value || typeof value !== "object") return;

  for (const [key, item] of Object.entries(value as JsonRecord)) {
    if (isSensitivePayloadField(key)) throw new BrainProviderSensitivePayloadError();
    assertNoSensitiveProviderConfigPayload(item);
  }
}

function own(input: JsonRecord, key: string) {
  return Object.prototype.hasOwnProperty.call(input, key);
}

function collectPatchItems(body: unknown) {
  const input = asRecord(body);
  if (Array.isArray(input.configs)) return input.configs.map(asRecord);
  if (normalizeProvider(input.provider)) return [input];
  return [];
}

function dataFromPatch(item: JsonRecord, access: BrainAccessContext) {
  const data: JsonRecord = {
    updatedBy: actorId(access),
  };

  if (own(item, "enabled")) data.enabled = boolValue(item.enabled, true);
  if (own(item, "model")) data.model = asString(item.model);
  if (own(item, "models")) data.models = asModelList(item.models);
  if (own(item, "priority")) data.priority = priorityValue(item.priority, 100);
  if (own(item, "dailyRequestLimit")) data.dailyRequestLimit = optionalInt(item.dailyRequestLimit);
  if (own(item, "dailyTokenLimit")) data.dailyTokenLimit = optionalInt(item.dailyTokenLimit);
  if (own(item, "strictFreeModels")) data.strictFreeModels = boolValue(item.strictFreeModels, true);
  if (own(item, "timeoutMs")) data.timeoutMs = optionalInt(item.timeoutMs);
  if (own(item, "maxOutputTokens")) data.maxOutputTokens = optionalInt(item.maxOutputTokens);

  return data;
}

export async function updateBrainProviderConfigs(access: BrainAccessContext, body: unknown) {
  if (!canManageBrainProviderConfig(access)) {
    throw new Error("Sem permissao para configurar providers do Brain");
  }

  assertNoSensitiveProviderConfigPayload(body);
  const items = collectPatchItems(body);
  if (!items.length) {
    throw new Error("Informe configs com provider groq, gemini ou openrouter.");
  }

  const delegate = getDelegate();
  for (const item of items) {
    const provider = normalizeProvider(item.provider);
    if (!provider) {
      throw new Error("Provider invalido. Use groq, gemini ou openrouter.");
    }

    const data = dataFromPatch(item, access);
    await delegate.upsert?.({
      where: { provider },
      update: data,
      create: {
        provider,
        ...data,
      },
    });
  }

  return getBrainProviderRuntimeConfig();
}

export function serializeBrainProviderConfig(config: BrainProviderConfigView) {
  return {
    provider: config.provider,
    enabled: config.enabled,
    model: config.model,
    models: config.models,
    priority: config.priority,
    dailyRequestLimit: config.dailyRequestLimit,
    dailyTokenLimit: config.dailyTokenLimit,
    strictFreeModels: config.strictFreeModels,
    timeoutMs: config.timeoutMs,
    maxOutputTokens: config.maxOutputTokens,
  };
}

export async function getBrainProviderConfigAdminPayload() {
  const runtime = await getBrainProviderRuntimeConfig();
  return {
    configs: runtime.configs.map(serializeBrainProviderConfig),
    keyStatus: runtime.keyStatus,
  };
}
