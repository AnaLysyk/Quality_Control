try {
  // "server-only" exists in Next.js runtime; ignore when running scripts/tests.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require("server-only");
} catch {
  // no-op
}
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

type GlobalPrisma = {
  prisma?: PrismaClient;
  prismaPool?: Pool;
};

const globalForPrisma = globalThis as unknown as GlobalPrisma;
const connectionString =
  process.env.DATABASE_URL ?? process.env.POSTGRES_PRISMA_URL ?? process.env.POSTGRES_URL;

function getAdapter(): PrismaPg {
  if (!connectionString) {
    throw new Error(
      "Database URL not configured. Set DATABASE_URL, POSTGRES_PRISMA_URL, or POSTGRES_URL in the environment."
    );
  }
  if (!globalForPrisma.prismaPool) {
    globalForPrisma.prismaPool = new Pool(
      connectionString ? { connectionString } : undefined
    );
  }
  return new PrismaPg(globalForPrisma.prismaPool);
}

function getClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({ adapter: getAdapter() });
  }
  return globalForPrisma.prisma;
}

export const prisma: PrismaClient = getClient();
