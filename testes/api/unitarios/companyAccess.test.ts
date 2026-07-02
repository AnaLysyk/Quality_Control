import { isCompanyUser } from "../../../lib/rbac/companyAccess";
import { SYSTEM_ROLES } from "../../../lib/auth/roles";
import type { AuthUser } from "../../../lib/jwtAuth";

describe("companyAccess - Controles Rígidos de Isolamento de Empresa", () => {
  describe("isCompanyUser", () => {
    it("deve bloquear acesso sumariamente se user for nulo ou undefined", () => {
      expect(isCompanyUser(null)).toBe(false);
      // @ts-expect-error testando undefined runtime
      expect(isCompanyUser(undefined)).toBe(false);
    });

    it("deve reconhecer perfil explicitamente como SYSTEM_ROLES.EMPRESA (role direto)", () => {
      expect(isCompanyUser({ id: "1", email: "a@a.com", isGlobalAdmin: false, role: "empresa" } as AuthUser)).toBe(true);
      expect(isCompanyUser({ id: "2", email: "b@b.com", isGlobalAdmin: false, role: "EMPRESA" } as AuthUser)).toBe(true); // testa case insensitivity
    });

    it("deve reconhecer via fallback companyRole = 'empresa' mesmo se role primário for vazio ou outro", () => {
      expect(isCompanyUser({ id: "1", email: "a@a.com", isGlobalAdmin: false, role: "suporte", companyRole: "empresa" } as AuthUser)).toBe(true);
      expect(isCompanyUser({ id: "2", email: "b@b.com", isGlobalAdmin: false, role: null, companyRole: "EMPRESA" } as AuthUser)).toBe(true);
    });

    it("deve validar se company_user rigorosamente possui vínculo de ID (companyId)", () => {
      // Vínculo via companyId direto
      expect(isCompanyUser({ id: "1", email: "a@a.com", isGlobalAdmin: false, role: "company_user", companyId: "123" } as AuthUser)).toBe(true);
      expect(isCompanyUser({ id: "2", email: "b@b.com", isGlobalAdmin: false, role: "testing_company_user", companyId: "456" } as AuthUser)).toBe(true);

      // Bloqueio se não tiver companyId e nem slugs
      expect(isCompanyUser({ id: "3", email: "c@c.com", isGlobalAdmin: false, role: "company_user", companyId: null, metadata: {} } as unknown as AuthUser)).toBe(false);
      expect(isCompanyUser({ id: "4", email: "d@d.com", isGlobalAdmin: false, role: "testing_company_user", companyId: undefined } as unknown as AuthUser)).toBe(false);
    });

    it("deve validar se company_user possui vínculo por slugs (via array ou metadata)", () => {
      // Vínculo via metadata.companies
      expect(isCompanyUser({ 
        id: "5", email: "e@e.com", isGlobalAdmin: false,
        role: "company_user", 
        metadata: { companies: ["slug-1"] } 
      } as unknown as AuthUser)).toBe(true);

      // Vínculo via auth raw de slugs no payload
      expect(isCompanyUser({ 
        id: "6", email: "f@f.com", isGlobalAdmin: false,
        role: "testing_company_user", 
        companies: ["slug-1", "slug-2"] 
      } as unknown as AuthUser)).toBe(true);
    });

    it("deve rejeitar outros papéis que tentarem by-pass sem as validações estritas corporativas", () => {
      const intruders = [
        { id: "1", email: "a@a.com", isGlobalAdmin: false, role: "leader_tc" }, // Lider TC não é de uma empresa consumidora específica dessa view
        { id: "2", email: "b@b.com", isGlobalAdmin: false, role: "technical_support" }, 
        { id: "3", email: "c@c.com", isGlobalAdmin: false, role: "admin", companyId: "123" }, // Apesar de companyId, admin não é isCompanyUser primário de business auth neste fluxo
        { id: "4", email: "d@d.com", isGlobalAdmin: false, role: "random_hacker_role", companyId: "999" }
      ];

      intruders.forEach(hacker => {
        expect(isCompanyUser(hacker as AuthUser)).toBe(false);
      });
    });
  });
});

