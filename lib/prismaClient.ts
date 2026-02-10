import "server-only";

import { PrismaClient } from "@prisma/client";

function isConfigured() {
  return Boolean(process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL);
}

let prismaSingleton: PrismaClient | null = null;

export function isPrismaConfigured(): boolean {
  return isConfigured();
}

export function getPrisma(): PrismaClient {
  if (!isConfigured()) {
    throw new Error(
      "Prisma is disabled in this environment (missing DATABASE_URL/POSTGRES_PRISMA_URL/POSTGRES_URL).",
    );
  }
  prismaSingleton ??= new PrismaClient();
  return prismaSingleton;
}

// Backward compatible export for existing imports: `import { prisma } from "@/lib/prismaClient"`.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrisma();
    const value = (client as any)[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
}) as PrismaClient;

