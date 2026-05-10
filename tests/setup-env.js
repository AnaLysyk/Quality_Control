const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const repoRoot = path.resolve(__dirname, '..');

for (const envFile of ['.env.local', '.env']) {
  const envPath = path.join(repoRoot, envFile);
  if (!fs.existsSync(envPath)) continue;
  dotenv.config({ path: envPath, processEnv: process.env, quiet: true });
}

// Testes unitários devem ser determinísticos e não depender de serviços externos.
// Se o dev quiser rodar integração via Postgres, pode setar explicitamente AUTH_STORE/TICKETS_STORE.
process.env.AUTH_STORE = process.env.AUTH_STORE || 'json';
process.env.TICKETS_STORE = process.env.TICKETS_STORE || 'json';

// Evita que um DATABASE_URL real (carregado do .env) faça o teste tentar conectar fora.
if (process.env.AUTH_STORE !== 'postgres') delete process.env.DATABASE_URL;
if (process.env.TICKETS_STORE !== 'postgres') delete process.env.DATABASE_URL;
