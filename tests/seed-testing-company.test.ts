/**
 * Seed: cria empresa Testing Company + perfis reais no banco.
 * ⚠️  SEM cleanup — dados permanecem permanentemente no PostgreSQL.
 *
 * Perfis criados:
 *  - Empresa:             Testing Company
 *  - Usuário Empresa:     usuario.empresa@testing-company.local   (viewer)
 *  - Usuário TC:          usuario.tc@testing-company.local        (viewer)
 *  - Líder TC:            lider.tc@testing-company.local          (company_admin)
 *  - Suporte Técnico:     suporte.tecnico@testing-company.local   (it_dev / global_admin)
 */

import { prisma } from "../lib/prismaClient";
import {
  pgCreateLocalCompany,
  pgCreateLocalUser,
  pgUpsertLocalLink,
  pgFindLocalCompanyBySlug,
} from "../src/core/auth/pgStore";
import { hashPasswordSha256 } from "../lib/passwordHash";

const PASSWORD = hashPasswordSha256("TC@Teste2026");
const COMPANY_SLUG = "testing-company";

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Seed — Testing Company + perfis de usuário", () => {

  let companyId: string;

  // ── Empresa ───────────────────────────────────────────────────────────────
  it("cria ou reutiliza a empresa Testing Company", async () => {
    const existing = await pgFindLocalCompanyBySlug(COMPANY_SLUG);
    if (existing) {
      companyId = existing.id;
      console.log(`\n♻️  Empresa já existe: ${existing.name} | slug: ${existing.slug} | id: ${existing.id}`);
      return;
    }

    const company = await pgCreateLocalCompany({
      name: "Testing Company",
      slug: COMPANY_SLUG,
      status: "active",
      short_description: "Empresa principal de testes do painel QA",
      notes: "Criada via seed automatizado",
    });
    companyId = company.id;

    const row = await prisma.company.findUnique({ where: { id: companyId } });
    expect(row).not.toBeNull();
    expect(row!.slug).toBe(COMPANY_SLUG);

    console.log(`\n✅ Empresa criada: ${company.name} | slug: ${company.slug} | id: ${company.id}`);
  });

  // ── Usuário Empresa (viewer) ───────────────────────────────────────────────
  it("cria Usuário Empresa vinculado como viewer", async () => {
    const email = "usuario.empresa@testing-company.local";
    const existing = await prisma.user.findFirst({ where: { email } });

    let userId: string;
    if (existing) {
      userId = existing.id;
      console.log(`\n♻️  Usuário Empresa já existe | id: ${existing.id}`);
    } else {
      const user = await pgCreateLocalUser({
        name: "Usuário Empresa",
        email,
        password_hash: PASSWORD,
        role: "user",
        is_global_admin: false,
        status: "active",
      });
      userId = user.id;
      console.log(`\n✅ Usuário Empresa criado | email: ${email} | id: ${userId}`);
    }

    const company = await pgFindLocalCompanyBySlug(COMPANY_SLUG);
    if (company) {
      await pgUpsertLocalLink({ userId, companyId: company.id, role: "viewer" });
      const mem = await prisma.membership.findFirst({ where: { userId, companyId: company.id } });
      expect(mem!.role).toBe("viewer");
      console.log(`   membership: viewer → ${COMPANY_SLUG}`);
    }
    expect(userId).toBeTruthy();
  });

  // ── Usuário Testing Company (viewer) ──────────────────────────────────────
  it("cria Usuário Testing Company vinculado como viewer", async () => {
    const email = "usuario.tc@testing-company.local";
    const existing = await prisma.user.findFirst({ where: { email } });

    let userId: string;
    if (existing) {
      userId = existing.id;
      console.log(`\n♻️  Usuário TC já existe | id: ${existing.id}`);
    } else {
      const user = await pgCreateLocalUser({
        name: "Usuário Testing Company",
        email,
        password_hash: PASSWORD,
        role: "user",
        is_global_admin: false,
        status: "active",
      });
      userId = user.id;
      console.log(`\n✅ Usuário TC criado | email: ${email} | id: ${userId}`);
    }

    const company = await pgFindLocalCompanyBySlug(COMPANY_SLUG);
    if (company) {
      await pgUpsertLocalLink({ userId, companyId: company.id, role: "viewer" });
      const mem = await prisma.membership.findFirst({ where: { userId, companyId: company.id } });
      expect(mem!.role).toBe("viewer");
      console.log(`   membership: viewer → ${COMPANY_SLUG}`);
    }
    expect(userId).toBeTruthy();
  });

  // ── Líder TC (company_admin) ──────────────────────────────────────────────
  it("cria Líder TC vinculado como company_admin", async () => {
    const email = "lider.tc@testing-company.local";
    const existing = await prisma.user.findFirst({ where: { email } });

    let userId: string;
    if (existing) {
      userId = existing.id;
      console.log(`\n♻️  Líder TC já existe | id: ${existing.id}`);
    } else {
      const user = await pgCreateLocalUser({
        name: "Líder TC",
        email,
        password_hash: PASSWORD,
        role: "user",
        is_global_admin: false,
        status: "active",
      });
      userId = user.id;
      console.log(`\n✅ Líder TC criado | email: ${email} | id: ${userId}`);
    }

    const company = await pgFindLocalCompanyBySlug(COMPANY_SLUG);
    if (company) {
      await pgUpsertLocalLink({ userId, companyId: company.id, role: "company_admin" });
      const mem = await prisma.membership.findFirst({ where: { userId, companyId: company.id } });
      expect(mem!.role).toBe("company_admin");
      console.log(`   membership: company_admin → ${COMPANY_SLUG}`);
    }
    expect(userId).toBeTruthy();
  });

  // ── Suporte Técnico (it_dev + global_admin) ───────────────────────────────
  it("cria Suporte Técnico com role it_dev e global_admin", async () => {
    const email = "suporte.tecnico@testing-company.local";
    const existing = await prisma.user.findFirst({ where: { email } });

    let userId: string;
    if (existing) {
      userId = existing.id;
      console.log(`\n♻️  Suporte Técnico já existe | id: ${existing.id}`);
    } else {
      const user = await pgCreateLocalUser({
        name: "Suporte Técnico",
        email,
        password_hash: PASSWORD,
        role: "it_dev",
        globalRole: "global_admin",
        is_global_admin: true,
        status: "active",
      });
      userId = user.id;
      console.log(`\n✅ Suporte Técnico criado | email: ${email} | role: it_dev | id: ${userId}`);
    }

    const row = await prisma.user.findUnique({ where: { id: userId } });
    expect(row).not.toBeNull();

    const company = await pgFindLocalCompanyBySlug(COMPANY_SLUG);
    if (company) {
      await pgUpsertLocalLink({ userId, companyId: company.id, role: "it_dev" });
      const mem = await prisma.membership.findFirst({ where: { userId, companyId: company.id } });
      expect(mem!.role).toBe("it_dev");
      console.log(`   membership: it_dev → ${COMPANY_SLUG}`);
    }
    expect(userId).toBeTruthy();
  });

  // ── Verificação final ─────────────────────────────────────────────────────
  it("confirma todos os registros no banco", async () => {
    const users = await prisma.user.findMany({
      where: { email: { contains: "@testing-company.local" } },
      select: { email: true, role: true, is_global_admin: true, status: true },
    });
    const company = await prisma.company.findUnique({ where: { slug: COMPANY_SLUG } });
    const memberships = company
      ? await prisma.membership.findMany({
          where: { companyId: company.id },
          include: { user: { select: { email: true } } },
        })
      : [];

    console.log(`\n═══════════════════════════════════════`);
    console.log(`  BANCO — Testing Company`);
    console.log(`  Empresa:  ${company?.name ?? "NÃO ENCONTRADA"} (${company?.slug ?? "-"})`);
    console.log(`  Usuários: ${users.length}`);
    users.forEach(u => console.log(`    - ${u.email} | ${u.role} | admin:${u.is_global_admin}`));
    console.log(`  Memberships na empresa: ${memberships.length}`);
    memberships.forEach(m => console.log(`    - ${m.user.email} → ${m.role}`));
    console.log(`═══════════════════════════════════════`);

    expect(company).not.toBeNull();
    expect(users.length).toBeGreaterThanOrEqual(4);
    expect(memberships.length).toBeGreaterThanOrEqual(4);
  });

});
