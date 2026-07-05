import "server-only";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForBrainPrisma = globalThis as unknown as {
  brainPrisma?: PrismaClient;
  brainPrismaAdapter?: PrismaPg;
};

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
  return process.env.DATABASE_URL ?? process.env.POSTGRES_PRISMA_URL ?? process.env.POSTGRES_URL ?? null;
}

function getBrainDatabaseUrl() {
  const brainDatabaseUrl = process.env.BRAIN_DATABASE_URL ?? process.env.BRAIN_RAG_DATABASE_URL;

  if (!brainDatabaseUrl) {
    throw new Error(
      "BRAIN_DATABASE_URL or BRAIN_RAG_DATABASE_URL is required for the Brain RAG database.",
    );
  }

  const primaryDatabaseUrl = getPrimaryDatabaseUrl();
  const allowSameDatabase = process.env.BRAIN_ALLOW_PRIMARY_DATABASE === "true";

  if (
    primaryDatabaseUrl &&
    normalizeDatabaseUrl(primaryDatabaseUrl) === normalizeDatabaseUrl(brainDatabaseUrl) &&
    !allowSameDatabase
  ) {
    throw new Error(
      "Brain RAG database must be separated from the production/system database. Set BRAIN_ALLOW_PRIMARY_DATABASE=true only for local development.",
    );
  }

  return brainDatabaseUrl;
}

function createBrainPrismaClient() {
  const adapter = globalForBrainPrisma.brainPrismaAdapter ?? new PrismaPg(getBrainDatabaseUrl());
  globalForBrainPrisma.brainPrismaAdapter = adapter;

  return new PrismaClient({ adapter });
}

export const brainPrisma: PrismaClient =
  globalForBrainPrisma.brainPrisma ?? createBrainPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForBrainPrisma.brainPrisma = brainPrisma;
}
