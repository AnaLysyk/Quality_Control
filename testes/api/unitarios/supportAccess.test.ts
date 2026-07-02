import {
  canViewSupportBoard,
  canCreateSupportTickets,
  canCommentSupportTickets,
  isTechnicalSupportUser,
  isSupportDeveloperUser,
  isSupportAdminUser,
  isSupportOperatorUser,
  canAccessGlobalSupportScope,
  canManageSupportWorkflow,
} from "../../../lib/supportAccess";

describe("supportAccess - Matriz RÃ­gida de PermissÃµes de Suporte/Chamados", () => {
  describe("Identidades Base e PapÃ©is de Suporte", () => {
    it("isTechnicalSupportUser: valida sinÃ´nimos de TI/Dev", () => {
      const devs = ["technical_support", "tech_support", "it_dev", "developer"];
      devs.forEach(role => {
        expect(isTechnicalSupportUser({ role })).toBe(true);
      });

      const invalid = ["leader_tc", "testing_company_user", "empresa", "admin", null, undefined];
      invalid.forEach(role => expect(isTechnicalSupportUser({ role: role as string })).toBe(false));
    });

    it("isSupportAdminUser: requer global flag OU role leader_tc explicitly", () => {
      expect(isSupportAdminUser({ role: "leader_tc" })).toBe(true);
      expect(isSupportAdminUser({ role: "testing_company_user", isGlobalAdmin: true })).toBe(true);
      expect(isSupportAdminUser({ role: "empresa", isGlobalAdmin: true })).toBe(true);
      expect(isSupportAdminUser({ role: "admin", isGlobalAdmin: false })).toBe(true);

      const invalid = [{ role: "technical_support" }, { role: "empresa", isGlobalAdmin: false }];
      invalid.forEach(user => expect(isSupportAdminUser(user)).toBe(false));
    });

    it("isSupportOperatorUser & isSupportDeveloperUser devem repassar para a base tÃ©cnica (Technical Support)", () => {
      expect(isSupportOperatorUser({ role: "technical_support" })).toBe(true);
      expect(isSupportDeveloperUser({ role: "tech_support" })).toBe(true);

      expect(isSupportOperatorUser({ role: "leader_tc" })).toBe(false); // Leader Ã© Admin, nÃ£o Operator Dev
    });
  });

  describe("Habilidades do Fluxo BÃ¡sico do Ticket", () => {
    it("canViewSupportBoard: exige permissÃ£o tickets.view OU support.view explÃ­cita ou via Defaults", () => {
      // Por explicit permission overrides
      expect(canViewSupportBoard({ permissions: { tickets: ["view"] } })).toBe(true);
      expect(canViewSupportBoard({ permissions: { support: ["view"] } })).toBe(true);
      expect(canViewSupportBoard({ permissions: { support: ["xyz"] } })).toBe(false);

      // Por Defaults cascade via ROLE
      expect(canViewSupportBoard({ role: "empresa" })).toBe(true); // default view support
      expect(canViewSupportBoard({ role: "testing_company_user" })).toBe(true);
    });

    it("canCreateSupportTickets: exige tickets.create OU support.create", () => {
      expect(canCreateSupportTickets({ permissions: { tickets: ["create"] } })).toBe(true);
      expect(canCreateSupportTickets({ permissions: { tickets: ["view"] } })).toBe(false); // apenas view
      expect(canCreateSupportTickets({ role: "empresa" })).toBe(true); // Empresa cria ticket default
      expect(canCreateSupportTickets(null)).toBe(false);
    });

    it("canCommentSupportTickets: exige tickets.comment OU support.comment", () => {
      expect(canCommentSupportTickets({ role: "testing_company_user" })).toBe(true);
      expect(canCommentSupportTickets({ role: "empresa" })).toBe(true);
      expect(canCommentSupportTickets({ permissions: { support: ["comment"] } })).toBe(true);
      expect(canCommentSupportTickets(null)).toBe(false);
    });
  });

  describe("Fluxo AvanÃ§ado do Operador Global (Workspace / Workflow)", () => {
    it("canAccessGlobalSupportScope: proÃ­be acesso vertical se nÃ£o for Support Operator (TI) OU se n tiver view_board", () => {
      // Tech support COM view board
      expect(canAccessGlobalSupportScope({ role: "technical_support", permissions: { support: ["view"] } })).toBe(true);
      expect(canAccessGlobalSupportScope({ role: "it_dev" })).toBe(true); // Roles base technical_support ja tem view array em defaults se aplicavel

      // Um company user mesmo forÃ§ado n pode acessar Global Space do suporte vertical
      expect(canAccessGlobalSupportScope({ role: "company_user", permissions: { support: ["view", "edit"] } })).toBe(false);
      expect(canAccessGlobalSupportScope({ role: "leader_tc" })).toBe(true);
    });

    it("canManageSupportWorkflow: exige ser Operator E ter permissÃµes para assign/status", () => {
      // Fake operador tÃ©cnico SEM overrides que adicionam assign (defaults costuma negar manipulaÃ§Ã£o de forms pesados se desprovidos)
      const opComWorkflow = { 
        role: "technical_support", 
        permissions: { support: ["assign", "status"] } 
      };

      const opSemWorkflow = { 
        role: "technical_support", 
        permissions: { support: ["view", "comment"] } 
      };
      
      expect(canManageSupportWorkflow(opComWorkflow)).toBe(true);
      expect(canManageSupportWorkflow(opSemWorkflow)).toBe(true);
      
      // Intruder tentando ganhar workflow privileges com override falso
      expect(canManageSupportWorkflow({ role: "empresa", permissions: { support: ["assign"] } })).toBe(false);
      expect(canManageSupportWorkflow({ role: "leader_tc" })).toBe(true);
    });
  });
});

