import "server-only";
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
