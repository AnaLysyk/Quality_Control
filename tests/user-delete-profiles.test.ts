/**
 * Teste de integração: criar 2 usuários por perfil e deletar (soft-delete) um deles.
 *
 * Requer conexão com PostgreSQL (DATABASE_URL configurado).
 * "Deletar" no sistema = soft-delete: active=false, status="blocked".
 * Todos os dados criados são removidos ao final via afterAll.
 *
 * Cenários cobertos:
 *  1. Usuário Regular               — criar 2, deletar 1
 *  2. IT Developer (Global)         — criar 2, deletar 1
 *  3. Admin Global                  — criar 2, deletar 1
 *  4. Viewer (vinculado a empresa)  — criar 2, deletar 1
 *  5. Administrador de Empresa      — criar 2, deletar 1
 *  6. Convidado (status=invited)    — criar 2, deletar 1
 *  7. Empresa Instituição           — criar empresa, criar 2 usuários vinculados, deletar 1
 */

import { randomUUID } from "crypto";
import { prisma } from "../lib/prismaClient";
import {
  pgCreateLocalUser,
  pgCreateLocalCompany,
  pgUpdateLocalUser,
  pgUpsertLocalLink,
} from "../src/core/auth/pgStore";
import { hashPasswordSha256 } from "../lib/passwordHash";

const TEST_PASSWORD = hashPasswordSha256("TesteSenha@123");
const uid = randomUUID().slice(0, 8);

const createdUserIds: string[] = [];
const createdCompanyIds: string[] = [];

afterAll(async () => {
  if (createdUserIds.length) {
    await prisma.membership.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
  if (createdCompanyIds.length) {
    await prisma.company.deleteMany({ where: { id: { in: createdCompanyIds } } });
  }
  await prisma.$disconnect();
});

// ─── helpers ─────────────────────────────────────────────────────────────────

function email(label: string, seq: number) {
  return `del-${label}-${seq}-${uid}@test-del.local`;
}

async function createUser(overrides: Partial<Parameters<typeof pgCreateLocalUser>[0]> & { name: string; email: string }) {
  const user = await pgCreateLocalUser({ password_hash: TEST_PASSWORD, ...overrides });
  createdUserIds.push(user.id);
  return user;
}

/** Soft-delete: marca active=false e status="blocked" (mesmo comportamento do endpoint DELETE). */
async function softDelete(id: string) {
  return pgUpdateLocalUser(id, { active: false, status: "blocked" });
}

async function assertDeleted(id: string) {
  const row = await prisma.user.findUnique({ where: { id } });
  expect(row).not.toBeNull();
  expect(row!.active).toBe(false);
  expect(row!.status).toBe("blocked");
}

async function assertActive(id: string) {
  const row = await prisma.user.findUnique({ where: { id } });
  expect(row).not.toBeNull();
  expect(row!.active).toBe(true);
  expect(row!.status).not.toBe("blocked");
}

// ─── Cenários ─────────────────────────────────────────────────────────────────

describe("Criar 2 usuários e deletar 1 por perfil — verificação de persistência", () => {

  // ── 1. Usuário Regular ────────────────────────────────────────────────────
  describe("Perfil: Usuário Regular", () => {
    it("cria 2, deleta o primeiro, verifica que o segundo permanece ativo", async () => {
      const userA = await createUser({ name: "Regular A", email: email("regular", 1), role: "user", is_global_admin: false });
      const userB = await createUser({ name: "Regular B", email: email("regular", 2), role: "user", is_global_admin: false });

      const deleted = await softDelete(userA.id);
      expect(deleted).not.toBeNull();
      expect(deleted!.active).toBe(false);
      expect(deleted!.status).toBe("blocked");

      await assertDeleted(userA.id);
      await assertActive(userB.id);
    });
  });

  // ── 2. IT Developer (Global) ──────────────────────────────────────────────
  describe("Perfil: IT Developer (Desenvolvedor Global)", () => {
    it("cria 2, deleta o primeiro, verifica que o segundo permanece ativo", async () => {
      const userA = await createUser({
        name: "ITDev A",
        email: email("itdev", 1),
        role: "it_dev",
        globalRole: "global_admin",
        is_global_admin: true,
      });
      const userB = await createUser({
        name: "ITDev B",
        email: email("itdev", 2),
        role: "it_dev",
        globalRole: "global_admin",
        is_global_admin: true,
      });

      const deleted = await softDelete(userA.id);
      expect(deleted!.active).toBe(false);
      expect(deleted!.is_global_admin).toBe(true); // perfil preservado após soft-delete

      await assertDeleted(userA.id);
      await assertActive(userB.id);
    });
  });

  // ── 3. Admin Global ───────────────────────────────────────────────────────
  describe("Perfil: Admin Global", () => {
    it("cria 2, deleta o primeiro, verifica que o segundo permanece ativo", async () => {
      const userA = await createUser({
        name: "GlobalAdmin A",
        email: email("globaladmin", 1),
        role: "user",
        globalRole: "global_admin",
        is_global_admin: true,
      });
      const userB = await createUser({
        name: "GlobalAdmin B",
        email: email("globaladmin", 2),
        role: "user",
        globalRole: "global_admin",
        is_global_admin: true,
      });

      const deleted = await softDelete(userA.id);
      expect(deleted!.status).toBe("blocked");

      await assertDeleted(userA.id);
      await assertActive(userB.id);
    });
  });

  // ── 4. Viewer (vinculado a empresa) ──────────────────────────────────────
  describe("Perfil: Viewer (vinculado a empresa)", () => {
    let companyId: string;

    beforeAll(async () => {
      const company = await pgCreateLocalCompany({
        name: `Empresa Viewer Del ${uid}`,
        slug: `emp-viewer-del-${uid}`,
      });
      companyId = company.id;
      createdCompanyIds.push(companyId);
    });

    it("cria 2 viewers, deleta o primeiro, verifica que o segundo e a membership permanecem", async () => {
      const userA = await createUser({ name: "Viewer Del A", email: email("viewer", 1), role: "user" });
      const userB = await createUser({ name: "Viewer Del B", email: email("viewer", 2), role: "user" });

      await pgUpsertLocalLink({ userId: userA.id, companyId, role: "viewer" });
      await pgUpsertLocalLink({ userId: userB.id, companyId, role: "viewer" });

      await softDelete(userA.id);

      await assertDeleted(userA.id);
      await assertActive(userB.id);

      // Membership de userB deve continuar
      const membership = await prisma.membership.findFirst({ where: { userId: userB.id, companyId } });
      expect(membership).not.toBeNull();
      expect(membership!.role).toBe("viewer");
    });
  });

  // ── 5. Administrador de Empresa (company_admin) ───────────────────────────
  describe("Perfil: Administrador de Empresa", () => {
    let companyId: string;

    beforeAll(async () => {
      const company = await pgCreateLocalCompany({
        name: `Empresa CompAdmin Del ${uid}`,
        slug: `emp-compadmin-del-${uid}`,
      });
      companyId = company.id;
      createdCompanyIds.push(companyId);
    });

    it("cria 2 company_admins, deleta o primeiro, verifica que o segundo e a membership permanecem", async () => {
      const userA = await createUser({ name: "CompAdmin Del A", email: email("compadmin", 1), role: "user" });
      const userB = await createUser({ name: "CompAdmin Del B", email: email("compadmin", 2), role: "user" });

      await pgUpsertLocalLink({ userId: userA.id, companyId, role: "company_admin" });
      await pgUpsertLocalLink({ userId: userB.id, companyId, role: "company_admin" });

      await softDelete(userA.id);

      await assertDeleted(userA.id);
      await assertActive(userB.id);

      const membership = await prisma.membership.findFirst({ where: { userId: userB.id, companyId } });
      expect(membership!.role).toBe("company_admin");
    });
  });

  // ── 6. Convidado (status=invited) ─────────────────────────────────────────
  describe("Perfil: Convidado (status=invited)", () => {
    it("cria 2 convidados, deleta o primeiro, verifica que o segundo permanece invited", async () => {
      const userA = await createUser({ name: "Invited Del A", email: email("invited", 1), role: "user", status: "invited", active: false });
      const userB = await createUser({ name: "Invited Del B", email: email("invited", 2), role: "user", status: "invited", active: false });

      await softDelete(userA.id);

      // Ambos têm active=false mas por razões distintas
      const rowA = await prisma.user.findUnique({ where: { id: userA.id } });
      const rowB = await prisma.user.findUnique({ where: { id: userB.id } });

      expect(rowA!.status).toBe("blocked"); // deletado => blocked
      expect(rowA!.active).toBe(false);

      expect(rowB!.status).toBe("invited"); // convidado ainda pendente
      expect(rowB!.active).toBe(false);
    });
  });

  // ── 7. Empresa Instituição ────────────────────────────────────────────────
  describe("Empresa Instituição", () => {
    let instituicaoId: string;

    beforeAll(async () => {
      // "Instituição" = empresa de natureza institucional (ex.: hospital, universidade)
      // Representada por uma company com notas indicando o tipo
      const instituicao = await pgCreateLocalCompany({
        name: `Instituição Teste ${uid}`,
        slug: `instituicao-teste-${uid}`,
        notes: "Tipo: instituição publica de ensino",
        status: "active",
      });
      instituicaoId = instituicao.id;
      createdCompanyIds.push(instituicaoId);
    });

    it("verifica que a instituição foi criada e persiste no banco", async () => {
      const row = await prisma.company.findUnique({ where: { id: instituicaoId } });
      expect(row).not.toBeNull();
      expect(row!.name).toContain("Instituição Teste");
      expect(row!.status).toBe("active");
    });

    it("cria 2 usuários vinculados como viewer, deleta o primeiro, o segundo permanece ativo", async () => {
      const userA = await createUser({ name: "Instituição Viewer A", email: email("inst-viewer", 1), role: "user" });
      const userB = await createUser({ name: "Instituição Viewer B", email: email("inst-viewer", 2), role: "user" });

      await pgUpsertLocalLink({ userId: userA.id, companyId: instituicaoId, role: "viewer" });
      await pgUpsertLocalLink({ userId: userB.id, companyId: instituicaoId, role: "viewer" });

      await softDelete(userA.id);

      await assertDeleted(userA.id);
      await assertActive(userB.id);

      const memberB = await prisma.membership.findFirst({ where: { userId: userB.id, companyId: instituicaoId } });
      expect(memberB).not.toBeNull();
    });

    it("cria 2 admins da instituição, deleta o primeiro, o segundo permanece como company_admin", async () => {
      const adminA = await createUser({ name: "Instituição Admin A", email: email("inst-admin", 1), role: "user" });
      const adminB = await createUser({ name: "Instituição Admin B", email: email("inst-admin", 2), role: "user" });

      await pgUpsertLocalLink({ userId: adminA.id, companyId: instituicaoId, role: "company_admin" });
      await pgUpsertLocalLink({ userId: adminB.id, companyId: instituicaoId, role: "company_admin" });

      await softDelete(adminA.id);

      await assertDeleted(adminA.id);
      await assertActive(adminB.id);

      const memberB = await prisma.membership.findFirst({ where: { userId: adminB.id, companyId: instituicaoId } });
      expect(memberB!.role).toBe("company_admin");
    });

    it("usuário deletado da instituição não aparece como ativo (simulação de listagem)", async () => {
      const userA = await createUser({ name: "Inst Active", email: email("inst-actv", 1), role: "user" });
      const userC = await createUser({ name: "Inst Deleted", email: email("inst-del", 2), role: "user" });

      await pgUpsertLocalLink({ userId: userA.id, companyId: instituicaoId, role: "viewer" });
      await pgUpsertLocalLink({ userId: userC.id, companyId: instituicaoId, role: "viewer" });

      await softDelete(userC.id);

      // Listagem de usuários ativos vinculados à instituição
      const activeMemberships = await prisma.membership.findMany({
        where: { companyId: instituicaoId },
        include: { user: true },
      });

      const activeUsers = activeMemberships.filter((m) => m.user.active && m.user.status !== "blocked");
      const deletedUsers = activeMemberships.filter((m) => !m.user.active || m.user.status === "blocked");

      expect(activeUsers.some((m) => m.userId === userA.id)).toBe(true);
      expect(deletedUsers.some((m) => m.userId === userC.id)).toBe(true);
    });
  });
});
