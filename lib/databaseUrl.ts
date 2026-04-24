export type DatabaseScope = "default" | "automation";

function normalizeEnv(value?: string | null) {
  return (value ?? "").trim().replace(/^['\"]|['\"]$/g, "");
}

function firstDefined(...values: Array<string | undefined>) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

export function resolveDatabaseUrlFromEnv(scope: DatabaseScope = "default") {
  const databaseUrl =
    scope === "automation"
      ? firstDefined(
          process.env.AUTOMATION_DATABASE_URL,
          process.env.AUTOMATION_PRISMA_DATABASE_URL,
          process.env.PRISMA_DATABASE_URL,
          process.env.AUTOMATION_POSTGRES_PRISMA_URL,
          process.env.AUTOMATION_POSTGRES_URL,
          process.env.POSTGRES_PRISMA_URL,
          process.env.POSTGRES_URL,
          process.env.DATABASE_URL,
        )
      : firstDefined(
          process.env.DATABASE_URL,
          process.env.PRISMA_DATABASE_URL,
          process.env.POSTGRES_PRISMA_URL,
          process.env.POSTGRES_URL,
        );

  return normalizeEnv(databaseUrl);
}
