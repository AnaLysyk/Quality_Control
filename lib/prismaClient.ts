import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getPrismaClientOptions, resetPrismaAdapter } from "@/lib/prismaClientOptions";

// Singleton pattern: reutiliza a instância entre hot-reloads no dev
// e evita "too many connections" em produção.
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
]);

function hasDatabaseUrl() {
  return Boolean(
    process.env.DATABASE_URL ??
      process.env.POSTGRES_PRISMA_URL ??
      process.env.POSTGRES_URL,
  );
}

function getPrimaryDatabaseUrl() {
  return process.env.DATABASE_URL ?? process.env.POSTGRES_PRISMA_URL ?? process.env.POSTGRES_URL ?? null;
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

function canUsePrimaryDatabaseAsBrainFallback() {
  return process.env.NODE_ENV !== "production" || process.env.BRAIN_ALLOW_PRIMARY_DATABASE === "true";
}

function getBrainDatabaseUrl() {
  const brainDatabaseUrl = process.env.BRAIN_DATABASE_URL ?? process.env.BRAIN_RAG_DATABASE_URL;
  const primaryDatabaseUrl = getPrimaryDatabaseUrl();

  if (!brainDatabaseUrl) {
    if (primaryDatabaseUrl && canUsePrimaryDatabaseAsBrainFallback()) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[brain] BRAIN_DATABASE_URL ausente. Usando DATABASE_URL como fallback local temporario do RAG.");
      }
      return primaryDatabaseUrl;
    }

    throw new Error(
      "BRAIN_DATABASE_URL or BRAIN_RAG_DATABASE_URL is required for Brain RAG tables.",
    );
  }

  const allowPrimaryDatabase = process.env.BRAIN_ALLOW_PRIMARY_DATABASE === "true";

  if (
    primaryDatabaseUrl &&
    normalizeDatabaseUrl(primaryDatabaseUrl) === normalizeDatabaseUrl(brainDatabaseUrl) &&
    !allowPrimaryDatabase &&
    process.env.NODE_ENV === "production"
  ) {
    throw new Error(
      "Brain RAG tables must use a separate database. Set BRAIN_ALLOW_PRIMARY_DATABASE=true only for local development.",
    );
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
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") return undefined;
        throw new Error(
          "Prisma client is unavailable (no DATABASE_URL) while E2E_USE_JSON=1 is active.",
        );
      },
    },
  ) as unknown as PrismaClient;
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
      const client = typeof prop === "string" && BRAIN_DELEGATE_NAMES.has(prop)
        ? getBrainPrismaClient()
        : currentPrisma;
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

/**
 * Reconnect the Prisma client when the underlying connection is lost.
 * Call this in catch blocks that detect "Connection terminated unexpectedly".
 */
export function reconnectPrisma() {
  console.info("[prisma] Reconnecting after connection loss...");
  currentPrisma = recreatePrismaClient();
}
