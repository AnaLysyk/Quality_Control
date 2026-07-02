import { hasAdminClientToolAccess } from "../../../lib/adminClientAccess";

describe("adminClientAccess - Controle Rígido de Ferramentas de Cliente Admin", () => {
  describe("hasAdminClientToolAccess", () => {
    
    it("deve autorizar imediatamente se flags booleanas diretas de global admin estiverem disparadas", () => {
      expect(hasAdminClientToolAccess({ isGlobalAdmin: true })).toBe(true);
      expect(hasAdminClientToolAccess({ is_global_admin: true })).toBe(true);
      // Mesmo com roles negados explícitos, a flag deve ter prioridade (bypass)
      expect(hasAdminClientToolAccess({ isGlobalAdmin: true, role: "user" })).toBe(true);
    });

    it("deve autorizar acessos usando qualquer alias legado de LEADER_TC perfeitamente e em qualquer chave de propriedade", () => {
      const leaderAliases = ["leader_tc", "testing_company_lead", "admin", "global_admin", "super-admin", "lider_tc", "tc_leader"];
      const props = ["permissionRole", "role", "companyRole", "globalRole"] as const;

      leaderAliases.forEach(alias => {
        props.forEach(prop => {
          expect(hasAdminClientToolAccess({ [prop]: alias })).toBe(true);
        });
      });
    });

    it("deve autorizar acessos usando qualquer alias legado de TECHNICAL_SUPPORT de infra/dev e em qualquer chave de propriedade", () => {
      const supportAliases = ["technical_support", "support", "tech_support", "support_tech", "it_dev", "itdev", "dev", "developer"];
      const props = ["permissionRole", "role", "companyRole", "globalRole"] as const;

      supportAliases.forEach(alias => {
        props.forEach(prop => {
          expect(hasAdminClientToolAccess({ [prop]: alias })).toBe(true);
        });
      });
    });

    it("deve BLOQUEAR estritamente usuários comuns, empresas e QAs (bypass failure)", () => {
      const invalidAliases = ["user", "viewer", "testing_company_user", "company_user", "client_user", "company_viewer", "empresa", "company_admin"];
      const props = ["permissionRole", "role", "companyRole", "globalRole"] as const;

      // Testa um a um cobrindo a matriz toda
      invalidAliases.forEach(alias => {
        props.forEach(prop => {
          expect(hasAdminClientToolAccess({ [prop]: alias })).toBe(false);
        });
      });
      
      // Múltiplos atributos não devem empilhar e causar grant de excessão
      expect(hasAdminClientToolAccess({ role: "user", companyRole: "empresa", permissionRole: "viewer" })).toBe(false);
    });

    it("deve esmagar payloads inseguros, nulos, vazios e undefined (crash test)", () => {
      expect(hasAdminClientToolAccess(null)).toBe(false);
      expect(hasAdminClientToolAccess(undefined)).toBe(false);
      expect(hasAdminClientToolAccess({})).toBe(false);
      expect(hasAdminClientToolAccess({ isGlobalAdmin: false, is_global_admin: false })).toBe(false);
      expect(hasAdminClientToolAccess({ role: "", companyRole: "   " })).toBe(false);
      expect(hasAdminClientToolAccess({ role: null, companyRole: undefined })).toBe(false);
      expect(hasAdminClientToolAccess({ role: "fake_nonexistent_role" })).toBe(false);
    });
  });
});



