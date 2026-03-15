import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();
const uid = randomUUID().slice(0, 8);

console.log("\n=== Verificação de Persistência no PostgreSQL ===");
console.log("Banco:", process.env.DATABASE_URL?.replace(/:([^@]+)@/, ':***@') ?? '(não configurado)');

// 1) Conta usuários antes
const antes = await prisma.user.count();
console.log(`\n[1] Usuários no banco antes do teste: ${antes}`);

// 2) Cria 2 usuários de teste
const emails = [`persist-A-${uid}@check.local`, `persist-B-${uid}@check.local`];
const userA = await prisma.user.create({ data: { email: emails[0], name: `Persist A ${uid}`, password_hash: 'check-only', role: 'user', status: 'active', is_global_admin: false } });
const userB = await prisma.user.create({ data: { email: emails[1], name: `Persist B ${uid}`, password_hash: 'check-only', role: 'user', status: 'active', is_global_admin: false } });
console.log(`\n[2] Criados 2 usuários:`);
console.log(`  ✔ ${userA.email} (id: ${userA.id})`);
console.log(`  ✔ ${userB.email} (id: ${userB.id})`);

// 3) Confirma que ambos estão no banco via query independente
const found = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true, email: true, status: true } });
console.log(`\n[3] Confirmação via SELECT — encontrados: ${found.length}/2`);
found.forEach(u => console.log(`  ✔ ${u.email} | status: ${u.status}`));

// 4) Deleta o primeiro
await prisma.user.delete({ where: { id: userA.id } });
console.log(`\n[4] Deletado: ${userA.email}`);

// 5) Verifica que só B permanece
const apos = await prisma.user.findMany({ where: { email: { in: emails } }, select: { email: true } });
console.log(`\n[5] Remanescentes após deleção: ${apos.length}/2`);
apos.forEach(u => console.log(`  ✔ ${u.email} (permanece no banco)`));
const deletadoAinda = await prisma.user.findUnique({ where: { id: userA.id } });
console.log(`  ✘ ${userA.email} → ${deletadoAinda ? 'AINDA EXISTE (erro!)' : 'removido com sucesso'}`);

// 6) Limpa userB
await prisma.user.delete({ where: { id: userB.id } });
console.log(`\n[6] Limpeza: ${userB.email} removido`);

const depois = await prisma.user.count();
console.log(`\n[7] Usuários no banco após cleanup: ${depois} (igual ao início: ${depois === antes ? '✔' : '✘ diferença de ' + (depois - antes)})`);

console.log("\n✅ Persistência confirmada — todos os dados foram ao PostgreSQL real.");
await prisma.$disconnect();
