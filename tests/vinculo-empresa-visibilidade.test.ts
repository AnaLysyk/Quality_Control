/**
 * Testes: vincular usuário a empresa e testar visibilidade
 *
 * Cenários:
 *  1. Vincular usuário como viewer → listLocalLinksForUser retorna membership
 *  2. Vincular usuário como company_admin → role normalizado corretamente
 *  3. Vincular usuário como it_dev → role it_dev confirmado
 *  4. resolveUserCompanies retorna empresa vinculada com dados completos
 *  5. Usuário sem vínculo não vê nenhuma empresa (visibilidade zero)
 *  6. Desvincular usuário → links vazios, empresa some da visibilidade
 *  7. listLocalLinksForCompany lista todos os membros da empresa
 *  8. Dois usuários vinculados à mesma empresa → company enxerga ambos
 *  9. Atualizar role via upsert (viewer → company_admin)
 * 10. Vínculo com capabilities personalizadas
 * 11. Usuário vinculado a múltiplas empresas → resolveUserCompanies retorna todas
 * 12. Remover vínculo de uma empresa, manter a outra
 */

jest.setTimeout(30000);

import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";

import {
  upsertLocalLink,
  removeLocalLink,
  listLocalLinksForUser,
  listLocalLinksForCompany,
  resolveUserCompanies,
  createLocalUser,
  createLocalCompany,
} from "../lib/core/auth/localStore";

const prisma = new PrismaClient();

// ── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return randomUUID().slice(0, 8);
}

async function makeUser(suffix: string) {
  const tag = `${suffix}-${uid()}`;
  return createLocalUser({
    name: `Usuário ${tag}`,
    email: `usuario.${tag}@vinculo-test.local`,
    user: `usuario.${tag}`,
    password_hash: "hash-test",
    active: true,
    role: "user",
  });
}

async function makeCompany(suffix: string) {
  const tag = `${suffix}-${uid()}`;
  return createLocalCompany({
    name: `Empresa ${tag}`,
    slug: `empresa-${tag}`,
    status: "active",
  });
}

// ── Cleanup state ─────────────────────────────────────────────────────────────

const createdUserIds: string[] = [];
const createdCompanyIds: string[] = [];

afterAll(async () => {
  await prisma.membership.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.company.deleteMany({ where: { id: { in: createdCompanyIds } } });
  await prisma.$disconnect();
}, 30000);

// ── Testes ────────────────────────────────────────────────────────────────────

describe("Vincular usuário a empresa e visibilidade", () => {
  // ── Cenário 1: vincular como viewer ────────────────────────────────────────
  test("1. Vincular usuário como viewer → membership retornada", async () => {
    const user = await makeUser("viewer");
    const company = await makeCompany("viewer");
    createdUserIds.push(user.id);
    createdCompanyIds.push(company.id);

    const role = await upsertLocalLink({ userId: user.id, companyId: company.id, role: "viewer" });
    expect(role).toBe("viewer");

    const links = await listLocalLinksForUser(user.id);
    expect(links).toHaveLength(1);
    expect(links[0].companyId).toBe(company.id);
    expect(links[0].role).toBe("viewer");

    console.log(`✅ Cenário 1 | user=${user.email} vinculado como viewer | companyId=${company.id}`);
  });

  // ── Cenário 2: vincular como company_admin ─────────────────────────────────
  test("2. Vincular usuário como company_admin → role normalizado", async () => {
    const user = await makeUser("cadmin");
    const company = await makeCompany("cadmin");
    createdUserIds.push(user.id);
    createdCompanyIds.push(company.id);

    const role = await upsertLocalLink({ userId: user.id, companyId: company.id, role: "company_admin" });
    expect(role).toBe("company_admin");

    const links = await listLocalLinksForUser(user.id);
    expect(links[0].role).toBe("company_admin");

    console.log(`✅ Cenário 2 | user=${user.email} vinculado como company_admin`);
  });

  // ── Cenário 3: vincular como it_dev ───────────────────────────────────────
  test("3. Vincular usuário como it_dev → role it_dev confirmado", async () => {
    const user = await makeUser("itdev");
    const company = await makeCompany("itdev");
    createdUserIds.push(user.id);
    createdCompanyIds.push(company.id);

    const role = await upsertLocalLink({ userId: user.id, companyId: company.id, role: "it_dev" });
    expect(role).toBe("it_dev");

    const links = await listLocalLinksForUser(user.id);
    expect(links[0].role).toBe("it_dev");

    console.log(`✅ Cenário 3 | user=${user.email} vinculado como it_dev`);
  });

  // ── Cenário 4: resolveUserCompanies retorna empresa ────────────────────────
  test("4. resolveUserCompanies retorna empresa vinculada com dados completos", async () => {
    const user = await makeUser("resolve");
    const company = await makeCompany("resolve");
    createdUserIds.push(user.id);
    createdCompanyIds.push(company.id);

    await upsertLocalLink({ userId: user.id, companyId: company.id, role: "viewer" });

    const resolved = await resolveUserCompanies(user.id);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].company?.id).toBe(company.id);
    expect(resolved[0].company?.slug).toContain("empresa-");
    expect(resolved[0].link.role).toBe("viewer");

    console.log(`✅ Cenário 4 | resolveUserCompanies retornou empresa=${resolved[0].company?.slug}`);
  });

  // ── Cenário 5: usuário sem vínculo não vê empresa ─────────────────────────
  test("5. Usuário sem vínculo → resolveUserCompanies vazio (visibilidade zero)", async () => {
    const user = await makeUser("semvinculo");
    createdUserIds.push(user.id);

    const links = await listLocalLinksForUser(user.id);
    expect(links).toHaveLength(0);

    const resolved = await resolveUserCompanies(user.id);
    expect(resolved).toHaveLength(0);

    console.log(`✅ Cenário 5 | user=${user.email} sem vínculo → nenhuma empresa visível`);
  });

  // ── Cenário 6: desvincular → links vazios, empresa some da visibilidade ────
  test("6. Desvincular usuário → links vazios, empresa some da visibilidade", async () => {
    const user = await makeUser("desvincular");
    const company = await makeCompany("desvincular");
    createdUserIds.push(user.id);
    createdCompanyIds.push(company.id);

    await upsertLocalLink({ userId: user.id, companyId: company.id, role: "viewer" });
    const beforeLinks = await listLocalLinksForUser(user.id);
    expect(beforeLinks).toHaveLength(1);

    const removed = await removeLocalLink(user.id, company.id);
    expect(removed).toBe(true);

    const afterLinks = await listLocalLinksForUser(user.id);
    expect(afterLinks).toHaveLength(0);

    const resolved = await resolveUserCompanies(user.id);
    expect(resolved).toHaveLength(0);

    console.log(`✅ Cenário 6 | user=${user.email} desvinculado → 0 empresas visíveis`);
  });

  // ── Cenário 7: listLocalLinksForCompany lista membros ─────────────────────
  test("7. listLocalLinksForCompany lista todos os membros da empresa", async () => {
    const userA = await makeUser("membro-a");
    const userB = await makeUser("membro-b");
    const company = await makeCompany("membros");
    createdUserIds.push(userA.id, userB.id);
    createdCompanyIds.push(company.id);

    await upsertLocalLink({ userId: userA.id, companyId: company.id, role: "viewer" });
    await upsertLocalLink({ userId: userB.id, companyId: company.id, role: "company_admin" });

    const members = await listLocalLinksForCompany(company.id);
    // Filtra só os criados neste teste (pode haver outros na empresa se houver colisão de companyId)
    const testMembers = members.filter((m) => m.userId === userA.id || m.userId === userB.id);
    expect(testMembers).toHaveLength(2);

    const memberIds = testMembers.map((m) => m.userId);
    expect(memberIds).toContain(userA.id);
    expect(memberIds).toContain(userB.id);

    console.log(`✅ Cenário 7 | empresa ${company.slug} tem ${testMembers.length} membros: viewer + company_admin`);
  });

  // ── Cenário 8: dois usuários vinculados à mesma empresa ───────────────────
  test("8. Dois usuários vinculados à mesma empresa → ambos visualizam a empresa", async () => {
    const userA = await makeUser("dual-a");
    const userB = await makeUser("dual-b");
    const company = await makeCompany("dual");
    createdUserIds.push(userA.id, userB.id);
    createdCompanyIds.push(company.id);

    await upsertLocalLink({ userId: userA.id, companyId: company.id, role: "viewer" });
    await upsertLocalLink({ userId: userB.id, companyId: company.id, role: "viewer" });

    const resolvedA = await resolveUserCompanies(userA.id);
    const resolvedB = await resolveUserCompanies(userB.id);

    expect(resolvedA.some((r) => r.company?.id === company.id)).toBe(true);
    expect(resolvedB.some((r) => r.company?.id === company.id)).toBe(true);

    console.log(`✅ Cenário 8 | empresa ${company.slug} visível para userA e userB`);
  });

  // ── Cenário 9: atualizar role via upsert ──────────────────────────────────
  test("9. Atualizar role via upsert (viewer → company_admin)", async () => {
    const user = await makeUser("upgrade");
    const company = await makeCompany("upgrade");
    createdUserIds.push(user.id);
    createdCompanyIds.push(company.id);

    await upsertLocalLink({ userId: user.id, companyId: company.id, role: "viewer" });
    const before = await listLocalLinksForUser(user.id);
    expect(before[0].role).toBe("viewer");

    await upsertLocalLink({ userId: user.id, companyId: company.id, role: "company_admin" });
    const after = await listLocalLinksForUser(user.id);
    expect(after).toHaveLength(1); // upsert não duplica
    expect(after[0].role).toBe("company_admin");

    console.log(`✅ Cenário 9 | role atualizado: viewer → company_admin (sem duplicar membership)`);
  });

  // ── Cenário 10: vínculo com capabilities personalizadas ───────────────────
  test("10. Vínculo com capabilities personalizadas → capabilities persistidas", async () => {
    const user = await makeUser("caps");
    const company = await makeCompany("caps");
    createdUserIds.push(user.id);
    createdCompanyIds.push(company.id);

    const caps = ["view_reports", "export_data", "manage_releases"];
    await upsertLocalLink({ userId: user.id, companyId: company.id, role: "viewer", capabilities: caps });

    const links = await listLocalLinksForUser(user.id);
    expect(links).toHaveLength(1);
    expect(links[0].capabilities).toEqual(expect.arrayContaining(caps));

    console.log(`✅ Cenário 10 | capabilities=${caps.join(",")} persistidas no vínculo`);
  });

  // ── Cenário 11: usuário vinculado a múltiplas empresas ────────────────────
  test("11. Usuário vinculado a múltiplas empresas → resolveUserCompanies retorna todas", async () => {
    const user = await makeUser("multi");
    const companyA = await makeCompany("multi-a");
    const companyB = await makeCompany("multi-b");
    const companyC = await makeCompany("multi-c");
    createdUserIds.push(user.id);
    createdCompanyIds.push(companyA.id, companyB.id, companyC.id);

    await upsertLocalLink({ userId: user.id, companyId: companyA.id, role: "viewer" });
    await upsertLocalLink({ userId: user.id, companyId: companyB.id, role: "company_admin" });
    await upsertLocalLink({ userId: user.id, companyId: companyC.id, role: "it_dev" });

    const resolved = await resolveUserCompanies(user.id);
    const resolvedIds = resolved.map((r) => r.company?.id);
    expect(resolvedIds).toContain(companyA.id);
    expect(resolvedIds).toContain(companyB.id);
    expect(resolvedIds).toContain(companyC.id);

    const links = await listLocalLinksForUser(user.id);
    expect(links.length).toBeGreaterThanOrEqual(3);

    console.log(`✅ Cenário 11 | user vinculado a 3 empresas → resolveUserCompanies retornou ${resolved.length} (>= 3)`);
  });

  // ── Cenário 12: remover vínculo de uma empresa, manter a outra ────────────
  test("12. Remover vínculo de uma empresa mantém vínculo nas demais", async () => {
    const user = await makeUser("parcial");
    const companyA = await makeCompany("parcial-a");
    const companyB = await makeCompany("parcial-b");
    createdUserIds.push(user.id);
    createdCompanyIds.push(companyA.id, companyB.id);

    await upsertLocalLink({ userId: user.id, companyId: companyA.id, role: "viewer" });
    await upsertLocalLink({ userId: user.id, companyId: companyB.id, role: "viewer" });

    const before = await listLocalLinksForUser(user.id);
    expect(before.length).toBeGreaterThanOrEqual(2);

    // Remove apenas o vínculo com companyA
    const removed = await removeLocalLink(user.id, companyA.id);
    expect(removed).toBe(true);

    const after = await listLocalLinksForUser(user.id);
    const afterIds = after.map((l) => l.companyId);
    expect(afterIds).not.toContain(companyA.id);
    expect(afterIds).toContain(companyB.id);

    const resolved = await resolveUserCompanies(user.id);
    expect(resolved.some((r) => r.company?.id === companyA.id)).toBe(false);
    expect(resolved.some((r) => r.company?.id === companyB.id)).toBe(true);

    console.log(`✅ Cenário 12 | vínculo com companyA removido | companyB mantida na visibilidade`);
  });
});
