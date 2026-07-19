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

function getExplicitBrainDatabaseUrl() {
  const brainDatabaseUrl = readEnv("BRAIN_DATABASE_URL");
  const legacyRagDatabaseUrl = readEnv("BRAIN_RAG_DATABASE_URL");

  if (
    brainDatabaseUrl &&
    legacyRagDatabaseUrl &&
    normalizeDatabaseUrl(brainDatabaseUrl) !== normalizeDatabaseUrl(legacyRagDatabaseUrl)
  ) {
    throw new Error("BRAIN_DATABASE_URL and BRAIN_RAG_DATABASE_URL point to different databases. Use BRAIN_DATABASE_URL as the canonical Brain/RAG database URL.");
  }

  if (!brainDatabaseUrl && legacyRagDatabaseUrl && process.env.NODE_ENV !== "production") {
    console.warn("[brainPrisma] BRAIN_RAG_DATABASE_URL is deprecated. Prefer BRAIN_DATABASE_URL.");
  }

  return brainDatabaseUrl ?? legacyRagDatabaseUrl;
}

function deploymentEnvironment() {
  return (
    process.env.BRAIN_ENV ??
    process.env.APP_ENV ??
    process.env.NEXT_PUBLIC_APP_ENV ??
    process.env.VERCEL_ENV ??
    process.env.NODE_ENV ??
    "development"
  ).trim().toLowerCase();
}

function isLocalDevelopmentEnvironment() {
  const env = deploymentEnvironment();
  if (["production", "prod", "homolog", "homologacao", "homologation", "staging", "stage", "preview"].includes(env)) {
    return false;
  }
  if (process.env.RENDER_SERVICE_ID || process.env.RENDER_EXTERNAL_HOSTNAME || process.env.VERCEL) return false;
  return ["development", "dev", "local", "test"].includes(env);
}

function resolveBrainDatabaseUrl() {
  const primaryDatabaseUrl = getPrimaryDatabaseUrl();
  const explicitBrainDatabaseUrl = getExplicitBrainDatabaseUrl();
  const isLocalEnvironment = isLocalDevelopmentEnvironment();
  const canUsePrimaryFallback = isLocalEnvironment && process.env.BRAIN_ALLOW_PRIMARY_DATABASE !== "false";
  const brainDatabaseUrl = explicitBrainDatabaseUrl ?? (canUsePrimaryFallback ? primaryDatabaseUrl : null);

  if (!brainDatabaseUrl) return null;

  const usesPrimaryDatabase =
    primaryDatabaseUrl &&
    normalizeDatabaseUrl(primaryDatabaseUrl) === normalizeDatabaseUrl(brainDatabaseUrl);

  if (usesPrimaryDatabase) {
    if (!isLocalEnvironment) {
      throw new Error("Brain/RAG database cannot equal DATABASE_URL outside local development.");
    }
    if (process.env.BRAIN_ALLOW_PRIMARY_DATABASE === "false") {
      throw new Error("Brain/RAG database cannot use DATABASE_URL when BRAIN_ALLOW_PRIMARY_DATABASE=false.");
    }
    if (explicitBrainDatabaseUrl && process.env.BRAIN_ALLOW_PRIMARY_DATABASE !== "true") {
      throw new Error("Explicit BRAIN_DATABASE_URL cannot equal DATABASE_URL unless BRAIN_ALLOW_PRIMARY_DATABASE=true.");
    }
  }

  if (!explicitBrainDatabaseUrl) {
    console.warn("[brainPrisma] Using primary database as Brain fallback only in dev/local. Set BRAIN_DATABASE_URL to separate it.");
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
    console.warn("[brainPrisma] Brain database disabled because BRAIN_DATABASE_URL is absent and local fallback is not allowed.");
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
