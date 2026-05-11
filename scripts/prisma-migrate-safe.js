const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const repoRoot = path.resolve(__dirname, '..');
const prismaConfigPath = path.join(repoRoot, 'prisma.config.ts');
const prismaEnv = { ...process.env };

for (const envFile of ['.env.local', '.env']) {
  const envPath = path.join(repoRoot, envFile);
  if (!fs.existsSync(envPath)) continue;
  dotenv.config({ path: envPath, processEnv: prismaEnv });
}

function runPrisma(cmd, desc) {
  try {
    console.log(`\n[prisma-migrate-safe] ${desc}...`);
    cp.execSync(cmd, { stdio: 'inherit', env: prismaEnv });
    console.log(`[prisma-migrate-safe] ${desc} concluído.`);
  } catch (e) {
    // Coleta todas as possíveis mensagens de erro
    let out = '';
    if (e.stdout) out += e.stdout.toString();
    if (e.stderr) out += e.stderr.toString();
    if (e.message) out += e.message;
    if (typeof e === 'string') out += e;
    // Fallback: tenta serializar o erro
    try { out += JSON.stringify(e); } catch {}
    if (out.includes('P3012')) {
      console.log('[prisma-migrate-safe] Aviso P3012 ignorado: nenhuma migration pendente de rollback.');
      return;
    }
    console.error(`[prisma-migrate-safe] Erro ao executar: ${cmd}`);
    console.error(out);
    // Só lança se não for P3012
    throw e;
  }
}

// Gera o Prisma Client
const prismaConfigArg = fs.existsSync(prismaConfigPath) ? ` --config "${prismaConfigPath}"` : '';
runPrisma(`npx prisma generate${prismaConfigArg}`, 'Gerando Prisma Client');

function shouldSkipMigrateDeploy() {
  const flag = String(prismaEnv.SKIP_PRISMA_MIGRATE || '').trim().toLowerCase();
  if (flag === '1' || flag === 'true' || flag === 'yes') return true;
  const e2e = String(prismaEnv.E2E_USE_JSON || '').trim().toLowerCase();
  if (e2e === '1' || e2e === 'true') return true;
  // If no DB URL is configured, don't attempt a deploy.
  const dbUrl = prismaEnv.DATABASE_URL || prismaEnv.POSTGRES_PRISMA_URL || prismaEnv.POSTGRES_URL;
  if (!dbUrl) return true;
  return false;
}

// Aplica migrations (deploy) quando hÃ¡ banco configurado
if (shouldSkipMigrateDeploy()) {
  console.log('\n[prisma-migrate-safe] SKIP: migrate deploy (sem DATABASE_URL ou modo E2E/flag habilitado).');
} else {
  runPrisma(`npx prisma migrate deploy${prismaConfigArg}`, 'Aplicando migrations');
}
