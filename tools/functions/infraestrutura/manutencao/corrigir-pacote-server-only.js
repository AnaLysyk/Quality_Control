// ---
// Ajuste sugerido: tratamento de avisos do Prisma (ex: P3012) pode ser feito no script de build (package.json ou script dedicado).
// Exemplo de tratamento para ignorar P3012:
// try {
//   cp.execSync('npx prisma migrate resolve --rolled-back 20250601000000_init_postgres',{stdio:'inherit'});
// } catch(e) {
//   if (e.stdout && e.stdout.toString().includes('P3012')) {
//     console.log('Aviso P3012 ignorado: nenhuma migration pendente de rollback.');
//   } else {
//     throw e;
//   }
// }
// Recomenda-se também adicionar logs claros para cada etapa do deploy.
// ---

const fs = require("fs");
const path = require("path");

const targets = [
  path.join(process.cwd(), "node_modules", "server-only", "empty.js"),
  path.join(process.cwd(), "node_modules", "next", "dist", "compiled", "server-only", "empty.js"),
];

for (const filePath of targets) {
  try {
    if (fs.existsSync(filePath)) continue;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, "module.exports = {};", "utf8");
    console.log(`fix-server-only: created ${filePath}`);
  } catch (err) {
    console.warn(`fix-server-only: failed to create ${filePath}`, err);
  }
}
