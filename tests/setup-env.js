const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const repoRoot = path.resolve(__dirname, "..");

for (const envFile of [".env.local", ".env"]) {
  const envPath = path.join(repoRoot, envFile);
  if (!fs.existsSync(envPath)) continue;
  dotenv.config({ path: envPath, processEnv: process.env, quiet: true });
}

// Testes unitários devem ser determinísticos e não depender de serviços externos.
// Integração com Postgres deve rodar em suíte/pipeline própria.
process.env.AUTH_STORE = "json";
process.env.TICKETS_STORE = "json";
process.env.QC_TEST_WITH_DB = process.env.QC_TEST_WITH_DB || "";
// Prisma precisa de uma URL para inicializar o client, mas os testes unitários
// não devem realmente conectar em banco. Mantém `DATABASE_URL` vazio para que
// suítes PG (describePg) sejam automaticamente puladas.
delete process.env.DATABASE_URL;
process.env.PRISMA_DATABASE_URL = "postgresql://user:pass@127.0.0.1:5432/qc_test";
process.env.POSTGRES_URL = "postgresql://user:pass@127.0.0.1:5432/qc_test";
delete process.env.POSTGRES_PRISMA_URL;
