import { prisma as p } from "../lib/prismaClient";

async function main() {
const companies = await p.company.findMany({
  orderBy: { createdAt: "desc" },
  take: 15,
  select: { id: true, name: true, slug: true, status: true, createdAt: true },
});
console.log(`\n=== TABELA: company (${companies.length} registros) ===`);
for (const c of companies) {
  console.log(`  [${c.createdAt.toISOString().slice(0, 19)}] id: ${c.id} | slug: ${c.slug} | name: ${c.name} | status: ${c.status}`);
}

const users = await p.user.findMany({
  orderBy: { createdAt: "desc" },
  take: 20,
  select: { id: true, email: true, role: true, is_global_admin: true, status: true, createdAt: true },
});
console.log(`\n=== TABELA: user (${users.length} registros) ===`);
for (const u of users) {
  console.log(`  [${u.createdAt.toISOString().slice(0, 19)}] id: ${u.id} | email: ${u.email} | role: ${u.role} | admin: ${u.is_global_admin} | status: ${u.status}`);
}

const mems = await p.membership.findMany({
  orderBy: { createdAt: "desc" },
  take: 10,
  include: { user: { select: { email: true } }, company: { select: { slug: true } } },
});
console.log(`\n=== TABELA: membership (${mems.length} registros) ===`);
for (const m of mems) {
  console.log(`  user: ${m.user.email} | company: ${m.company.slug} | role: ${m.role}`);
}

await p.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
