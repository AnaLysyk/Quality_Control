import "server-only";

import { promises as fs } from "fs";
import path from "path";

export type FreeProvider = "groq" | "gemini" | "openrouter";

type ProviderUsage = {
  date: string;
  requests: number;
  estimatedTokens: number;
  blockedUntil?: number | null;
  lastStatus?: number | null;
};

type UsageFile = Partial<Record<FreeProvider, ProviderUsage>>;

const USAGE_FILE = path.join(process.cwd(), ".next", "cache", "brain-free-api-usage.json");

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function numberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function providerPrefix(provider: FreeProvider) {
  return provider.toUpperCase();
}

function requestLimit(provider: FreeProvider) {
  return numberEnv(`BRAIN_FREE_DAILY_REQUEST_LIMIT_${providerPrefix(provider)}`, provider === "groq" ? 700 : provider === "gemini" ? 80 : 40);
}

function tokenLimit(provider: FreeProvider) {
  return numberEnv(`BRAIN_FREE_DAILY_TOKEN_LIMIT_${providerPrefix(provider)}`, provider === "groq" ? 120000 : provider === "gemini" ? 60000 : 30000);
}

async function readUsage(): Promise<UsageFile> {
  try {
    const raw = await fs.readFile(USAGE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed as UsageFile : {};
  } catch {
    return {};
  }
}

async function writeUsage(usage: UsageFile) {
  await fs.mkdir(path.dirname(USAGE_FILE), { recursive: true });
  await fs.writeFile(USAGE_FILE, JSON.stringify(usage, null, 2), "utf8");
}

function normalizeBucket(bucket?: ProviderUsage): ProviderUsage {
  const today = todayKey();
  if (!bucket || bucket.date !== today) {
    return {
      date: today,
      requests: 0,
      estimatedTokens: 0,
      blockedUntil: null,
      lastStatus: null,
    };
  }
  return bucket;
}

export function estimateBrainTokens(messages: Array<{ content: string }>, maxOutputTokens: number) {
  const inputChars = messages.reduce((sum, message) => sum + String(message.content ?? "").length, 0);
  const inputTokens = Math.ceil(inputChars / 4);
  return inputTokens + maxOutputTokens;
}

export async function canUseFreeProvider(provider: FreeProvider, estimatedTokens: number) {
  const usage = await readUsage();
  const bucket = normalizeBucket(usage[provider]);
  const now = Date.now();

  if (bucket.blockedUntil && bucket.blockedUntil > now) {
    return {
      allowed: false,
      reason: `${provider} bloqueado temporariamente por limite/rate-limit.`,
    };
  }

  if (bucket.requests + 1 > requestLimit(provider)) {
    return {
      allowed: false,
      reason: `${provider} atingiu limite diário local de requisições grátis.`,
    };
  }

  if (bucket.estimatedTokens + estimatedTokens > tokenLimit(provider)) {
    return {
      allowed: false,
      reason: `${provider} atingiu limite diário local de tokens estimados grátis.`,
    };
  }

  return {
    allowed: true,
    reason: "ok",
  };
}

export async function recordFreeProviderUsage(provider: FreeProvider, estimatedTokens: number, status = 200, retryAfterSeconds?: number | null) {
  const usage = await readUsage();
  const bucket = normalizeBucket(usage[provider]);

  bucket.requests += 1;
  bucket.estimatedTokens += estimatedTokens;
  bucket.lastStatus = status;

  if ([402, 403, 429].includes(status)) {
    const fallbackSeconds = status === 429 ? 60 * 10 : 60 * 60 * 24;
    bucket.blockedUntil = Date.now() + 1000 * (retryAfterSeconds ?? fallbackSeconds);
  }

  usage[provider] = bucket;
  await writeUsage(usage);
}
