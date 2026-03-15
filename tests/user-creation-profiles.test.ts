/**
 * Teste de integração: criação de usuários de todos os perfis e persistência no banco.
 *
 * Requer conexão com PostgreSQL (DATABASE_URL configurado).
 * Usa pgCreateLocalUser / pgUpsertLocalLink diretamente — sem HTTP.
 * Todos os dados criados são removidos ao final via afterAll.
 */

import { randomUUID } from "crypto";
import { prisma } from "../lib/prismaClient";
import {
  pgCreateLocalUser,
  pgCreateLocalCompany,
  pgUpsertLocalLink,
} from "../src/core/auth/pgStore";
import { hashPasswordSha256 } from "../lib/passwordHash";

// IDs dos recursos criados pelo teste — limpos no afterAll
const createdUserIds: string[] = [];
const createdCompanyIds: string[] = [];

const TEST_PASSWORD = hashPasswordSha256("TesteSenha@123");
const uid = randomUUID().slice(0, 8);

function testEmail(label: string) {
  return `test-${label}-${uid}@test-profile.local`;
}

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

async function createUser(overrides: Partial<Parameters<typeof pgCreateLocalUser>[0]> & { name: string; email: string }) {
  const user = await pgCreateLocalUser({
    password_hash: TEST_PASSWORD,
    ...overrides,
  });
  createdUserIds.push(user.id);
  return user;
}

// ─── testes por perfil ────────────────────────────────────────────────────────

describe("Criação de usuários — persistência por perfil", () => {

  // ── 1. Usuário Regular ────────────────────────────────────────────────────
  describe("Perfil: Usuário Regular", () => {
    it("cria o usuário com role=user e persiste no banco", async () => {
      const email = testEmail("regular");
      const created = await createUser({
        name: "Usuario Regular Teste",
        email,
        role: "user",
        is_global_admin: false,
        status: "active",
      });

      // Objeto retornado
      expect(created.id).toBeTruthy();
      expect(created.email).toBe(email);
      expect(created.role).toBe("user");
      expect(created.is_global_admin).toBe(false);
      expect(created.globalRole).toBeNull();
      expect(created.active).toBe(true);
      expect(created.status).toBe("active");

      // Persistência no banco
      const row = await prisma.user.findUnique({ where: { id: created.id } });
      expect(row).not.toBeNull();
      expect(row!.email).toBe(email);
      expect(row!.role).toBe("user");
      expect(row!.is_global_admin).toBe(false);
      expect(row!.globalRole).toBeNull();
    });
  });

  // ── 2. IT Developer (Desenvolvedor Global) ────────────────────────────────
  describe("Perfil: IT Developer (Desenvolvedor Global)", () => {
    it("cria o usuário com role=it_dev, is_global_admin=true e persiste no banco", async () => {
      const email = testEmail("itdev");
      const created = await createUser({
        name: "IT Developer Teste",
        email,
        role: "it_dev",
        globalRole: "global_admin",
        is_global_admin: true,
        status: "active",
      });

      expect(created.email).toBe(email);
      expect(created.role).toBe("it_dev");
      expect(created.is_global_admin).toBe(true);
      expect(created.globalRole).toBe("global_admin");

      const row = await prisma.user.findUnique({ where: { id: created.id } });
      expect(row).not.toBeNull();
      expect(row!.role).toBe("it_dev");
      expect(row!.is_global_admin).toBe(true);
      expect(row!.globalRole).toBe("global_admin");
    });
  });

  // ── 3. Admin Global ───────────────────────────────────────────────────────
  describe("Perfil: Admin Global", () => {
    it("cria o usuário com is_global_admin=true, globalRole=global_admin e persiste no banco", async () => {
      const email = testEmail("globaladmin");
      const created = await createUser({
        name: "Admin Global Teste",
        email,
        role: "user",
        globalRole: "global_admin",
        is_global_admin: true,
        status: "active",
      });

      expect(created.email).toBe(email);
      expect(created.is_global_admin).toBe(true);
      expect(created.globalRole).toBe("global_admin");

      const row = await prisma.user.findUnique({ where: { id: created.id } });
      expect(row!.is_global_admin).toBe(true);
      expect(row!.globalRole).toBe("global_admin");
    });
  });

  // ── 4. Viewer (vinculado a empresa) ──────────────────────────────────────
  describe("Perfil: Viewer (vinculado a empresa)", () => {
    let companyId: string;

    beforeAll(async () => {
      const company = await pgCreateLocalCompany({
        name: `Empresa Teste Viewer ${uid}`,
        slug: `empresa-teste-viewer-${uid}`,
        status: "active",
      });
      companyId = company.id;
      createdCompanyIds.push(companyId);
    });

    it("cria o usuário, vincula como viewer e persiste no banco e na membership", async () => {
      const email = testEmail("viewer");
      const created = await createUser({
        name: "Viewer Teste",
        email,
        role: "user",
        is_global_admin: false,
      });

      // Adiciona membership de viewer
      const membershipRole = await pgUpsertLocalLink({
        userId: created.id,
        companyId,
        role: "viewer",
      });

      expect(membershipRole).toBe("viewer");

      // Persistência do usuário
      const row = await prisma.user.findUnique({ where: { id: created.id } });
      expect(row).not.toBeNull();
      expect(row!.is_global_admin).toBe(false);

      // Persistência da membership
      const membership = await prisma.membership.findFirst({
        where: { userId: created.id, companyId },
      });
      expect(membership).not.toBeNull();
      expect(membership!.role).toBe("viewer");
    });
  });

  // ── 5. Administrador de Empresa (company_admin) ───────────────────────────
  describe("Perfil: Administrador de Empresa (Company Admin)", () => {
    let companyId: string;

    beforeAll(async () => {
      const company = await pgCreateLocalCompany({
        name: `Empresa Teste CompAdmin ${uid}`,
        slug: `empresa-teste-compadmin-${uid}`,
        status: "active",
      });
      companyId = company.id;
      createdCompanyIds.push(companyId);
    });

    it("cria o usuário, vincula como company_admin e persiste no banco e na membership", async () => {
      const email = testEmail("compadmin");
      const created = await createUser({
        name: "Company Admin Teste",
        email,
        role: "user",
        is_global_admin: false,
      });

      const membershipRole = await pgUpsertLocalLink({
        userId: created.id,
        companyId,
        role: "company_admin",
      });

      expect(membershipRole).toBe("company_admin");

      const row = await prisma.user.findUnique({ where: { id: created.id } });
      expect(row).not.toBeNull();

      const membership = await prisma.membership.findFirst({
        where: { userId: created.id, companyId },
      });
      expect(membership).not.toBeNull();
      expect(membership!.role).toBe("company_admin");
    });
  });

  // ── 6. Usuário convidado (status=invited) ─────────────────────────────────
  describe("Perfil: Usuário Convidado (status=invited)", () => {
    it("cria usuário com status=invited e persiste no banco", async () => {
      const email = testEmail("invited");
      const created = await createUser({
        name: "Convidado Teste",
        email,
        role: "user",
        status: "invited",
        active: false,
      });

      expect(created.status).toBe("invited");
      expect(created.active).toBe(false);

      const row = await prisma.user.findUnique({ where: { id: created.id } });
      expect(row!.status).toBe("invited");
      expect(row!.active).toBe(false);
    });
  });

  // ── 7. Unicidade: email duplicado deve ser rejeitado ──────────────────────
  describe("Restrição: e-mail duplicado", () => {
    it("lança DUPLICATE_EMAIL ao tentar criar dois usuários com o mesmo e-mail", async () => {
      const email = testEmail("dupcheck");
      await createUser({ name: "Dup Check A", email });

      await expect(
        pgCreateLocalUser({
          name: "Dup Check B",
          email,
          password_hash: TEST_PASSWORD,
        }),
      ).rejects.toMatchObject({ code: "DUPLICATE_EMAIL" });
    });
  });
});
