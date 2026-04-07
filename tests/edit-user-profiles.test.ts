/**
 * Cenários de edição de usuário por tipo de perfil no PostgreSQL.
 * ✅ cleanup total em afterAll — nenhum dado permanece.
 *
 * Perfis cobertos:
 *  1. Regular    — edita nome, email, phone
 *  2. IT Dev     — edita job_title, linkedin_url
 *  3. Admin Global — altera is_global_admin e globalRole
 *  4. Viewer     — promove membership viewer → company_admin
 *  5. CompAdmin  — desativa conta (active=false / status=blocked)
 *  6. Convidado  — ativa conta (status invited → active)
 *  7. Mudança de role de usuário (user → it_dev)
 *  8. Rejeitar e-mail duplicado na edição
 *  9. Retornar null para usuário inexistente
 * 10. Editar múltiplos campos em uma operação
 */

import { prisma } from "../lib/prismaClient";
import {
  pgCreateLocalUser,
  pgUpdateLocalUser,
  pgCreateLocalCompany,
  pgDeleteLocalCompany,
  pgUpsertLocalLink,
} from "../lib/core/auth/pgStore";
import { hashPasswordSha256 } from "../lib/passwordHash";

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

describe("Edição de usuário — por tipo de perfil", () => {

  // ── 1. Regular — edita nome, email, phone ──────────────────────────────────
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
    console.log(`\n✅ Regular: nome="${updated!.name}" | email=${updated!.email} | phone=${updated!.phone}`);
  });

  // ── 2. IT Dev — edita job_title e linkedin_url ─────────────────────────────
  it("IT Dev: edita job_title e linkedin_url", async () => {
    const user = await makeUser("itdev", { role: "it_dev", is_global_admin: true, globalRole: "global_admin" });

    const updated = await pgUpdateLocalUser(user.id, {
      job_title: "QA Engineer",
      linkedin_url: "https://www.linkedin.com/in/itdev-edit-" + UID,
    });

    expect(updated!.job_title).toBe("QA Engineer");
    expect(updated!.linkedin_url).toContain(UID);
    console.log(`\n✅ IT Dev: job_title="${updated!.job_title}" | linkedin=${updated!.linkedin_url}`);
  });

  // ── 3. Admin Global — altera is_global_admin e globalRole ─────────────────
  it("Admin Global: rebaixa para usuário normal (is_global_admin=false)", async () => {
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
    console.log(`\n✅ Admin Global → rebaixado: is_global_admin=${updated!.is_global_admin} | role=${updated!.role}`);
  });

  // ── 4. Viewer — promove membership viewer → company_admin ──────────────────
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
    console.log(`\n✅ Viewer → company_admin: membership atualizado`);
  });

  // ── 5. CompAdmin — desativa conta ─────────────────────────────────────────
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
    console.log(`\n✅ CompAdmin desativado: active=${updated!.active} | status=${updated!.status}`);
  });

  // ── 6. Convidado — ativa conta (invited → active) ─────────────────────────
  it("Convidado: ativa conta mudando status de invited para active", async () => {
    const user = await makeUser("convidado", { status: "invited", active: false });
    expect(user.status).toBe("invited");

    const updated = await pgUpdateLocalUser(user.id, {
      status: "active",
      active: true,
    });

    expect(updated!.status).toBe("active");
    expect(updated!.active).toBe(true);
    console.log(`\n✅ Convidado ativado: invited → active`);
  });

  // ── 7. Mudança de role (user → it_dev) ────────────────────────────────────
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
    console.log(`\n✅ Promovido: user → it_dev | is_global_admin=true`);
  });

  // ── 8. Rejeitar e-mail duplicado na edição ─────────────────────────────────
  it("rejeita edição com e-mail já cadastrado para outro usuário", async () => {
    const userA = await makeUser("dup-a");
    const userB = await makeUser("dup-b");

    await expect(
      pgUpdateLocalUser(userB.id, { email: userA.email })
    ).rejects.toMatchObject({ code: "DUPLICATE_EMAIL" });

    console.log(`\n✅ E-mail duplicado rejeitado na edição (DUPLICATE_EMAIL)`);
  });

  // ── 9. Retorna null para usuário inexistente ───────────────────────────────
  it("retorna null ao tentar editar usuário com id inexistente", async () => {
    const result = await pgUpdateLocalUser("id-inexistente-9999", { name: "Fantasma" });
    expect(result).toBeNull();
    console.log(`\n✅ Usuário inexistente → retornou null`);
  });

  // ── 10. Múltiplos campos em uma operação ───────────────────────────────────
  it("edita múltiplos campos do usuário em uma única operação", async () => {
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
    console.log(`\n✅ Múltiplos campos editados: ${Object.keys({ name: 1, full_name: 1, phone: 1, job_title: 1, linkedin_url: 1 }).join(", ")}`);
  });
});
