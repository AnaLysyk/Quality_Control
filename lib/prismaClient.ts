import { PrismaClient } from "@prisma/client";

// Singleton pattern: reutiliza a instância entre hot-reloads no dev
// e evita "too many connections" em produção.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

type PrismaClientInternalOptions = {
  __internal?: {
    configOverride?: (config: Record<string, unknown>) => Record<string, unknown>;
  };
};

function createPrismaClient() {
  const PrismaClientUnsafe = PrismaClient as unknown as new (
    options?: ConstructorParameters<typeof PrismaClient>[0] & PrismaClientInternalOptions,
  ) => PrismaClient;

  return new PrismaClientUnsafe({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    // Force the local engine for regular postgresql URLs.
    __internal: {
      configOverride: (config) => ({ ...config, copyEngine: true }),
    },
  });
}

export const prisma =
  globalForPrisma.prisma ??
  createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
