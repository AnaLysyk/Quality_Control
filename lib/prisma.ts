import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

type GlobalPrisma = {
  prisma?: PrismaClient;
  pool?: Pool;
};

const globalForPrisma = globalThis as unknown as GlobalPrisma;

const CONNECTION_KEYS = [
  "DATABASE_URL",
  // Este repo padroniza DATABASE_URL como fonte única. Aliases removidos.
];

function readEnv(key: string): string | null {
  const value = process.env[key];
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function getConnectionString(): string | null {
  for (const key of CONNECTION_KEYS) {
    const value = readEnv(key);
    if (value) return value;
  }
  return null;
}

function buildClient(): PrismaClient {
  const connectionString = getConnectionString();
  if (!connectionString) {
    throw new Error(
      "PRISMA_NOT_CONFIGURED: defina DATABASE_URL para usar o Postgres.",
    );
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
