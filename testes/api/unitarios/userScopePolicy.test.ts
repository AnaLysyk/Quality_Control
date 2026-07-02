import { 
  resolveUserScopePolicy, 
  canViewCompanyUsersByScope, 
  canCreateCompanyUsersByScope,
  normalizeScopeRoleKey,
} from "../../../lib/userScopePolicy";

describe("userScopePolicy - Matriz RÃ­gida de Escopos de UsuÃ¡rios", () => {
  describe("resoveUserScopePolicy", () => {
    it("deve mapear Leader TC com escopo total (all_companies, multi-link)", () => {
      const aliases = ["leader_tc", "testing_company_lead", "admin", "global_admin", "super-admin", "lider_tc", "tc_leader"];
      
      aliases.forEach(alias => {
        const policy = resolveUserScopePolicy(alias);
        expect(policy.roleKey).toBe("leader_tc");
        expect(policy.companyAccessScope).toBe("all_companies");
        expect(policy.canLinkAcrossCompanies).toBe(true);
        expect(policy.visibleUserKinds).toContain("testing_company");
        expect(policy.creatableUserKinds).toContain("testing_company");
      });
    });

    it("deve mapear Empresa restringindo acesso apenas Ã  prÃ³pria empresa (own_company)", () => {
      const aliases = ["empresa", "company", "company_admin", "client_admin", "client_owner", "client_manager"];

      aliases.forEach(alias => {
        const policy = resolveUserScopePolicy(alias);
        expect(policy.roleKey).toBe("empresa");
        expect(policy.companyAccessScope).toBe("own_company");
        expect(policy.canLinkAcrossCompanies).toBe(false);
        expect(policy.visibleUserKinds).not.toContain("testing_company"); // sÃ³ ve "company"
        expect(policy.creatableUserKinds).toContain("company");
      });
    });

    it("deve mapear Technical Support com acesso global, mas nÃ£o-admin focado apenas em suporte", () => {
      const aliases = ["technical_support", "support", "tech_support", "it_dev", "developer"];

      aliases.forEach(alias => {
        const policy = resolveUserScopePolicy(alias);
        expect(policy.roleKey).toBe("technical_support");
        expect(policy.companyAccessScope).toBe("all_companies");
        expect(policy.canLinkAcrossCompanies).toBe(false);
        expect(policy.visibleUserKinds).not.toContain("testing_company"); // Ve "support"
        expect(policy.creatableUserKinds).toHaveLength(0); // NÃ£o pode criar users globalmente
      });
    });

    it("deve cair para TESTING_COMPANY_USER como fallback rigoroso por seguranÃ§a ao fornecer lixos (nulls, espaÃ§os, lixos de string)", () => {
      const invalidStrings = ["", "   ", "fake_role", null, undefined];
      
      invalidStrings.forEach(invalid => {
        const policy = resolveUserScopePolicy(invalid as string);
        expect(policy.roleKey).toBe("testing_company_user");
        expect(policy.companyAccessScope).toBe("linked_companies");
        expect(policy.canLinkAcrossCompanies).toBe(false);
        expect(policy.creatableUserKinds).toContain("company"); // Pode sÃ³ criar de companies
      });
    });
  });

  describe("Visibilidade e CriaÃ§Ã£o Controlada: canViewCompanyUsersByScope & canCreateCompanyUsersByScope", () => {
    it("devem autorizar LÃ­der TC para ambas as funÃ§Ãµes", () => {
      const policy = resolveUserScopePolicy("leader_tc");
      expect(canViewCompanyUsersByScope(policy)).toBe(true);
      expect(canCreateCompanyUsersByScope(policy)).toBe(true);
    });

    it("devem autorizar Perfis Empresa para ambas as funÃ§Ãµes", () => {
      const policy = resolveUserScopePolicy("empresa");
      expect(canViewCompanyUsersByScope(policy)).toBe(true);
      expect(canCreateCompanyUsersByScope(policy)).toBe(true);
    });

    it("devem bloquear bloqueio de Suporte TÃ©cnico sobre criaÃ§Ã£o de usuÃ¡rios empresariais", () => {
      const policy = resolveUserScopePolicy("technical_support");
      expect(canViewCompanyUsersByScope(policy)).toBe(false); // Suporte ve kinds de 'support'
      expect(canCreateCompanyUsersByScope(policy)).toBe(false);
    });

    it("devem bloquear policies invÃ¡lidas/nulas instantaneamente", () => {
      expect(canViewCompanyUsersByScope(null)).toBe(false);
      expect(canViewCompanyUsersByScope(undefined)).toBe(false);
      expect(canCreateCompanyUsersByScope(null)).toBe(false);
      expect(canCreateCompanyUsersByScope(undefined)).toBe(false);
    });
  });
});

