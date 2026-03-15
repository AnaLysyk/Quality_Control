/**
 * Cenários de edição de empresa no banco PostgreSQL.
 * ✅ cleanup total em afterAll — nenhum dado permanece.
 *
 * Cenários cobertos:
 *  1. Editar nome da empresa
 *  2. Editar status (active ↔ inactive)
 *  3. Editar campos de contato (phone, address, website, cep)
 *  4. Editar tax_id (CNPJ)
 *  5. Editar short_description e notes
 *  6. Editar campos de integração (jira_base_url, jira_email, qase_project_code)
 *  7. Rejeitar nome duplicado na edição
 *  8. Retornar null para empresa inexistente
 */

import { prisma } from "../lib/prismaClient";
import {
  pgCreateLocalCompany,
  pgUpdateLocalCompany,
  pgDeleteLocalCompany,
} from "../src/core/auth/pgStore";

const UID = Math.random().toString(36).slice(2, 10);
const slug = (suffix: string) => `edit-empresa-${UID}-${suffix}`;

const createdIds: string[] = [];

afterAll(async () => {
  for (const id of createdIds) {
    await pgDeleteLocalCompany(id).catch(() => null);
  }
  await prisma.$disconnect();
});

async function makeCompany(suffix: string, extra: Record<string, unknown> = {}) {
  const company = await pgCreateLocalCompany({
    name: `Empresa Edit ${UID} ${suffix}`,
    slug: slug(suffix),
    status: "active",
    ...extra,
  });
  createdIds.push(company.id);
  return company;
}

describe("Edição de empresa — cenários", () => {

  // ── 1. Editar nome ─────────────────────────────────────────────────────────
  it("edita o nome da empresa e persiste no banco", async () => {
    const company = await makeCompany("nome");
    const novoNome = `Empresa Renomeada ${UID}`;

    const updated = await pgUpdateLocalCompany(company.id, { name: novoNome });

    expect(updated).not.toBeNull();
    expect(updated!.name).toBe(novoNome);

    const row = await prisma.company.findUnique({ where: { id: company.id } });
    expect(row!.name).toBe(novoNome);
    console.log(`\n✅ Nome alterado: "${company.name}" → "${updated!.name}"`);
  });

  // ── 2. Editar status ───────────────────────────────────────────────────────
  it("altera status active → inactive → active", async () => {
    const company = await makeCompany("status");

    const deactivated = await pgUpdateLocalCompany(company.id, { status: "inactive", active: false });
    expect(deactivated!.status).toBe("inactive");
    expect(deactivated!.active).toBe(false);

    const reactivated = await pgUpdateLocalCompany(company.id, { status: "active", active: true });
    expect(reactivated!.status).toBe("active");
    expect(reactivated!.active).toBe(true);

    console.log(`\n✅ Status: active → inactive → active`);
  });

  // ── 3. Editar campos de contato ────────────────────────────────────────────
  it("edita phone, address, website e cep", async () => {
    const company = await makeCompany("contato");

    const updated = await pgUpdateLocalCompany(company.id, {
      phone: "+55 11 99999-0001",
      address: "Rua dos Testes, 123 — Bairro QA",
      website: "https://testing-company.local",
      cep: "01310-100",
    });

    expect(updated!.phone).toBe("+55 11 99999-0001");
    expect(updated!.address).toBe("Rua dos Testes, 123 — Bairro QA");
    expect(updated!.website).toBe("https://testing-company.local");
    expect(updated!.cep).toBe("01310-100");

    const row = await prisma.company.findUnique({ where: { id: company.id } });
    expect(row!.phone).toBe("+55 11 99999-0001");
    expect(row!.cep).toBe("01310-100");
    console.log(`\n✅ Contato editado: phone=${updated!.phone} | cep=${updated!.cep}`);
  });

  // ── 4. Editar tax_id (CNPJ) ────────────────────────────────────────────────
  it("edita o tax_id (CNPJ) da empresa", async () => {
    const company = await makeCompany("cnpj");

    const updated = await pgUpdateLocalCompany(company.id, { tax_id: "12.345.678/0001-99" });

    expect(updated!.tax_id).toBe("12.345.678/0001-99");
    const row = await prisma.company.findUnique({ where: { id: company.id } });
    expect(row!.tax_id).toBe("12.345.678/0001-99");
    console.log(`\n✅ CNPJ editado: ${updated!.tax_id}`);
  });

  // ── 5. Editar descrição e notes ────────────────────────────────────────────
  it("edita short_description e notes", async () => {
    const company = await makeCompany("descricao");

    const updated = await pgUpdateLocalCompany(company.id, {
      short_description: "Empresa de testes automatizados do painel QA",
      notes: "Criada em suite de edição — UID: " + UID,
    });

    expect(updated!.short_description).toBe("Empresa de testes automatizados do painel QA");
    expect(updated!.notes).toContain(UID);
    console.log(`\n✅ Descrição e notes editados`);
  });

  // ── 6. Editar campos de integração ─────────────────────────────────────────
  it("edita campos de integração (jira, qase_project_code)", async () => {
    const company = await makeCompany("integracao");

    const updated = await pgUpdateLocalCompany(company.id, {
      jira_base_url: "https://jira.testing-company.local",
      jira_email: "qa@testing-company.local",
      jira_api_token: "token-abc-123",
      qase_project_code: "TC",
      integration_mode: "jira",
    });

    expect(updated!.jira_base_url).toBe("https://jira.testing-company.local");
    expect(updated!.jira_email).toBe("qa@testing-company.local");
    expect(updated!.qase_project_code).toBe("TC");
    expect(updated!.integration_mode).toBe("jira");
    console.log(`\n✅ Integração editada: jira_base_url=${updated!.jira_base_url} | qase=${updated!.qase_project_code}`);
  });

  // ── 7. Limpar campos opcionais (set null) ──────────────────────────────────
  it("limpa campos opcionais definindo como null", async () => {
    const company = await makeCompany("null-fields", {
      phone: "+55 11 11111-2222",
      website: "https://exemplo.com",
      tax_id: "00.000.000/0001-00",
    });

    const updated = await pgUpdateLocalCompany(company.id, {
      phone: null,
      website: null,
      tax_id: null,
    });

    expect(updated!.phone).toBeNull();
    expect(updated!.website).toBeNull();
    expect(updated!.tax_id).toBeNull();
    console.log(`\n✅ Campos opcionais zerados (null) com sucesso`);
  });

  // ── 8. Retorna null para empresa inexistente ───────────────────────────────
  it("retorna null ao tentar editar empresa com id inexistente", async () => {
    const result = await pgUpdateLocalCompany("id-que-nao-existe-9999", { name: "Fantasma" });
    expect(result).toBeNull();
    console.log(`\n✅ Empresa inexistente → retornou null`);
  });

  // ── 9. Editar linkedin_url ─────────────────────────────────────────────────
  it("edita linkedin_url da empresa", async () => {
    const company = await makeCompany("linkedin");

    const updated = await pgUpdateLocalCompany(company.id, {
      linkedin_url: "https://www.linkedin.com/company/testing-company",
    });

    expect(updated!.linkedin_url).toBe("https://www.linkedin.com/company/testing-company");
    console.log(`\n✅ LinkedIn editado: ${updated!.linkedin_url}`);
  });

  // ── 10. Múltiplos campos em uma única chamada ──────────────────────────────
  it("edita múltiplos campos em uma única operação", async () => {
    const company = await makeCompany("multiplos");

    const updated = await pgUpdateLocalCompany(company.id, {
      name: `Empresa Multi ${UID}`,
      phone: "+55 21 98765-4321",
      website: "https://multi.testing.local",
      short_description: "Multi-field update test",
      status: "active",
      tax_id: "98.765.432/0001-10",
    });

    expect(updated!.name).toBe(`Empresa Multi ${UID}`);
    expect(updated!.phone).toBe("+55 21 98765-4321");
    expect(updated!.website).toBe("https://multi.testing.local");
    expect(updated!.tax_id).toBe("98.765.432/0001-10");
    console.log(`\n✅ Múltiplos campos editados em uma operação`);
  });
});
