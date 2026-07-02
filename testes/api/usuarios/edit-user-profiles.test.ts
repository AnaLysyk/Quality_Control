/**
 * CenÃ¡rios de ediÃ§Ã£o de usuÃ¡rio por tipo de perfil no PostgreSQL.
 * âœ… cleanup total em afterAll â€” nenhum dado permanece.
 *
 * Perfis cobertos:
 *  1. Regular    â€” edita nome, email, phone
 *  2. IT Dev     â€” edita job_title, linkedin_url
 *  3. Admin Global â€” altera is_global_admin e globalRole
 *  4. Viewer     â€” promove membership viewer â†’ company_admin
 *  5. CompAdmin  â€” desativa conta (active=false / status=blocked)
 *  6. Convidado  â€” ativa conta (status invited â†’ active)
 *  7. MudanÃ§a de role de usuÃ¡rio (user â†’ it_dev)
 *  8. Rejeitar e-mail duplicado na ediÃ§Ã£o
 *  9. Retornar null para usuÃ¡rio inexistente
 * 10. Editar mÃºltiplos campos em uma operaÃ§Ã£o
 */

import { prisma } from "@/lib/prismaClient";
import {
  pgCreateLocalUser,
  pgUpdateLocalUser,
  pgCreateLocalCompany,
  pgDeleteLocalCompany,
  pgUpsertLocalLink,
} from "@/lib/core/auth/pgStore";
import { hashPasswordSha256 } from "@/lib/passwordHash";

const describePg = process.env.DATABASE_URL ? describe : describe.skip;



const PASSWORD = hashPasswordSha256("TC@Teste2026");
const UID = Math.random().toString(36).slice(2, 10);
const email = (tag: string) => `edit-${tag}-${UID}@edit-perfil.local`;

const createdUserIds: string[] = [];
const createdCompanyIds: string[] = [];

afterAll(async () => {
  await prisma.membership.deleteMany({ where: { userId: { in: createdUserIds } } }).catch(() => null);
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => null);
  for (const id of createdCompanyIds) {
    await pgDeleteLocalCompany(id).catch(() => null);
  }
  await prisma.$disconnect();
});

async function makeUser(tag: string, overrides: Record<string, unknown> = {}) {
  const user = await pgCreateLocalUser({
    name: `Edit ${tag} ${UID}`,
    email: email(tag),
    password_hash: PASSWORD,
    role: "user",
    is_global_admin: false,
    status: "active",
    ...overrides,
  });
  createdUserIds.push(user.id);
  return user;
}

describePg("EdiÃ§Ã£o de usuÃ¡rio â€” por tipo de perfil", () => {

  // â”€â”€ 1. Regular â€” edita nome, email, phone â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it("Regular: edita nome, email e telefone", async () => {
    const user = await makeUser("regular");

    const updated = await pgUpdateLocalUser(user.id, {
      name: `Regular Editado ${UID}`,
      email: email("regular-novo"),
      phone: "+55 11 91234-5678",
    });

    expect(updated).not.toBeNull();
    expect(updated!.name).toBe(`Regular Editado ${UID}`);
    expect(updated!.email).toBe(email("regular-novo"));
    expect(updated!.phone).toBe("+55 11 91234-5678");

    const row = await prisma.user.findUnique({ where: { id: user.id } });
    expect(row!.email).toBe(email("regular-novo"));
    console.log(`\nâœ… Regular: nome="${updated!.name}" | email=${updated!.email} | phone=${updated!.phone}`);
  });

  // â”€â”€ 2. IT Dev â€” edita job_title e linkedin_url â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it("IT Dev: edita job_title e linkedin_url", async () => {
    const user = await makeUser("itdev", { role: "it_dev", is_global_admin: true, globalRole: "global_admin" });

    const updated = await pgUpdateLocalUser(user.id, {
      job_title: "QA Engineer",
      linkedin_url: "https://www.linkedin.com/in/itdev-edit-" + UID,
    });

    expect(updated!.job_title).toBe("QA Engineer");
    expect(updated!.linkedin_url).toContain(UID);
    console.log(`\nâœ… IT Dev: job_title="${updated!.job_title}" | linkedin=${updated!.linkedin_url}`);
  });

  // â”€â”€ 3. Admin Global â€” altera is_global_admin e globalRole â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it("Admin Global: rebaixa para usuÃ¡rio normal (is_global_admin=false)", async () => {
    const user = await makeUser("globaladmin", {
      role: "it_dev",
      is_global_admin: true,
      globalRole: "global_admin",
    });
    expect(user.is_global_admin).toBe(true);

    const updated = await pgUpdateLocalUser(user.id, {
      is_global_admin: false,
      globalRole: null,
      role: "user",
    });

    expect(updated!.is_global_admin).toBe(false);
    expect(updated!.globalRole).toBeNull();
    expect(updated!.role).toBe("user");
    console.log(`\nâœ… Admin Global â†’ rebaixado: is_global_admin=${updated!.is_global_admin} | role=${updated!.role}`);
  });

  // â”€â”€ 4. Viewer â€” promove membership viewer â†’ company_admin â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it("Viewer: promove membership de viewer para company_admin", async () => {
    const company = await pgCreateLocalCompany({
      name: `Empresa Edit Viewer ${UID}`,
      slug: `edit-viewer-${UID}`,
      status: "active",
    });
    createdCompanyIds.push(company.id);

    const user = await makeUser("viewer");
    await pgUpsertLocalLink({ userId: user.id, companyId: company.id, role: "viewer" });

    const memAntes = await prisma.membership.findFirst({
      where: { userId: user.id, companyId: company.id },
    });
    expect(memAntes!.role).toBe("viewer");

    // Promove
    await pgUpsertLocalLink({ userId: user.id, companyId: company.id, role: "company_admin" });

    const memDepois = await prisma.membership.findFirst({
      where: { userId: user.id, companyId: company.id },
    });
    expect(memDepois!.role).toBe("company_admin");
    console.log(`\nâœ… Viewer â†’ company_admin: membership atualizado`);
  });

  // â”€â”€ 5. CompAdmin â€” desativa conta â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it("CompAdmin: desativa conta (active=false, status=blocked)", async () => {
    const user = await makeUser("compadmin");

    const updated = await pgUpdateLocalUser(user.id, {
      active: false,
      status: "blocked",
    });

    expect(updated!.active).toBe(false);
    expect(updated!.status).toBe("blocked");

    const row = await prisma.user.findUnique({ where: { id: user.id } });
    expect(row!.active).toBe(false);
    expect(row!.status).toBe("blocked");
    console.log(`\nâœ… CompAdmin desativado: active=${updated!.active} | status=${updated!.status}`);
  });

  // â”€â”€ 6. Convidado â€” ativa conta (invited â†’ active) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it("Convidado: ativa conta mudando status de invited para active", async () => {
    const user = await makeUser("convidado", { status: "invited", active: false });
    expect(user.status).toBe("invited");

    const updated = await pgUpdateLocalUser(user.id, {
      status: "active",
      active: true,
    });

    expect(updated!.status).toBe("active");
    expect(updated!.active).toBe(true);
    console.log(`\nâœ… Convidado ativado: invited â†’ active`);
  });

  // â”€â”€ 7. MudanÃ§a de role (user â†’ it_dev) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it("Regular: promove role de user para it_dev com is_global_admin", async () => {
    const user = await makeUser("promove-role");
    expect(user.role).toBe("user");
    expect(user.is_global_admin).toBe(false);

    const updated = await pgUpdateLocalUser(user.id, {
      role: "it_dev",
      is_global_admin: true,
      globalRole: "global_admin",
    });

    expect(updated!.role).toBe("it_dev");
    expect(updated!.is_global_admin).toBe(true);
    expect(updated!.globalRole).toBe("global_admin");
    console.log(`\nâœ… Promovido: user â†’ it_dev | is_global_admin=true`);
  });

  // â”€â”€ 8. Rejeitar e-mail duplicado na ediÃ§Ã£o â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it("rejeita ediÃ§Ã£o com e-mail jÃ¡ cadastrado para outro usuÃ¡rio", async () => {
    const userA = await makeUser("dup-a");
    const userB = await makeUser("dup-b");

    await expect(
      pgUpdateLocalUser(userB.id, { email: userA.email })
    ).rejects.toMatchObject({ code: "DUPLICATE_EMAIL" });

    console.log(`\nâœ… E-mail duplicado rejeitado na ediÃ§Ã£o (DUPLICATE_EMAIL)`);
  });

  // â”€â”€ 9. Retorna null para usuÃ¡rio inexistente â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it("retorna null ao tentar editar usuÃ¡rio com id inexistente", async () => {
    const result = await pgUpdateLocalUser("id-inexistente-9999", { name: "Fantasma" });
    expect(result).toBeNull();
    console.log(`\nâœ… UsuÃ¡rio inexistente â†’ retornou null`);
  });

  // â”€â”€ 10. MÃºltiplos campos em uma operaÃ§Ã£o â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it("edita mÃºltiplos campos do usuÃ¡rio em uma Ãºnica operaÃ§Ã£o", async () => {
    const user = await makeUser("multiplos");

    const updated = await pgUpdateLocalUser(user.id, {
      name: `Multi Update ${UID}`,
      full_name: `Multi Full Name ${UID}`,
      phone: "+55 31 99876-5432",
      job_title: "Test Automation Engineer",
      linkedin_url: "https://linkedin.com/in/multi-" + UID,
      status: "active",
      active: true,
    });

    expect(updated!.name).toBe(`Multi Update ${UID}`);
    expect(updated!.full_name).toBe(`Multi Full Name ${UID}`);
    expect(updated!.phone).toBe("+55 31 99876-5432");
    expect(updated!.job_title).toBe("Test Automation Engineer");
    expect(updated!.linkedin_url).toContain(UID);
    console.log(`\nâœ… MÃºltiplos campos editados: ${Object.keys({ name: 1, full_name: 1, phone: 1, job_title: 1, linkedin_url: 1 }).join(", ")}`);
  });

  it("rejeita edicao com usuario ja cadastrado para outro usuario", async () => {
    const login = `edit.dup.user.${UID}`;
    const userA = await makeUser("dup-user-a", { user: login });
    const userB = await makeUser("dup-user-b");

    await expect(
      pgUpdateLocalUser(userB.id, { user: (userA.user ?? login).toUpperCase() })
    ).rejects.toMatchObject({ code: "DUPLICATE_USER" });
  });
});

