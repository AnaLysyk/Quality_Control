import { PrismaClient } from "./prisma-generated";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

type GlobalPrisma = {
  prisma?: PrismaClient;
  pool?: Pool;
};

const globalForPrisma = globalThis as unknown as GlobalPrisma;

function getConnectionString(): string | null {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || null;
  return url && url.trim() ? url.trim() : null;
}

function buildClient(): PrismaClient {
  const connectionString = getConnectionString();
  if (!connectionString) {
    throw new Error("PRISMA_NOT_CONFIGURED: defina DATABASE_URL ou POSTGRES_URL para usar o Postgres.");
  }

  const pool = globalForPrisma.pool ?? new Pool({ connectionString });
  globalForPrisma.pool = pool;

  const adapter = new PrismaPg(pool);
  const client = new (PrismaClient as any)({ adapter }) as PrismaClient;
  return client;
}

function getClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = buildClient();
  }
  return globalForPrisma.prisma;
}

// Proxy evita inicialização imediata (lazy). Só conecta ao acessar um método.
export const prisma = new Proxy(
  {},
  {
    get(_target, prop) {
      const client = getClient() as any;
      return client[prop];
    },
  },
) as unknown as PrismaClient;

export function isPrismaConfigured(): boolean {
  return !!getConnectionString();
}
