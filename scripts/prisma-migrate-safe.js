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

// Aplica migrations (deploy)
runPrisma(`npx prisma migrate deploy${prismaConfigArg}`, 'Aplicando migrations');
