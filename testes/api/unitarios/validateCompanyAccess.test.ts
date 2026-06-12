import { assertCompanyAccess, requireCompanyIdPresent } from "../../../lib/rbac/validateCompanyAccess";
import { SYSTEM_ROLES } from "../../../lib/auth/roles";
import type { AuthUser } from "../../../lib/jwtAuth";
import * as localStore from "../../../lib/auth/localStore";

jest.mock("../../../lib/auth/localStore", () => ({
  listLocalLinksForUser: jest.fn(),
}));

describe("validateCompanyAccess - Matriz Rígida de Isolamento Multitenant (Empresa)", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("requireCompanyIdPresent", () => {
    it("deve lançar MISSING_COMPANY_ID para lixos (null, undefined, string vazia)", () => {
      expect(() => requireCompanyIdPresent(null)).toThrow("MISSING_COMPANY_ID");
      expect(() => requireCompanyIdPresent(undefined)).toThrow("MISSING_COMPANY_ID");
      expect(() => requireCompanyIdPresent("")).toThrow("MISSING_COMPANY_ID");
    });

    it("deve passar livremente se for string com conteúdo", () => {
      expect(() => requireCompanyIdPresent("123")).not.toThrow();
    });
  });

  describe("assertCompanyAccess", () => {
    const listLocalLinksForUserMock = localStore.listLocalLinksForUser as jest.Mock;

    it("deve bloquear sumariamente user inválido e companyId inexistente", async () => {
      await expect(assertCompanyAccess(null, "123")).rejects.toThrow("MISSING_COMPANY_ID");
      await expect(assertCompanyAccess({ id: "user" } as AuthUser, null)).rejects.toThrow("MISSING_COMPANY_ID");
      await expect(assertCompanyAccess(undefined as any, undefined)).rejects.toThrow("MISSING_COMPANY_ID");
    });

    it("deve BYPASS global admins (Leader TC, Support) pois acessam visões root e modules cross-company", async () => {
      const globals = ["leader_tc", "admin", "global_admin", "technical_support", "tech_support"];

      for (const rawRole of globals) {
        // expect it NOT to throw
        await expect(assertCompanyAccess({ role: rawRole } as AuthUser, "any-company-id")).resolves.toBeUndefined();
      }
    });

    it("deve PERMITIR company users e empresa STRICTLY aprentando exatamente o seu companyId base", async () => {
      const companyMates = ["empresa", "company", "client_admin", "company_user", "client_user"];

      for (const role of companyMates) {
        await expect(
          assertCompanyAccess({ role, companyId: "tenant-a" } as AuthUser, "tenant-a")
        ).resolves.toBeUndefined();
      }
    });

    it("deve REJEITAR company users e empresa tentando acessar o tenant de outra empresa", async () => {
      const companyMates = ["empresa", "company_user"];

      for (const role of companyMates) {
        await expect(
          assertCompanyAccess({ role, companyId: "tenant-a" } as AuthUser, "tenant-b-hacker")
        ).rejects.toThrow("FORBIDDEN_COMPANY_ACCESS");
      }
    });

    it("deve PERMITIR testing_company_user acessar tenant se for sua base direta (companyId user payload)", async () => {
      await expect(
        assertCompanyAccess({ role: "testing_company_user", companyId: "meu-tenant" } as AuthUser, "meu-tenant")
      ).resolves.toBeUndefined();
    });

    it("deve PERMITIR testing_company_user acessar tenant externo APENAS SE existir Link Mapeado no Store", async () => {
      // Stub links list
      listLocalLinksForUserMock.mockResolvedValue([
        { companyId: "tenant-linked-1" },
        { companyId: "tenant-linked-2" }
      ]);

      await expect(
        assertCompanyAccess({ role: "testing_company_user", id: "tc-u-id" } as AuthUser, "tenant-linked-2")
      ).resolves.toBeUndefined();
      
      expect(listLocalLinksForUserMock).toHaveBeenCalledWith("tc-u-id");
    });

    it("deve REJEITAR testing_company_user tentar tenant externo se não houver Link Mapeado", async () => {
      listLocalLinksForUserMock.mockResolvedValue([
        { companyId: "tenant-allow-1" }
      ]);

      await expect(
        assertCompanyAccess({ role: "testing_company_user", id: "tc-u-id" } as AuthUser, "tenant-not-allowed")
      ).rejects.toThrow("FORBIDDEN_COMPANY_ACCESS");
    });
  });
});
