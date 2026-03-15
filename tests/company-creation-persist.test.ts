/**
 * Teste de integração: criação de empresa com persistência real no PostgreSQL.
 *
 * ⚠️  Intencional: este teste NÃO remove a empresa do banco ao final.
 * O objetivo é demonstrar que o registro fica gravado de forma permanente.
 *
 * Requer conexão com PostgreSQL (DATABASE_URL configurado).
 * Usa pgCreateLocalCompany diretamente — sem HTTP.
 */

import { randomUUID } from "crypto";
import { prisma } from "../lib/prismaClient";
import { pgCreateLocalCompany, pgFindLocalCompanyBySlug } from "../src/core/auth/pgStore";

const uid = randomUUID().slice(0, 8);

// Slug e nome únicos para cada execução — facilita identificação no banco
const COMPANY_NAME = `Empresa Teste Persistida ${uid}`;
const COMPANY_SLUG = `empresa-teste-persistida-${uid}`;

afterAll(async () => {
  // ✅ Conexão fechada, mas a empresa NÃO é deletada — permanece no PostgreSQL.
  await prisma.$disconnect();
});

describe("Criação de empresa — persistência permanente no banco", () => {
  let createdId: string;

  it("cria a empresa e persiste no PostgreSQL", async () => {
    const company = await pgCreateLocalCompany({
      name: COMPANY_NAME,
      slug: COMPANY_SLUG,
      status: "active",
      short_description: `Empresa criada pelo teste automatizado (uid: ${uid})`,
      notes: "Persistência intencional — não remover via afterAll",
    });

    createdId = company.id;

    expect(company.id).toBeTruthy();
    expect(company.name).toBe(COMPANY_NAME);
    expect(company.slug).toBe(COMPANY_SLUG);
    expect(company.status).toBe("active");

    console.log(`\n✅ Empresa criada:`);
    console.log(`   id   : ${company.id}`);
    console.log(`   name : ${company.name}`);
    console.log(`   slug : ${company.slug}`);
    console.log(`   status: ${company.status}`);
  });

  it("confirma que a empresa está no banco via SELECT independente", async () => {
    const row = await pgFindLocalCompanyBySlug(COMPANY_SLUG);

    expect(row).not.toBeNull();
    expect(row!.id).toBe(createdId);
    expect(row!.name).toBe(COMPANY_NAME);
    expect(row!.slug).toBe(COMPANY_SLUG);

    console.log(`\n✅ Confirmado via SELECT:`);
    console.log(`   id   : ${row!.id}`);
    console.log(`   slug : ${row!.slug}`);
    console.log(`   (registro permanece no banco — sem cleanup)`);
  });

  it("confirma que a empresa aparece na listagem geral do banco", async () => {
    const count = await prisma.company.count({ where: { slug: COMPANY_SLUG } });
    expect(count).toBe(1);

    console.log(`\n✅ Empresa encontrada na listagem geral (count: ${count})`);
    console.log(`   slug persistido: ${COMPANY_SLUG}`);
    console.log(`   ⚠️  Empresa NÃO será deletada — permanece no PostgreSQL.`);
  });
});
