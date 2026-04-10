import { PrismaPg } from "@prisma/adapter-pg";

let adapter: PrismaPg | undefined;
const DEPRECATED_SSL_MODES = new Set(["prefer", "require", "verify-ca"]);

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

function getDatabaseUrl() {
  const databaseUrl =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL, POSTGRES_PRISMA_URL or POSTGRES_URL is required to initialize Prisma.",
    );
  }

  return normalizeDatabaseUrl(databaseUrl);
}

export function getPrismaAdapter() {
  if (!adapter) {
    adapter = new PrismaPg(getDatabaseUrl());
  }

  return adapter;
}

export function getPrismaClientOptions(
  options: Record<string, unknown> = {},
) {
  return {
    ...options,
    adapter: getPrismaAdapter(),
  };
}
