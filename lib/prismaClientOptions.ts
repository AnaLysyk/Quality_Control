import { PrismaPg } from "@prisma/adapter-pg";

let adapter: PrismaPg | undefined;

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

  return databaseUrl;
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
