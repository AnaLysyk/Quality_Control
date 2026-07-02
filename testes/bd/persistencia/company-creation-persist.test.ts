/**
 * Teste de integraÃ§Ã£o: criaÃ§Ã£o de empresa com persistÃªncia real no PostgreSQL.
 *
 * âš ï¸  Intencional: este teste NÃƒO remove a empresa do banco ao final.
 * O objetivo Ã© demonstrar que o registro fica gravado de forma permanente.
 *
 * Requer conexÃ£o com PostgreSQL (DATABASE_URL configurado).
 * Usa pgCreateLocalCompany diretamente â€” sem HTTP.
 */

import { randomUUID } from "crypto";
import { prisma } from "@/lib/prismaClient";
import { pgCreateLocalCompany, pgFindLocalCompanyBySlug } from "@/lib/core/auth/pgStore";

const uid = randomUUID().slice(0, 8);

const describePg = process.env.DATABASE_URL ? describe : describe.skip;

// Slug e nome Ãºnicos para cada execuÃ§Ã£o â€” facilita identificaÃ§Ã£o no banco
const COMPANY_NAME = `Empresa Teste Persistida ${uid}`;
const COMPANY_SLUG = `empresa-teste-persistida-${uid}`;

afterAll(async () => {
  // âœ… ConexÃ£o fechada, mas a empresa NÃƒO Ã© deletada â€” permanece no PostgreSQL.
  await prisma.$disconnect();
});

describePg("CriaÃ§Ã£o de empresa â€” persistÃªncia permanente no banco", () => {
  let createdId: string;

  it("cria a empresa e persiste no PostgreSQL", async () => {
    const company = await pgCreateLocalCompany({
      name: COMPANY_NAME,
      slug: COMPANY_SLUG,
      status: "active",
      short_description: `Empresa criada pelo teste automatizado (uid: ${uid})`,
      notes: "PersistÃªncia intencional â€” nÃ£o remover via afterAll",
    });

    createdId = company.id;

    expect(company.id).toBeTruthy();
    expect(company.name).toBe(COMPANY_NAME);
    expect(company.slug).toBe(COMPANY_SLUG);
    expect(company.status).toBe("active");

    console.log(`\nâœ… Empresa criada:`);
    console.log(`   id   : ${company.id}`);
    console.log(`   name : ${company.name}`);
    console.log(`   slug : ${company.slug}`);
    console.log(`   status: ${company.status}`);
  });

  it("confirma que a empresa estÃ¡ no banco via SELECT independente", async () => {
    const row = await pgFindLocalCompanyBySlug(COMPANY_SLUG);

    expect(row).not.toBeNull();
    expect(row!.id).toBe(createdId);
    expect(row!.name).toBe(COMPANY_NAME);
    expect(row!.slug).toBe(COMPANY_SLUG);

    console.log(`\nâœ… Confirmado via SELECT:`);
    console.log(`   id   : ${row!.id}`);
    console.log(`   slug : ${row!.slug}`);
    console.log(`   (registro permanece no banco â€” sem cleanup)`);
  });

  it("confirma que a empresa aparece na listagem geral do banco", async () => {
    const count = await prisma.company.count({ where: { slug: COMPANY_SLUG } });
    expect(count).toBe(1);

    console.log(`\nâœ… Empresa encontrada na listagem geral (count: ${count})`);
    console.log(`   slug persistido: ${COMPANY_SLUG}`);
    console.log(`   âš ï¸  Empresa NÃƒO serÃ¡ deletada â€” permanece no PostgreSQL.`);
  });
});

