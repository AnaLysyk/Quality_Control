import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getPrismaClientOptions, resetPrismaAdapter } from "@/database/prismaClientOptions";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  brainPrisma?: PrismaClient;
  brainPrismaAdapter?: PrismaPg;
};

const BRAIN_DELEGATE_NAMES = new Set([
  "brainNode",
  "brainEdge",
  "brainMemory",
  "brainAuditLog",
  "brainSuggestion",
  "brainInboxItem",
  "brainWorkspace",
  "brainWorkspaceNode",
  "brainWorkspaceEdge",
  "brainSavedView",
  "brainRetentionPolicy",
  "brainProviderConfig",
  "brainSourceConfig",
  "brainSourceSecret",
  "brainSourceAuditLog",
  "brainSourceSyncLog",
]);

function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL ?? process.env.POSTGRES_PRISMA_URL ?? process.env.POSTGRES_URL);
}

function getPrimaryDatabaseUrl() {
  return process.env.DATABASE_URL ?? process.env.POSTGRES_PRISMA_URL ?? process.env.POSTGRES_URL ?? null;
}

function getConfiguredBrainDatabaseUrl() {
  const brainDatabaseUrl = process.env.BRAIN_DATABASE_URL?.trim() || null;
  const legacyRagDatabaseUrl = process.env.BRAIN_RAG_DATABASE_URL?.trim() || null;

  if (
    brainDatabaseUrl &&
    legacyRagDatabaseUrl &&
    normalizeDatabaseUrl(brainDatabaseUrl) !== normalizeDatabaseUrl(legacyRagDatabaseUrl)
  ) {
    throw new Error("BRAIN_DATABASE_URL and BRAIN_RAG_DATABASE_URL point to different databases. Use BRAIN_DATABASE_URL as the canonical Brain/RAG database URL.");
  }

  if (!brainDatabaseUrl && legacyRagDatabaseUrl && process.env.NODE_ENV !== "production") {
    console.warn("[brain] BRAIN_RAG_DATABASE_URL is deprecated. Prefer BRAIN_DATABASE_URL for the Brain/RAG database.");
  }

  return brainDatabaseUrl ?? legacyRagDatabaseUrl;
}

function normalizeDatabaseUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  try {
    const parsed = new URL(trimmed);
    parsed.searchParams.sort?.();
    return parsed.toString();
  } catch {
    return trimmed;
  }
}

function deploymentEnvironment() {
  return (
    process.env.BRAIN_ENV ??
    process.env.APP_ENV ??
    process.env.NEXT_PUBLIC_APP_ENV ??
    process.env.VERCEL_ENV ??
    process.env.NODE_ENV ??
    "development"
  ).trim().toLowerCase();
}

function isLocalDevelopmentEnvironment() {
  const env = deploymentEnvironment();
  if (["production", "prod", "homolog", "homologacao", "homologation", "staging", "stage", "preview"].includes(env)) {
    return false;
  }
  if (process.env.RENDER_SERVICE_ID || process.env.RENDER_EXTERNAL_HOSTNAME || process.env.VERCEL) return false;
  return ["development", "dev", "local", "test"].includes(env);
}

function canUsePrimaryDatabaseAsBrainFallback() {
  return isLocalDevelopmentEnvironment() && process.env.BRAIN_ALLOW_PRIMARY_DATABASE !== "false";
}

function getBrainDatabaseUrl() {
  const brainDatabaseUrl = getConfiguredBrainDatabaseUrl();
  const primaryDatabaseUrl = getPrimaryDatabaseUrl();
  const isLocalEnvironment = isLocalDevelopmentEnvironment();

  if (!brainDatabaseUrl) {
    if (primaryDatabaseUrl && canUsePrimaryDatabaseAsBrainFallback()) {
      console.warn("[brain] BRAIN_DATABASE_URL ausente. Usando DATABASE_URL como fallback apenas em dev/local.");
      return primaryDatabaseUrl;
    }

    throw new Error("BRAIN_DATABASE_URL is required for Brain/RAG tables outside local development. Set BRAIN_DATABASE_URL or explicitly enable local fallback.");
  }

  const usesPrimaryDatabase =
    primaryDatabaseUrl &&
    normalizeDatabaseUrl(primaryDatabaseUrl) === normalizeDatabaseUrl(brainDatabaseUrl);

  if (usesPrimaryDatabase) {
    if (!isLocalEnvironment) {
      throw new Error("Brain/RAG database cannot equal DATABASE_URL outside local development.");
    }
    if (process.env.BRAIN_ALLOW_PRIMARY_DATABASE === "false") {
      throw new Error("Brain/RAG database cannot use DATABASE_URL when BRAIN_ALLOW_PRIMARY_DATABASE=false.");
    }
    if (process.env.BRAIN_ALLOW_PRIMARY_DATABASE !== "true") {
      throw new Error("Explicit BRAIN_DATABASE_URL cannot equal DATABASE_URL unless BRAIN_ALLOW_PRIMARY_DATABASE=true.");
    }
  }

  return brainDatabaseUrl;
}

function getBrainPrismaClient() {
  let adapter = globalForPrisma.brainPrismaAdapter;
  if (!adapter) {
    adapter = new PrismaPg(getBrainDatabaseUrl());
    globalForPrisma.brainPrismaAdapter = adapter;
  }

  if (!globalForPrisma.brainPrisma) {
    globalForPrisma.brainPrisma = new PrismaClient({ adapter });
  }

  return globalForPrisma.brainPrisma;
}

function isPrismaOptionalMode() {
  return process.env.E2E_USE_JSON === "1";
}

function createUnavailablePrismaClient(): PrismaClient {
  return new Proxy({}, {
    get(_target, prop) {
      if (prop === "then") return undefined;
      throw new Error("Prisma client is unavailable (no DATABASE_URL) while E2E_USE_JSON=1 is active.");
    },
  }) as unknown as PrismaClient;
}

function createPrismaClient() {
  return new PrismaClient(getPrismaClientOptions());
}

function recreatePrismaClient() {
  resetPrismaAdapter();
  const client = createPrismaClient();
  globalForPrisma.prisma = client;
  return client;
}

let currentPrisma: PrismaClient =
  globalForPrisma.prisma ??
  (hasDatabaseUrl()
    ? createPrismaClient()
    : isPrismaOptionalMode()
      ? createUnavailablePrismaClient()
      : createPrismaClient());

function createPrismaClientProxy(): PrismaClient {
  return new Proxy({} as PrismaClient, {
    get(_target, prop) {
      const client = typeof prop === "string" && BRAIN_DELEGATE_NAMES.has(prop) ? getBrainPrismaClient() : currentPrisma;
      const value = Reflect.get(client as object, prop, client);
      return typeof value === "function" ? value.bind(client) : value;
    },
    set(_target, prop, value) {
      return Reflect.set(currentPrisma as object, prop, value, currentPrisma);
    },
  });
}

export const prisma: PrismaClient = createPrismaClientProxy();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = currentPrisma;
}

export function reconnectPrisma() {
  console.info("[prisma] Reconnecting after connection loss...");
  currentPrisma = recreatePrismaClient();
}
