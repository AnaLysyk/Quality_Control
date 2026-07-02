import { PrismaClient } from "@prisma/client";
import { getPrismaClientOptions, resetPrismaAdapter } from "@/lib/prismaClientOptions";

// Singleton pattern: reutiliza a instância entre hot-reloads no dev
// e evita "too many connections" em produção.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function hasDatabaseUrl() {
  return Boolean(
    process.env.DATABASE_URL ??
      process.env.POSTGRES_PRISMA_URL ??
      process.env.POSTGRES_URL,
  );
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
      const value = Reflect.get(currentPrisma as object, prop, currentPrisma);
      return typeof value === "function" ? value.bind(currentPrisma) : value;
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

