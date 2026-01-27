import "server-only";

import { createClient } from "@vercel/postgres";

type SqlTag = ReturnType<typeof createClient>["sql"];

const CONNECTION_KEYS = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL_NON_POOLING",
  "DATABASE_URL_UNPOOLED",
];

function readEnv(key: string): string | null {
  const value = process.env[key];
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function resolveConnectionString(): string | null {
  for (const key of CONNECTION_KEYS) {
    const value = readEnv(key);
    if (value) return value;
  }
  return null;
}

let cachedSql: SqlTag | null = null;
let cachedConnection: string | null | undefined;

export function getPostgresSql(): SqlTag | null {
  if (cachedConnection === undefined) {
    cachedConnection = resolveConnectionString();
  }
  if (!cachedConnection) return null;

  if (!cachedSql) {
    const client = createClient({ connectionString: cachedConnection });
    cachedSql = client.sql;
  }

  return cachedSql;
}

export function requirePostgresSql(): SqlTag {
  const sql = getPostgresSql();
  if (!sql) {
    throw new Error("POSTGRES_NOT_CONFIGURED");
  }
  return sql;
}

export function isPostgresConfigured(): boolean {
  return Boolean(resolveConnectionString());
}
