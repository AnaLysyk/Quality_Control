import "server-only";

type PrismaClientLike = Record<PropertyKey, unknown> & {
  $disconnect?: () => Promise<void>;
};

type PrismaClientCtor = new (...args: never[]) => PrismaClientLike;

function isConfigured() {
  return Boolean(process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL);
}

function loadPrismaClientCtor(): PrismaClientCtor {
  // Do not `import { PrismaClient } from "@prisma/client"` here.
  // In environments without `prisma generate` (no schema), `@prisma/client` ships only stubs and breaks builds.
  // This keeps Prisma as optional/legacy without blocking `next build`.
  const mod = require("@prisma/client") as { PrismaClient?: PrismaClientCtor } | null;
  const ctor = mod?.PrismaClient;
  if (!ctor) {
    throw new Error('PrismaClient not available (did you run "npx prisma generate"?)');
  }
  return ctor;
}

let prismaSingleton: PrismaClientLike | null = null;

export function isPrismaConfigured(): boolean {
  return isConfigured();
}

export function getPrisma(): PrismaClientLike {
  if (!isConfigured()) {
    throw new Error(
      "Prisma is disabled in this environment (missing DATABASE_URL/POSTGRES_PRISMA_URL/POSTGRES_URL).",
    );
  }
  prismaSingleton ??= new (loadPrismaClientCtor())();
  return prismaSingleton;
}

// Backward compatible export for existing imports: `import { prisma } from "@/lib/prismaClient"`.
export const prisma = new Proxy({} as PrismaClientLike, {
  get(_target, prop) {
    const client = getPrisma();
    const value = (client as Record<PropertyKey, unknown>)[prop];
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(client);
    }
    return value;
  },
}) as PrismaClientLike;
