import "server-only";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForBrainPrisma = globalThis as unknown as {
  brainPrisma?: PrismaClient;
  brainPrismaAdapter?: PrismaPg;
};

function readEnv(name: string) {
  return process.env[name]?.trim() || null;
}

function normalizeDatabaseUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  try {
    const parsed = new URL(trimmed);
    parsed.searchParams.sort?.();
    return parsed.toString();
  } catch {
    return trimmed;
  }
}

function getPrimaryDatabaseUrl() {
  return readEnv("DATABASE_URL") ?? readEnv("POSTGRES_PRISMA_URL") ?? readEnv("POSTGRES_URL");
}

function resolveBrainDatabaseUrl() {
  const primaryDatabaseUrl = getPrimaryDatabaseUrl();
  const explicitBrainDatabaseUrl = readEnv("BRAIN_DATABASE_URL") ?? readEnv("BRAIN_RAG_DATABASE_URL");
  const brainDatabaseUrl = explicitBrainDatabaseUrl ?? primaryDatabaseUrl;

  if (!brainDatabaseUrl) return null;

  if (
    primaryDatabaseUrl &&
    explicitBrainDatabaseUrl &&
    normalizeDatabaseUrl(primaryDatabaseUrl) === normalizeDatabaseUrl(explicitBrainDatabaseUrl) &&
    process.env.BRAIN_ALLOW_PRIMARY_DATABASE === "false"
  ) {
    throw new Error("Brain RAG database cannot use the primary database when BRAIN_ALLOW_PRIMARY_DATABASE=false.");
  }

  if (!explicitBrainDatabaseUrl) {
    console.warn("[brainPrisma] Using primary database as Brain fallback. Set BRAIN_RAG_DATABASE_URL later to separate it.");
  }

  return brainDatabaseUrl;
}

function createDisabledBrainPrisma() {
  const listModel = { findMany: async () => [] };
  const auditModel = { create: async () => null };

  return {
    brainNode: listModel,
    brainEdge: listModel,
    brainAuditLog: auditModel,
  } as unknown as PrismaClient;
}

function createBrainPrismaClient() {
  const databaseUrl = resolveBrainDatabaseUrl();
  if (!databaseUrl) {
    console.warn("[brainPrisma] Brain database disabled because no database URL is available.");
    return createDisabledBrainPrisma();
  }

  const adapter = globalForBrainPrisma.brainPrismaAdapter ?? new PrismaPg(databaseUrl);
  globalForBrainPrisma.brainPrismaAdapter = adapter;

  return new PrismaClient({ adapter });
}

export const brainPrisma: PrismaClient =
  globalForBrainPrisma.brainPrisma ?? createBrainPrismaClient();

export function getBrainPrisma() {
  return brainPrisma;
}

if (process.env.NODE_ENV !== "production") {
  globalForBrainPrisma.brainPrisma = brainPrisma;
}
