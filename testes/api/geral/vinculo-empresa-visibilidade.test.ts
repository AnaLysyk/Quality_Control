/**
 * Testes: vincular usuÃ¡rio a empresa e testar visibilidade
 *
 * CenÃ¡rios:
 *  1. Vincular usuÃ¡rio como viewer â†’ listLocalLinksForUser retorna membership
 *  2. Vincular usuÃ¡rio como company_admin â†’ role normalizado corretamente
 *  3. Vincular usuÃ¡rio como it_dev â†’ role it_dev confirmado
 *  4. resolveUserCompanies retorna empresa vinculada com dados completos
 *  5. UsuÃ¡rio sem vÃ­nculo nÃ£o vÃª nenhuma empresa (visibilidade zero)
 *  6. Desvincular usuÃ¡rio â†’ links vazios, empresa some da visibilidade
 *  7. listLocalLinksForCompany lista todos os membros da empresa
 *  8. Dois usuÃ¡rios vinculados Ã  mesma empresa â†’ company enxerga ambos
 *  9. Atualizar role via upsert (viewer â†’ company_admin)
 * 10. VÃ­nculo com capabilities personalizadas
 * 11. UsuÃ¡rio vinculado a mÃºltiplas empresas â†’ resolveUserCompanies retorna todas
 * 12. Remover vÃ­nculo de uma empresa, manter a outra
 */

jest.setTimeout(30000);

import { randomUUID } from "crypto";
import { prisma } from "@/lib/prismaClient";
import { describeDb } from "../../../support/functions/banco-de-dados/descrever-banco";
import {
  upsertLocalLink,
  removeLocalLink,
  listLocalLinksForUser,
  listLocalLinksForCompany,
  resolveUserCompanies,
  createLocalUser,
  createLocalCompany,
} from "@/lib/core/auth/localStore";

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function uid() {
  return randomUUID().slice(0, 8);
}

async function makeUser(suffix: string) {
  const tag = `${suffix}-${uid()}`;
  return createLocalUser({
    name: `UsuÃ¡rio ${tag}`,
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

// â”€â”€ Cleanup state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const createdUserIds: string[] = [];
const createdCompanyIds: string[] = [];

afterAll(async () => {
  await prisma.membership.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.company.deleteMany({ where: { id: { in: createdCompanyIds } } });
  await prisma.$disconnect();
}, 30000);

// â”€â”€ Testes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describeDb("Vincular usuÃ¡rio a empresa e visibilidade", () => {
  // â”€â”€ CenÃ¡rio 1: vincular como viewer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  test("1. Vincular usuÃ¡rio como viewer â†’ membership retornada", async () => {
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

    console.log(`âœ… CenÃ¡rio 1 | user=${user.email} vinculado como viewer | companyId=${company.id}`);
  });

  // â”€â”€ CenÃ¡rio 2: vincular como company_admin â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  test("2. Vincular usuÃ¡rio como company_admin â†’ role normalizado", async () => {
    const user = await makeUser("cadmin");
    const company = await makeCompany("cadmin");
    createdUserIds.push(user.id);
    createdCompanyIds.push(company.id);

    const role = await upsertLocalLink({ userId: user.id, companyId: company.id, role: "company_admin" });
    expect(role).toBe("company_admin");

    const links = await listLocalLinksForUser(user.id);
    expect(links[0].role).toBe("company_admin");

    console.log(`âœ… CenÃ¡rio 2 | user=${user.email} vinculado como company_admin`);
  });

  // â”€â”€ CenÃ¡rio 3: vincular como it_dev â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  test("3. Vincular usuÃ¡rio como it_dev â†’ role it_dev confirmado", async () => {
    const user = await makeUser("itdev");
    const company = await makeCompany("itdev");
    createdUserIds.push(user.id);
    createdCompanyIds.push(company.id);

    const role = await upsertLocalLink({ userId: user.id, companyId: company.id, role: "it_dev" });
    expect(role).toBe("it_dev");

    const links = await listLocalLinksForUser(user.id);
    expect(links[0].role).toBe("it_dev");

    console.log(`âœ… CenÃ¡rio 3 | user=${user.email} vinculado como it_dev`);
  });

  // â”€â”€ CenÃ¡rio 4: resolveUserCompanies retorna empresa â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    console.log(`âœ… CenÃ¡rio 4 | resolveUserCompanies retornou empresa=${resolved[0].company?.slug}`);
  });

  // â”€â”€ CenÃ¡rio 5: usuÃ¡rio sem vÃ­nculo nÃ£o vÃª empresa â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  test("5. UsuÃ¡rio sem vÃ­nculo â†’ resolveUserCompanies vazio (visibilidade zero)", async () => {
    const user = await makeUser("semvinculo");
    createdUserIds.push(user.id);

    const links = await listLocalLinksForUser(user.id);
    expect(links).toHaveLength(0);

    const resolved = await resolveUserCompanies(user.id);
    expect(resolved).toHaveLength(0);

    console.log(`âœ… CenÃ¡rio 5 | user=${user.email} sem vÃ­nculo â†’ nenhuma empresa visÃ­vel`);
  });

  // â”€â”€ CenÃ¡rio 6: desvincular â†’ links vazios, empresa some da visibilidade â”€â”€â”€â”€
  test("6. Desvincular usuÃ¡rio â†’ links vazios, empresa some da visibilidade", async () => {
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

    console.log(`âœ… CenÃ¡rio 6 | user=${user.email} desvinculado â†’ 0 empresas visÃ­veis`);
  });

  // â”€â”€ CenÃ¡rio 7: listLocalLinksForCompany lista membros â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  test("7. listLocalLinksForCompany lista todos os membros da empresa", async () => {
    const userA = await makeUser("membro-a");
    const userB = await makeUser("membro-b");
    const company = await makeCompany("membros");
    createdUserIds.push(userA.id, userB.id);
    createdCompanyIds.push(company.id);

    await upsertLocalLink({ userId: userA.id, companyId: company.id, role: "viewer" });
    await upsertLocalLink({ userId: userB.id, companyId: company.id, role: "company_admin" });

    const members = await listLocalLinksForCompany(company.id);
    // Filtra sÃ³ os criados neste teste (pode haver outros na empresa se houver colisÃ£o de companyId)
    const testMembers = members.filter((m) => m.userId === userA.id || m.userId === userB.id);
    expect(testMembers).toHaveLength(2);

    const memberIds = testMembers.map((m) => m.userId);
    expect(memberIds).toContain(userA.id);
    expect(memberIds).toContain(userB.id);

    console.log(`âœ… CenÃ¡rio 7 | empresa ${company.slug} tem ${testMembers.length} membros: viewer + company_admin`);
  });

  // â”€â”€ CenÃ¡rio 8: dois usuÃ¡rios vinculados Ã  mesma empresa â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  test("8. Dois usuÃ¡rios vinculados Ã  mesma empresa â†’ ambos visualizam a empresa", async () => {
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

    console.log(`âœ… CenÃ¡rio 8 | empresa ${company.slug} visÃ­vel para userA e userB`);
  });

  // â”€â”€ CenÃ¡rio 9: atualizar role via upsert â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  test("9. Atualizar role via upsert (viewer â†’ company_admin)", async () => {
    const user = await makeUser("upgrade");
    const company = await makeCompany("upgrade");
    createdUserIds.push(user.id);
    createdCompanyIds.push(company.id);

    await upsertLocalLink({ userId: user.id, companyId: company.id, role: "viewer" });
    const before = await listLocalLinksForUser(user.id);
    expect(before[0].role).toBe("viewer");

    await upsertLocalLink({ userId: user.id, companyId: company.id, role: "company_admin" });
    const after = await listLocalLinksForUser(user.id);
    expect(after).toHaveLength(1); // upsert nÃ£o duplica
    expect(after[0].role).toBe("company_admin");

    console.log(`âœ… CenÃ¡rio 9 | role atualizado: viewer â†’ company_admin (sem duplicar membership)`);
  });

  // â”€â”€ CenÃ¡rio 10: vÃ­nculo com capabilities personalizadas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  test("10. VÃ­nculo com capabilities personalizadas â†’ capabilities persistidas", async () => {
    const user = await makeUser("caps");
    const company = await makeCompany("caps");
    createdUserIds.push(user.id);
    createdCompanyIds.push(company.id);

    const caps = ["view_reports", "export_data", "manage_releases"];
    await upsertLocalLink({ userId: user.id, companyId: company.id, role: "viewer", capabilities: caps });

    const links = await listLocalLinksForUser(user.id);
    expect(links).toHaveLength(1);
    expect(links[0].capabilities).toEqual(expect.arrayContaining(caps));

    console.log(`âœ… CenÃ¡rio 10 | capabilities=${caps.join(",")} persistidas no vÃ­nculo`);
  });

  // â”€â”€ CenÃ¡rio 11: usuÃ¡rio vinculado a mÃºltiplas empresas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  test("11. UsuÃ¡rio vinculado a mÃºltiplas empresas â†’ resolveUserCompanies retorna todas", async () => {
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

    console.log(`âœ… CenÃ¡rio 11 | user vinculado a 3 empresas â†’ resolveUserCompanies retornou ${resolved.length} (>= 3)`);
  });

  // â”€â”€ CenÃ¡rio 12: remover vÃ­nculo de uma empresa, manter a outra â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  test("12. Remover vÃ­nculo de uma empresa mantÃ©m vÃ­nculo nas demais", async () => {
    const user = await makeUser("parcial");
    const companyA = await makeCompany("parcial-a");
    const companyB = await makeCompany("parcial-b");
    createdUserIds.push(user.id);
    createdCompanyIds.push(companyA.id, companyB.id);

    await upsertLocalLink({ userId: user.id, companyId: companyA.id, role: "viewer" });
    await upsertLocalLink({ userId: user.id, companyId: companyB.id, role: "viewer" });

    const before = await listLocalLinksForUser(user.id);
    expect(before.length).toBeGreaterThanOrEqual(2);

    // Remove apenas o vÃ­nculo com companyA
    const removed = await removeLocalLink(user.id, companyA.id);
    expect(removed).toBe(true);

    const after = await listLocalLinksForUser(user.id);
    const afterIds = after.map((l) => l.companyId);
    expect(afterIds).not.toContain(companyA.id);
    expect(afterIds).toContain(companyB.id);

    const resolved = await resolveUserCompanies(user.id);
    expect(resolved.some((r) => r.company?.id === companyA.id)).toBe(false);
    expect(resolved.some((r) => r.company?.id === companyB.id)).toBe(true);

    console.log(`âœ… CenÃ¡rio 12 | vÃ­nculo com companyA removido | companyB mantida na visibilidade`);
  });
});

