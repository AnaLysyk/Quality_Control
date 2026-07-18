import "dotenv/config";
import { defineConfig, env } from "prisma/config";

function resolveDatabaseUrl() {
  return (
    process.env.DATABASE_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL ??
    env("DATABASE_URL")
  );
}

export default defineConfig({
  schema: "database/prisma/schema.prisma",
  migrations: {
    path: "database/prisma/migrations",
  },
  datasource: {
    url: resolveDatabaseUrl(),
  },
});

