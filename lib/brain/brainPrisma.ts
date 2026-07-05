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

function canUsePrimaryDatabaseAsBrainFallback() {
  return process.env.NODE_ENV !== "production" || process.env.BRAIN_ALLOW_PRIMARY_DATABASE === "true";
}

function getBrainDatabaseUrl() {
  const brainDatabaseUrl = process.env.BRAIN_DATABASE_URL ?? process.env.BRAIN_RAG_DATABASE_URL;
  const primaryDatabaseUrl = getPrimaryDatabaseUrl();

  if (!brainDatabaseUrl) {
    if (primaryDatabaseUrl && canUsePrimaryDatabaseAsBrainFallback()) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[brain] BRAIN_DATABASE_URL ausente. Usando DATABASE_URL como fallback local temporario do RAG.");
      }
      return primaryDatabaseUrl;
    }

    throw new Error(
      "BRAIN_DATABASE_URL or BRAIN_RAG_DATABASE_URL is required for the Brain RAG database.",
    );
  }

  const allowSameDatabase = process.env.BRAIN_ALLOW_PRIMARY_DATABASE === "true";

  if (
    primaryDatabaseUrl &&
    normalizeDatabaseUrl(primaryDatabaseUrl) === normalizeDatabaseUrl(brainDatabaseUrl) &&
    !allowSameDatabase &&
    process.env.NODE_ENV === "production"
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
