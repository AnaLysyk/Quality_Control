/**
 * Teste de integração: criação de usuários de todos os perfis — PERSISTÊNCIA PERMANENTE.
 *
 * ⚠️  Este teste NÃO remove os dados do banco ao final (sem afterAll de cleanup).
 * Objetivo: validar o backend e deixar os dados visíveis no Beekeeper Studio.
 *
 * Requer conexão com PostgreSQL (DATABASE_URL configurado).
 */

import { randomUUID } from "crypto";
import { prisma } from "../lib/prismaClient";
import {
  pgCreateLocalUser,
  pgCreateLocalCompany,
  pgUpsertLocalLink,
} from "../src/core/auth/pgStore";
import { hashPasswordSha256 } from "../lib/passwordHash";

const TEST_PASSWORD = hashPasswordSha256("TesteSenha@123");
const uid = randomUUID().slice(0, 8);

function testEmail(label: string) {
  return `persist-${label}-${uid}@perfil-persist.local`;
}

afterAll(async () => {
  // ✅ SEM CLEANUP — dados permanecem no banco para inspeção no Beekeeper
  await prisma.$disconnect();
});

describe("Perfis de usuário — dados persistidos permanentemente no banco", () => {

  // ── 1. Usuário Regular ────────────────────────────────────────────────────
  describe("Perfil: Usuário Regular", () => {
    it("cria e persiste no banco (sem remoção)", async () => {
      const email = testEmail("regular");
      const user = await pgCreateLocalUser({ name: "Regular Persist", email, password_hash: TEST_PASSWORD, role: "user", is_global_admin: false, status: "active" });

      expect(user.id).toBeTruthy();
      expect(user.email).toBe(email);
      expect(user.role).toBe("user");
      expect(user.is_global_admin).toBe(false);

      const row = await prisma.user.findUnique({ where: { id: user.id } });
      expect(row).not.toBeNull();

      console.log(`\n✅ Regular   | ${user.email} | id: ${user.id}`);
    });
  });

  // ── 2. IT Developer ───────────────────────────────────────────────────────
  describe("Perfil: IT Developer", () => {
    it("cria e persiste no banco (sem remoção)", async () => {
      const email = testEmail("itdev");
      const user = await pgCreateLocalUser({ name: "IT Dev Persist", email, password_hash: TEST_PASSWORD, role: "it_dev", globalRole: "global_admin", is_global_admin: true, status: "active" });

      expect(user.role).toBe("it_dev");
      expect(user.is_global_admin).toBe(true);
      expect(user.globalRole).toBe("global_admin");

      const row = await prisma.user.findUnique({ where: { id: user.id } });
      expect(row!.role).toBe("it_dev");
      expect(row!.is_global_admin).toBe(true);

      console.log(`✅ IT Dev     | ${user.email} | id: ${user.id}`);
    });
  });

  // ── 3. Admin Global ───────────────────────────────────────────────────────
  describe("Perfil: Admin Global", () => {
    it("cria e persiste no banco (sem remoção)", async () => {
      const email = testEmail("globaladmin");
      const user = await pgCreateLocalUser({ name: "Admin Global Persist", email, password_hash: TEST_PASSWORD, role: "user", globalRole: "global_admin", is_global_admin: true, status: "active" });

      expect(user.is_global_admin).toBe(true);
      expect(user.globalRole).toBe("global_admin");

      const row = await prisma.user.findUnique({ where: { id: user.id } });
      expect(row!.globalRole).toBe("global_admin");

      console.log(`✅ Admin Global | ${user.email} | id: ${user.id}`);
    });
  });

  // ── 4. Viewer (vinculado a empresa) ──────────────────────────────────────
  describe("Perfil: Viewer", () => {
    it("cria usuário + empresa + membership viewer, tudo persiste no banco", async () => {
      const company = await pgCreateLocalCompany({ name: `Empresa Viewer Persist ${uid}`, slug: `empresa-viewer-persist-${uid}`, status: "active" });
      const email = testEmail("viewer");
      const user = await pgCreateLocalUser({ name: "Viewer Persist", email, password_hash: TEST_PASSWORD, role: "user", is_global_admin: false });

      const role = await pgUpsertLocalLink({ userId: user.id, companyId: company.id, role: "viewer" });
      expect(role).toBe("viewer");

      const membership = await prisma.membership.findFirst({ where: { userId: user.id, companyId: company.id } });
      expect(membership!.role).toBe("viewer");

      console.log(`✅ Viewer     | ${user.email} | empresa: ${company.slug} | id: ${user.id}`);
    });
  });

  // ── 5. Company Admin ──────────────────────────────────────────────────────
  describe("Perfil: Company Admin", () => {
    it("cria usuário + empresa + membership company_admin, tudo persiste no banco", async () => {
      const company = await pgCreateLocalCompany({ name: `Empresa Admin Persist ${uid}`, slug: `empresa-admin-persist-${uid}`, status: "active" });
      const email = testEmail("compadmin");
      const user = await pgCreateLocalUser({ name: "CompAdmin Persist", email, password_hash: TEST_PASSWORD, role: "user", is_global_admin: false });

      const role = await pgUpsertLocalLink({ userId: user.id, companyId: company.id, role: "company_admin" });
      expect(role).toBe("company_admin");

      const membership = await prisma.membership.findFirst({ where: { userId: user.id, companyId: company.id } });
      expect(membership!.role).toBe("company_admin");

      console.log(`✅ CompAdmin  | ${user.email} | empresa: ${company.slug} | id: ${user.id}`);
    });
  });

  // ── 6. Convidado (invited) ────────────────────────────────────────────────
  describe("Perfil: Convidado (invited)", () => {
    it("cria e persiste no banco com status=invited (sem remoção)", async () => {
      const email = testEmail("invited");
      const user = await pgCreateLocalUser({ name: "Convidado Persist", email, password_hash: TEST_PASSWORD, role: "user", is_global_admin: false, status: "invited" });

      expect(user.status).toBe("invited");

      const row = await prisma.user.findUnique({ where: { id: user.id } });
      expect(row!.status).toBe("invited");

      console.log(`✅ Convidado  | ${user.email} | id: ${user.id}`);
    });
  });

  // ── 7. Restrição: e-mail duplicado ────────────────────────────────────────
  describe("Restrição: e-mail duplicado", () => {
    it("lança DUPLICATE_EMAIL ao tentar criar dois usuários com o mesmo e-mail", async () => {
      const email = testEmail("dup-check");
      await pgCreateLocalUser({ name: "Dup A", email, password_hash: TEST_PASSWORD, role: "user", is_global_admin: false });

      await expect(
        pgCreateLocalUser({ name: "Dup B", email, password_hash: TEST_PASSWORD, role: "user", is_global_admin: false })
      ).rejects.toMatchObject({ code: "DUPLICATE_EMAIL" });

      console.log(`✅ DUPLICATE_EMAIL validado   | ${email}`);
    });
  });

});
