const cp = require('child_process');

function runPrisma(cmd, desc) {
  try {
    console.log(`\n[prisma-migrate-safe] ${desc}...`);
    cp.execSync(cmd, { stdio: 'inherit' });
    console.log(`[prisma-migrate-safe] ${desc} concluído.`);
  } catch (e) {
    const out =
      (e.stdout && e.stdout.toString()) ||
      (e.stderr && e.stderr.toString()) ||
      e.message || '';
    if (out.includes('P3012')) {
      console.log('[prisma-migrate-safe] Aviso P3012 ignorado: nenhuma migration pendente de rollback.');
    } else {
      console.error(`[prisma-migrate-safe] Erro ao executar: ${cmd}`);
      throw e;
    }
  }
}

// Gera o Prisma Client
runPrisma('npx prisma generate', 'Gerando Prisma Client');

// Resolve migrations com possível rollback
runPrisma('npx prisma migrate resolve --rolled-back 20250601000000_init_postgres', 'Resolvendo migrations (rollback)');

// Aplica migrations
runPrisma('npx prisma migrate deploy', 'Aplicando migrations');
