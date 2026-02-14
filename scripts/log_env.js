// scripts/log_env.js
// Roda: node scripts/log_env.js [VAR1 VAR2 ...]

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const root = path.resolve(__dirname, '..');
const envLocal = path.join(root, '.env.local');
const env = path.join(root, '.env');

if (fs.existsSync(envLocal)) {
  dotenv.config({ path: envLocal });
  console.log('[log_env] Loaded .env.local');
} else if (fs.existsSync(env)) {
  dotenv.config({ path: env });
  console.log('[log_env] Loaded .env');
} else {
  console.warn('[log_env] Nenhum arquivo .env.local ou .env encontrado.');
}

// Variáveis a exibir: argumentos ou padrão
const vars = process.argv.slice(2);
const showVars = vars.length
  ? vars
  : ['DATABASE_URL', 'POSTGRES_PRISMA_URL', 'NODE_ENV'];

for (const key of showVars) {
  let val = process.env[key];
  if (typeof val === 'string' && val.length > 8) {
    // Esconde valor sensível, mostra só prefixo
    val = val.slice(0, 6) + '...' + val.slice(-2);
  }
  console.log(`${key}:`, val);
}
