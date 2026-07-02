/**
 * Seed: cria empresa Testing Company + perfis reais no banco.
 * âš ï¸  SEM cleanup â€” dados permanecem permanentemente no PostgreSQL.
 *
 * Perfis criados:
 *  - Empresa:             Testing Company
 *  - UsuÃ¡rio Empresa:     usuario.empresa@testing-company.local   (viewer)
 *  - UsuÃ¡rio TC:          usuario.tc@testing-company.local        (viewer)
 *  - LÃ­der TC:            lider.tc@testing-company.local          (company_admin)
 *  - Suporte TÃ©cnico:     suporte.tecnico@testing-company.local   (it_dev / global_admin)
 */

import { prisma } from "@/lib/prismaClient";
import {
  pgCreateLocalCompany,
  pgCreateLocalUser,
  pgUpsertLocalLink,
  pgFindLocalCompanyBySlug,
} from "@/lib/core/auth/pgStore";
import { hashPasswordSha256 } from "@/lib/passwordHash";

const describePg = process.env.DATABASE_URL ? describe : describe.skip;


const PASSWORD = hashPasswordSha256("TC@Teste2026");
const COMPANY_SLUG = "testing-company";

afterAll(async () => {
  await prisma.$disconnect();
});

describePg("Seed â€” Testing Company + perfis de usuÃ¡rio", () => {

  let companyId: string;

  // â”€â”€ Empresa â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it("cria ou reutiliza a empresa Testing Company", async () => {
    const existing = await pgFindLocalCompanyBySlug(COMPANY_SLUG);
    if (existing) {
      companyId = existing.id;
      console.log(`\nâ™»ï¸  Empresa jÃ¡ existe: ${existing.name} | slug: ${existing.slug} | id: ${existing.id}`);
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

    console.log(`\nâœ… Empresa criada: ${company.name} | slug: ${company.slug} | id: ${company.id}`);
  });

  // â”€â”€ UsuÃ¡rio Empresa (viewer) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it("cria UsuÃ¡rio Empresa vinculado como viewer", async () => {
    const email = "usuario.empresa@testing-company.local";
    const existing = await prisma.user.findFirst({ where: { email } });

    let userId: string;
    if (existing) {
      userId = existing.id;
      console.log(`\nâ™»ï¸  UsuÃ¡rio Empresa jÃ¡ existe | id: ${existing.id}`);
    } else {
      const user = await pgCreateLocalUser({
        name: "UsuÃ¡rio Empresa",
        email,
        password_hash: PASSWORD,
        role: "user",
        is_global_admin: false,
        status: "active",
      });
      userId = user.id;
      console.log(`\nâœ… UsuÃ¡rio Empresa criado | email: ${email} | id: ${userId}`);
    }

    const company = await pgFindLocalCompanyBySlug(COMPANY_SLUG);
    if (company) {
      await pgUpsertLocalLink({ userId, companyId: company.id, role: "viewer" });
      const mem = await prisma.membership.findFirst({ where: { userId, companyId: company.id } });
      expect(mem!.role).toBe("viewer");
      console.log(`   membership: viewer â†’ ${COMPANY_SLUG}`);
    }
    expect(userId).toBeTruthy();
  });

  // â”€â”€ UsuÃ¡rio Testing Company (viewer) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it("cria UsuÃ¡rio Testing Company vinculado como viewer", async () => {
    const email = "usuario.tc@testing-company.local";
    const existing = await prisma.user.findFirst({ where: { email } });

    let userId: string;
    if (existing) {
      userId = existing.id;
      console.log(`\nâ™»ï¸  UsuÃ¡rio TC jÃ¡ existe | id: ${existing.id}`);
    } else {
      const user = await pgCreateLocalUser({
        name: "UsuÃ¡rio Testing Company",
        email,
        password_hash: PASSWORD,
        role: "user",
        is_global_admin: false,
        status: "active",
      });
      userId = user.id;
      console.log(`\nâœ… UsuÃ¡rio TC criado | email: ${email} | id: ${userId}`);
    }

    const company = await pgFindLocalCompanyBySlug(COMPANY_SLUG);
    if (company) {
      await pgUpsertLocalLink({ userId, companyId: company.id, role: "viewer" });
      const mem = await prisma.membership.findFirst({ where: { userId, companyId: company.id } });
      expect(mem!.role).toBe("viewer");
      console.log(`   membership: viewer â†’ ${COMPANY_SLUG}`);
    }
    expect(userId).toBeTruthy();
  });

  // â”€â”€ LÃ­der TC (company_admin) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it("cria LÃ­der TC vinculado como company_admin", async () => {
    const email = "lider.tc@testing-company.local";
    const existing = await prisma.user.findFirst({ where: { email } });

    let userId: string;
    if (existing) {
      userId = existing.id;
      console.log(`\nâ™»ï¸  LÃ­der TC jÃ¡ existe | id: ${existing.id}`);
    } else {
      const user = await pgCreateLocalUser({
        name: "LÃ­der TC",
        email,
        password_hash: PASSWORD,
        role: "user",
        is_global_admin: false,
        status: "active",
      });
      userId = user.id;
      console.log(`\nâœ… LÃ­der TC criado | email: ${email} | id: ${userId}`);
    }

    const company = await pgFindLocalCompanyBySlug(COMPANY_SLUG);
    if (company) {
      await pgUpsertLocalLink({ userId, companyId: company.id, role: "company_admin" });
      const mem = await prisma.membership.findFirst({ where: { userId, companyId: company.id } });
      expect(mem!.role).toBe("company_admin");
      console.log(`   membership: company_admin â†’ ${COMPANY_SLUG}`);
    }
    expect(userId).toBeTruthy();
  });

  // â”€â”€ Suporte TÃ©cnico (it_dev + global_admin) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it("cria Suporte TÃ©cnico com role it_dev e global_admin", async () => {
    const email = "suporte.tecnico@testing-company.local";
    const existing = await prisma.user.findFirst({ where: { email } });

    let userId: string;
    if (existing) {
      userId = existing.id;
      console.log(`\nâ™»ï¸  Suporte TÃ©cnico jÃ¡ existe | id: ${existing.id}`);
    } else {
      const user = await pgCreateLocalUser({
        name: "Suporte TÃ©cnico",
        email,
        password_hash: PASSWORD,
        role: "it_dev",
        globalRole: "global_admin",
        is_global_admin: true,
        status: "active",
      });
      userId = user.id;
      console.log(`\nâœ… Suporte TÃ©cnico criado | email: ${email} | role: it_dev | id: ${userId}`);
    }

    const row = await prisma.user.findUnique({ where: { id: userId } });
    expect(row).not.toBeNull();

    const company = await pgFindLocalCompanyBySlug(COMPANY_SLUG);
    if (company) {
      await pgUpsertLocalLink({ userId, companyId: company.id, role: "it_dev" });
      const mem = await prisma.membership.findFirst({ where: { userId, companyId: company.id } });
      expect(mem!.role).toBe("it_dev");
      console.log(`   membership: it_dev â†’ ${COMPANY_SLUG}`);
    }
    expect(userId).toBeTruthy();
  });

  // â”€â”€ VerificaÃ§Ã£o final â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    console.log(`\nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•`);
    console.log(`  BANCO â€” Testing Company`);
    console.log(`  Empresa:  ${company?.name ?? "NÃƒO ENCONTRADA"} (${company?.slug ?? "-"})`);
    console.log(`  UsuÃ¡rios: ${users.length}`);
    users.forEach(u => console.log(`    - ${u.email} | ${u.role} | admin:${u.is_global_admin}`));
    console.log(`  Memberships na empresa: ${memberships.length}`);
    memberships.forEach(m => console.log(`    - ${m.user.email} â†’ ${m.role}`));
    console.log(`â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•`);

    expect(company).not.toBeNull();
    expect(users.length).toBeGreaterThanOrEqual(4);
    expect(memberships.length).toBeGreaterThanOrEqual(4);
  });

});

