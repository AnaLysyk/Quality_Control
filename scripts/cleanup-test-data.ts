/**
 * cleanup-test-data.ts
 *
 * Remove do banco todos os artefatos deixados pelos testes de integração.
 * Identifica dados de teste pelos padrões de e-mail e slug usados nos arquivos
 * tests/user-creation-profiles.test.ts e tests/user-delete-profiles.test.ts.
 *
 * Uso:
 *   npx ts-node --project tsconfig.json scripts/cleanup-test-data.ts
 *   (ou via workflow GitHub Actions agendado)
 */

import { prisma } from "../lib/prismaClient";

/** Domínios de e-mail usados exclusivamente pelos testes */
const TEST_EMAIL_DOMAINS = ["@test-profile.local", "@test-del.local"];

/** Prefixos de slug de empresa criados pelos testes */
const TEST_COMPANY_SLUG_PREFIXES = [
  "empresa-teste-viewer-",
  "empresa-teste-compadmin-",
  "emp-viewer-del-",
  "emp-compadmin-del-",
  "empresa-teste-viewer",
  "empresa-teste-compadmin",
  "instituicao-teste-",
];

/** Prefixos de nome de empresa criados pelos testes */
const TEST_COMPANY_NAME_PREFIXES = [
  "Empresa Viewer Del ",
  "Empresa CompAdmin Del ",
  "Empresa Teste Viewer ",
  "Empresa Teste CompAdmin ",
  "Instituição Teste ",
];

async function main() {
  console.log("🧹 Iniciando limpeza de dados de teste...\n");

  // ── 1. Usuários de teste ───────────────────────────────────────────────────
  const testUsers = await prisma.user.findMany({
    where: {
      OR: TEST_EMAIL_DOMAINS.map((domain) => ({
        email: { endsWith: domain },
      })),
    },
    select: { id: true, email: true },
  });

  if (testUsers.length === 0) {
    console.log("✅ Nenhum usuário de teste encontrado.");
  } else {
    const userIds = testUsers.map((u) => u.id);

    const delMemberships = await prisma.membership.deleteMany({
      where: { userId: { in: userIds } },
    });
    console.log(`   memberships removidas : ${delMemberships.count}`);

    const delUsers = await prisma.user.deleteMany({
      where: { id: { in: userIds } },
    });
    console.log(`   usuários removidos    : ${delUsers.count}`);
    testUsers.forEach((u) => console.log(`     - ${u.email}`));
  }

  // ── 2. Empresas de teste ───────────────────────────────────────────────────
  const testCompanies = await prisma.company.findMany({
    where: {
      OR: [
        ...TEST_COMPANY_SLUG_PREFIXES.map((prefix) => ({
          slug: { startsWith: prefix },
        })),
        ...TEST_COMPANY_NAME_PREFIXES.map((prefix) => ({
          name: { startsWith: prefix },
        })),
      ],
    },
    select: { id: true, name: true, slug: true },
  });

  if (testCompanies.length === 0) {
    console.log("✅ Nenhuma empresa de teste encontrada.");
  } else {
    const companyIds = testCompanies.map((c) => c.id);

    const delCompanyMemberships = await prisma.membership.deleteMany({
      where: { companyId: { in: companyIds } },
    });
    console.log(`   memberships de empresa removidas: ${delCompanyMemberships.count}`);

    const delCompanies = await prisma.company.deleteMany({
      where: { id: { in: companyIds } },
    });
    console.log(`   empresas removidas    : ${delCompanies.count}`);
    testCompanies.forEach((c) => console.log(`     - ${c.name} (${c.slug})`));
  }

  console.log("\n✅ Limpeza concluída.");
}

main()
  .catch((err) => {
    console.error("❌ Erro durante a limpeza:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
