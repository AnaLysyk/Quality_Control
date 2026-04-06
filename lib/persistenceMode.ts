function normalizeEnv(value?: string | null) {
  return (value ?? "").trim().replace(/^['"]|['"]$/g, "").toLowerCase();
}

function hasSupportedDatabaseUrl(value?: string | null) {
  const normalized = normalizeEnv(value);
  return (
    normalized.startsWith("postgresql://") ||
    normalized.startsWith("prisma://") ||
    normalized.startsWith("prisma+postgres://")
  );
}

export function shouldUsePostgresPersistence() {
  const authStore = normalizeEnv(process.env.AUTH_STORE);
  if (authStore === "postgres") return true;
  if (authStore === "json" || authStore === "file" || authStore === "memory" || authStore === "redis") {
    return false;
  }
  return hasSupportedDatabaseUrl(process.env.DATABASE_URL);
}

