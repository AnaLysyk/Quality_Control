/**
 * scripts/set-db-url-prod.js
 * Uso: node scripts/set-db-url-prod.js [envFile]
 * Seta DATABASE_URL para pooler (6543) automaticamente se NODE_ENV=production
 *
 * - Suporta fallback para .env se .env.local não existir
 * - Permite override do caminho do env via argumento ou ENV_FILE
 * - Loga valor antigo e novo de DATABASE_URL
 */

const fs = require('fs');
const path = require('path');

function getEnvFilePath() {
  if (process.env.ENV_FILE) return path.resolve(process.env.ENV_FILE);
  if (process.argv[2]) return path.resolve(process.argv[2]);
  const local = path.resolve(__dirname, '../.env.local');
  if (fs.existsSync(local)) return local;
  const fallback = path.resolve(__dirname, '../.env');
  if (fs.existsSync(fallback)) return fallback;
  return local; // default
}

const envPath = getEnvFilePath();
let env;
try {
  env = fs.readFileSync(envPath, 'utf8').split('\n');
} catch (e) {
  console.error(`Erro ao ler arquivo de env: ${envPath}`);
  process.exit(1);
}

const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
if (!isProd) {
  console.log('Não em produção, nada alterado.');
  process.exit(0);
}

let poolerUrl = null;
for (const line of env) {
  if (line.startsWith('DATABASE_URL_UNPOOLED=')) {
    poolerUrl = line.replace('DATABASE_URL_UNPOOLED=', '').replace(/^"|"$/g, '');
    break;
  }
}
if (!poolerUrl) {
  console.error('DATABASE_URL_UNPOOLED não encontrado em', envPath);
  process.exit(1);
}

let oldDbUrl = null;
// Atualiza ou adiciona DATABASE_URL
let foundDbUrl = false;
const newEnv = env.map(line => {
  if (line.startsWith('DATABASE_URL=')) {
    foundDbUrl = true;
    oldDbUrl = line.replace('DATABASE_URL=', '').replace(/^"|"$/g, '');
    return `DATABASE_URL="${poolerUrl}"`;
  }
  return line;
});

let finalEnv = newEnv;
if (!foundDbUrl) {
  // Adiciona DATABASE_URL ao final se não existir
  finalEnv = [...newEnv, `DATABASE_URL="${poolerUrl}"`];
  console.log('DATABASE_URL não existia, adicionado ao final do arquivo.');
}

try {
  fs.writeFileSync(envPath, finalEnv.join('\n'), 'utf8');
  console.log(`DATABASE_URL atualizado para pooler (6543) em ${envPath}`);
  if (oldDbUrl !== null) {
    console.log('Valor anterior:', oldDbUrl);
  } else {
    console.log('Valor anterior: (não existia)');
  }
  console.log('Novo valor:', poolerUrl);
} catch (e) {
  console.error('Erro ao escrever arquivo de env:', e);
  process.exit(1);
}
