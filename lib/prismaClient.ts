import { PrismaClient } from "@prisma/client";
import { getPrismaClientOptions, resetPrismaAdapter } from "@/lib/prismaClientOptions";

// Singleton pattern: reutiliza a instância entre hot-reloads no dev
// e evita "too many connections" em produção.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  return new PrismaClient(getPrismaClientOptions());
}

function recreatePrismaClient() {
  resetPrismaAdapter();
  const client = createPrismaClient();
  globalForPrisma.prisma = client;
  return client;
}

export let prisma: PrismaClient =
  globalForPrisma.prisma ??
  createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Reconnect the Prisma client when the underlying connection is lost.
 * Call this in catch blocks that detect "Connection terminated unexpectedly".
 */
export function reconnectPrisma() {
  console.info("[prisma] Reconnecting after connection loss...");
  prisma = recreatePrismaClient();
}
