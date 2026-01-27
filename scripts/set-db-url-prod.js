// scripts/set-db-url-prod.js
// Uso: node scripts/set-db-url-prod.js
// Seta DATABASE_URL para pooler (6543) automaticamente se NODE_ENV=production

const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '../.env.local');
const env = fs.readFileSync(envPath, 'utf8').split('\n');

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
  console.error('DATABASE_URL_UNPOOLED não encontrado no .env.local');
  process.exit(1);
}

const newEnv = env.map(line => {
  if (line.startsWith('DATABASE_URL=')) {
    return `DATABASE_URL="${poolerUrl}"`;
  }
  return line;
});

fs.writeFileSync(envPath, newEnv.join('\n'), 'utf8');
console.log('DATABASE_URL atualizado para pooler (6543) no .env.local');
