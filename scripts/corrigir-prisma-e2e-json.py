from pathlib import Path

path = Path("lib/prismaClientOptions.ts")
content = path.read_text(encoding="utf-8")

old = '''  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL, POSTGRES_PRISMA_URL or POSTGRES_URL is required to initialize Prisma.",
    );
  }

  return normalizeDatabaseUrl(databaseUrl);'''

new = '''  if (!databaseUrl) {
    const isJsonE2E =
      process.env.E2E_USE_JSON === "true" ||
      process.env.PLAYWRIGHT === "1" ||
      process.env.NODE_ENV === "test";

    if (isJsonE2E) {
      return "postgresql://postgres:postgres@localhost:5432/postgres";
    }

    throw new Error(
      "DATABASE_URL, POSTGRES_PRISMA_URL or POSTGRES_URL is required to initialize Prisma.",
    );
  }

  return normalizeDatabaseUrl(databaseUrl);'''

if old not in content:
    raise SystemExit("Não achei o bloco do DATABASE_URL para substituir.")

content = content.replace(old, new)

path.write_text(content, encoding="utf-8")
