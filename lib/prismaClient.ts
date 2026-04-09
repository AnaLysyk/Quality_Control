import { PrismaClient } from "@prisma/client";
import { getPrismaClientOptions } from "@/lib/prismaClientOptions";

// Singleton pattern: reutiliza a instância entre hot-reloads no dev
// e evita "too many connections" em produção.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  return new PrismaClient(getPrismaClientOptions());
}


export const prisma =
  globalForPrisma.prisma ??
  createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
