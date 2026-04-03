// Define variáveis de ambiente antes de qualquer módulo ser carregado nos testes
process.env.AUTH_STORE = 'postgres';
process.env.TICKETS_STORE = 'postgres';

const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");

const repoRoot = path.resolve(__dirname, "..");
const envLocalPath = path.join(repoRoot, ".env.local");
const envPath = path.join(repoRoot, ".env");

if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
}

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}
