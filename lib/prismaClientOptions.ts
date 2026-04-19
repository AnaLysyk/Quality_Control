import { PrismaPg } from "@prisma/adapter-pg";
import { resolveDatabaseUrlFromEnv } from "@/lib/databaseUrl";
import type { DatabaseScope } from "@/lib/databaseUrl";

const adapters = new Map<DatabaseScope, PrismaPg>();
const DEPRECATED_SSL_MODES = new Set(["prefer", "verify-ca"]);

function normalizeDatabaseUrl(databaseUrl: string) {
  const trimmed = databaseUrl.trim();
  if (!trimmed) return trimmed;

  try {
    const parsed = new URL(trimmed);
    const protocol = parsed.protocol.toLowerCase();
    if (
      protocol !== "postgresql:" &&
      protocol !== "postgres:" &&
      protocol !== "prisma+postgres:"
    ) {
      return trimmed;
    }

    const useLibpqCompat = parsed.searchParams.get("uselibpqcompat")?.toLowerCase();
    if (useLibpqCompat === "true" || useLibpqCompat === "1") {
      return parsed.toString();
    }

    const sslMode = parsed.searchParams.get("sslmode")?.toLowerCase();
    if (sslMode && DEPRECATED_SSL_MODES.has(sslMode)) {
      parsed.searchParams.set("sslmode", "verify-full");
    }

    return parsed.toString();
  } catch {
    return trimmed;
  }
}

function getDatabaseUrl(scope: DatabaseScope = "default") {
  const databaseUrl = resolveDatabaseUrlFromEnv(scope);

  if (!databaseUrl) {
    throw new Error(
      scope === "automation"
        ? "AUTOMATION_DATABASE_URL, AUTOMATION_PRISMA_DATABASE_URL, PRISMA_DATABASE_URL, AUTOMATION_POSTGRES_PRISMA_URL, AUTOMATION_POSTGRES_URL or POSTGRES_URL is required to initialize Prisma for automation scope."
        : "DATABASE_URL, PRISMA_DATABASE_URL, POSTGRES_PRISMA_URL or POSTGRES_URL is required to initialize Prisma.",
    );
  }

  return normalizeDatabaseUrl(databaseUrl);
}

export function getPrismaAdapter(scope: DatabaseScope = "default") {
  const cached = adapters.get(scope);
  if (cached) return cached;

  const created = new PrismaPg(getDatabaseUrl(scope));
  adapters.set(scope, created);
  return created;
}

export function getAutomationPrismaAdapter() {
  return getPrismaAdapter("automation");
}

export function resetPrismaAdapter(scope?: DatabaseScope) {
  if (scope) {
    adapters.delete(scope);
    return;
  }

  adapters.clear();
}

export function getPrismaClientOptions(
  options: Record<string, unknown> = {},
  scope: DatabaseScope = "default",
) {
  return {
    ...options,
    adapter: getPrismaAdapter(scope),
  };
}

export function getAutomationPrismaClientOptions(
  options: Record<string, unknown> = {},
) {
  return getPrismaClientOptions(options, "automation");
}
