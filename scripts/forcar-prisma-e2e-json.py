from pathlib import Path
import re

path = Path("lib/prismaClientOptions.ts")
content = path.read_text(encoding="utf-8")

content = re.sub(
    r'''  if \(!databaseUrl\) \{
    throw new Error\(
      "DATABASE_URL, POSTGRES_PRISMA_URL or POSTGRES_URL is required to initialize Prisma\.",
    \);
  \}

  return normalizeDatabaseUrl\(databaseUrl\);''',
    '''  if (!databaseUrl) {
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

  return normalizeDatabaseUrl(databaseUrl);''',
    content,
    count=1,
)

path.write_text(content, encoding="utf-8")
