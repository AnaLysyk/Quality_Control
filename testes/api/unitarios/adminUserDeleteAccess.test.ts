import { canDeleteUserByProfile, canManageInstitutionalProfiles } from "../../../lib/adminUserDeleteAccess";

describe("adminUserDeleteAccess - Rigorous Access Control Tests", () => {

  describe("canManageInstitutionalProfiles - PermissÃµes Administrativas Root", () => {
    it("cenÃ¡rios VÃLIDOS: devem ser estritamente permitidos", () => {
      // LÃ­der TC
      expect(canManageInstitutionalProfiles({ role: "leader_tc", companyRole: "" })).toBe(true);
      expect(canManageInstitutionalProfiles({ role: "", companyRole: "leader_tc" })).toBe(true);
      expect(canManageInstitutionalProfiles({ role: "lider_tc", companyRole: "" })).toBe(true);
      expect(canManageInstitutionalProfiles({ role: "tc_leader", companyRole: "" })).toBe(true);
      expect(canManageInstitutionalProfiles({ role: "admin", companyRole: "" })).toBe(true);
      expect(canManageInstitutionalProfiles({ role: "global_admin", companyRole: "" })).toBe(true);

      // Suporte TÃ©cnico
      expect(canManageInstitutionalProfiles({ role: "technical_support", companyRole: "" })).toBe(true);
      expect(canManageInstitutionalProfiles({ role: "", companyRole: "technical_support" })).toBe(true);
      expect(canManageInstitutionalProfiles({ role: "support", companyRole: "" })).toBe(true);
      expect(canManageInstitutionalProfiles({ role: "tech_support", companyRole: "" })).toBe(true);
      expect(canManageInstitutionalProfiles({ role: "it_dev", companyRole: "" })).toBe(true);
    });

    it("cenÃ¡rios INVÃLIDOS: devem ser estritamente bloqueados", () => {
      // Outros perfis QA
      expect(canManageInstitutionalProfiles({ role: "testing_company_user", companyRole: "" })).toBe(false);
      expect(canManageInstitutionalProfiles({ role: "user", companyRole: "" })).toBe(false);
      expect(canManageInstitutionalProfiles({ role: "viewer", companyRole: "" })).toBe(false);

      // Clientes & Empresas
      expect(canManageInstitutionalProfiles({ role: "company_user", companyRole: "" })).toBe(false);
      expect(canManageInstitutionalProfiles({ role: "empresa", companyRole: "" })).toBe(false);
      expect(canManageInstitutionalProfiles({ role: "company_admin", companyRole: "" })).toBe(false);
    });

    it("cenÃ¡rios EXTREMOS: nulls, undefines, empty objects", () => {
      expect(canManageInstitutionalProfiles(null)).toBe(false);
      expect(canManageInstitutionalProfiles(undefined)).toBe(false);
      expect(canManageInstitutionalProfiles({ role: "", companyRole: "" })).toBe(false);
      expect(canManageInstitutionalProfiles({ role: "   ", companyRole: "   " })).toBe(false);
      expect(canManageInstitutionalProfiles({ role: null as any, companyRole: null as any })).toBe(false);
    });
  });

  describe("canDeleteUserByProfile - Regras de DeleÃ§Ã£o", () => {
    it("LÃ­deres TC tÃªm poder absoluto sobre todos os perfis vÃ¡lidos", () => {
      const allValidTargets = ["leader_tc", "technical_support", "testing_company_user", "company_user", "empresa"];
      allValidTargets.forEach(target => {
        expect(canDeleteUserByProfile({ role: "leader_tc", companyRole: "" }, target)).toBe(true);
      });
    });

    it("Suporte TÃ©cnico pode deletar qualquer perfil", () => {
      const allValidTargets = ["leader_tc", "technical_support", "testing_company_user", "company_user", "empresa"];
      allValidTargets.forEach(target => {
        expect(canDeleteUserByProfile({ role: "technical_support", companyRole: "" }, target)).toBe(true);
      });
    });

    it("UsuÃ¡rios de QA comuns (Testing Company Users) sÃ£o bloqueados", () => {
      const allValidTargets = ["leader_tc", "technical_support", "testing_company_user", "company_user", "empresa"];
      allValidTargets.forEach(target => {
        expect(canDeleteUserByProfile({ role: "testing_company_user", companyRole: "" }, target)).toBe(false);
      });
    });

    it("Administradores de Empresas sÃ£o estritamente bloqueados", () => {
      const allValidTargets = ["leader_tc", "technical_support", "testing_company_user", "company_user", "empresa"];
      allValidTargets.forEach(target => {
        expect(canDeleteUserByProfile({ role: "empresa", companyRole: "" }, target)).toBe(false);
      });
    });

    it("Alvos extremanente invÃ¡lidos barram a execuÃ§Ã£o independente de quem pede", () => {
      const godActor = { role: "leader_tc", companyRole: "" };
      expect(canDeleteUserByProfile(godActor, "")).toBe(false);
      expect(canDeleteUserByProfile(godActor, null)).toBe(false);
      expect(canDeleteUserByProfile(godActor, undefined)).toBe(false);
      expect(canDeleteUserByProfile(godActor, "unexistent_role_123")).toBe(false);
    });
  });
});

