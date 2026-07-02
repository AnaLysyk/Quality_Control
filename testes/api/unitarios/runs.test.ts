import { resolveRunRole, canCreateRun, canEditRun, canDeleteRun, canLinkDefect } from "../../../lib/rbac/runs";
import { resolveDefectRole } from "../../../lib/rbac/defects";

jest.mock("../../../lib/rbac/defects", () => ({
  resolveDefectRole: jest.fn(),
  getPerfilSimulado: jest.fn()
}));

describe("rbac/runs - Matriz Permissiva para Casos de Execução", () => {
  const resolveDefectRoleMock = resolveDefectRole as jest.Mock;

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("resolveRunRole", () => {
    it("deve delegar a resolução exata para resolveDefectRole via payload recebido", async () => {
      resolveDefectRoleMock.mockResolvedValue("leader_tc");
      
      const role = await resolveRunRole({ id: "user", isGlobalAdmin: true }, "cliente-slug");
      
      expect(role).toBe("leader_tc");
      expect(resolveDefectRoleMock).toHaveBeenCalledWith({ id: "user", isGlobalAdmin: true }, "cliente-slug");
    });

    it("deve esmagar falhas na resolução (throws) retornando um perfil fechado de base (testing_company_user)", async () => {
      resolveDefectRoleMock.mockRejectedValue(new Error("Database offline"));

      const roleFallback = await resolveRunRole({ id: "user", isGlobalAdmin: false }, "cliente-slug");
      expect(roleFallback).toBe("testing_company_user");
    });
  });

  describe("Acesso Baseado no Perfil Resolveido", () => {
    it("canCreateRun: restrito a Leader TC ou Empresa", () => {
      expect(canCreateRun("leader_tc")).toBe(true);
      expect(canCreateRun("empresa")).toBe(true);
      
      const hacks: any[] = ["testing_company_user", "technical_support", "lixo", null, undefined];
      hacks.forEach(h => expect(canCreateRun(h)).toBe(false));
    });

    it("canEditRun: restrito a Leader TC, Empresa e Operacional QA (Testing Company User)", () => {
      expect(canEditRun("leader_tc")).toBe(true);
      expect(canEditRun("empresa")).toBe(true);
      expect(canEditRun("testing_company_user")).toBe(true); // Editam testes e preenchem forms

      const hacks: any[] = ["technical_support", "company_user", null, undefined];
      hacks.forEach(h => expect(canEditRun(h)).toBe(false));
    });

    it("canDeleteRun: hiper-restrito apenas ao Global Admin Leader TC", () => {
      expect(canDeleteRun("leader_tc")).toBe(true);

      const hacks: any[] = ["empresa", "testing_company_user", "technical_support", null, undefined];
      hacks.forEach(h => expect(canDeleteRun(h)).toBe(false));
    });

    it("canLinkDefect: restrito a Leader TC e Empresa", () => {
      expect(canLinkDefect("leader_tc")).toBe(true);
      expect(canLinkDefect("empresa")).toBe(true);

      const hacks: any[] = ["testing_company_user", "technical_support", null, undefined];
      hacks.forEach(h => expect(canLinkDefect(h)).toBe(false));
    });
  });
});

