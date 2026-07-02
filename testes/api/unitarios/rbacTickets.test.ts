import {
  isTicketAdmin,
  isItDev,
  canManageAllTickets,
  canAccessGlobalTicketWorkspace,
  hasTicketEnteredSupportFlow,
  canViewTicket,
  canCommentTicket,
  canEditTicketContent,
  canAssignTicket,
  canMoveTicket,
} from "../../../lib/rbac/tickets";
import * as supportAccess from "../../../lib/supportAccess";
import type { AuthUser } from "../../../lib/jwtAuth";
import type { TicketRecord } from "../../../lib/ticketsStore";

jest.mock("../../../lib/supportAccess", () => ({
  canAccessGlobalSupportScope: jest.fn(),
  canCommentSupportTickets: jest.fn(),
  canManageSupportWorkflow: jest.fn(),
  canViewSupportBoard: jest.fn(),
  isSupportAdminUser: jest.fn(),
  isSupportDeveloperUser: jest.fn(),
}));

describe("rbac/tickets - Controles RÃ­gidos do RepositÃ³rio de Suporte (Tickets)", () => {
  const mockUser = { id: "u123", role: "empresa" } as AuthUser;
  const mockTicket = { id: "t1", createdBy: "u123", status: "backlog" } as TicketRecord;
  const otherTicket = { id: "t2", createdBy: "u999", status: "in_progress" } as TicketRecord;

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("DelegaÃ§Ãµes Diretas (Admin & IT Dev)", () => {
    it("deve delegar checagens nominais para supportAccess.ts rigidamente", () => {
      (supportAccess.isSupportAdminUser as jest.Mock).mockReturnValue(true);
      (supportAccess.isSupportDeveloperUser as jest.Mock).mockReturnValue(false);
      
      expect(isTicketAdmin(mockUser)).toBe(true);
      expect(isItDev(mockUser)).toBe(false);

      expect(supportAccess.isSupportAdminUser).toHaveBeenCalledWith(mockUser);
      expect(supportAccess.isSupportDeveloperUser).toHaveBeenCalledWith(mockUser);
    });
  });

  describe("canManageAllTickets & canAccessGlobalTicketWorkspace", () => {
    it("bloqueia Null users e repassa validaÃ§Ã£o dos globais para funÃ§Ãµes do supportAccess de workflow e scope", () => {
      expect(canManageAllTickets(null)).toBe(false);
      expect(canAccessGlobalTicketWorkspace(null)).toBe(false); // is technical handler fallback

      (supportAccess.canManageSupportWorkflow as jest.Mock).mockReturnValue(true);
      (supportAccess.canAccessGlobalSupportScope as jest.Mock).mockReturnValue(false);

      expect(canManageAllTickets(mockUser)).toBe(true);
      expect(canAccessGlobalTicketWorkspace(mockUser)).toBe(false);
    });
  });

  describe("Regras da Entidade Ticket", () => {
    describe("hasTicketEnteredSupportFlow", () => {
      it("reconhece entrada em fluxo se sair de 'backlog' (ex: in_progress)", () => {
        expect(hasTicketEnteredSupportFlow(otherTicket)).toBe(true); // status in_progress
      });

      it("reconhece entrada em fluxo MESMO sendo 'backlog' SE jÃ¡ hÃ¡ assignee (assignedToUserId)", () => {
        const backComDono = { ...mockTicket, assignedToUserId: "dev1" } as TicketRecord;
        expect(hasTicketEnteredSupportFlow(backComDono)).toBe(true);
      });

      it("diz false p/ 'backlog' limpo e null checks contra crashes", () => {
        expect(hasTicketEnteredSupportFlow(mockTicket)).toBe(false);
        expect(hasTicketEnteredSupportFlow(null)).toBe(false);
        expect(hasTicketEnteredSupportFlow(undefined)).toBe(false);
      });
    });

    describe("canViewTicket", () => {
      it("bloqueia instaneamente caso o User nÃ£o possua View Global Board permissÃ£o (canViewSupportBoard)", () => {
        (supportAccess.canViewSupportBoard as jest.Mock).mockReturnValue(false);
        expect(canViewTicket(mockUser, mockTicket)).toBe(false);
      });

      it("libera se possuir Scope Workspace Global total da listagem (Admin/TI Operator)", () => {
        (supportAccess.canViewSupportBoard as jest.Mock).mockReturnValue(true);
        (supportAccess.canAccessGlobalSupportScope as jest.Mock).mockReturnValue(true);
        // Mesmo lendo o ticket criado por outro, deve liberar pois Ã© Global
        expect(canViewTicket(mockUser, otherTicket)).toBe(true);
      });

      it("libera se NÃƒO FOR Global mas FOR dono do ticket exato (own ticket restrictio)", () => {
        (supportAccess.canViewSupportBoard as jest.Mock).mockReturnValue(true);
        (supportAccess.canAccessGlobalSupportScope as jest.Mock).mockReturnValue(false);

        // Own ticket => true
        expect(canViewTicket(mockUser, mockTicket)).toBe(true);
        // Outro ticket (onde createdBy !== mockUser.id) => false
        expect(canViewTicket(mockUser, otherTicket)).toBe(false);
      });
    });

    describe("canCommentTicket & canEditTicketContent", () => {
      it("comentÃ¡rio depende de canViewTicket AND canCommentSupportTickets (perm do modulo)", () => {
        // Setup viewTicket success = own ticket e view board permission OK
        (supportAccess.canViewSupportBoard as jest.Mock).mockReturnValue(true);
        (supportAccess.canAccessGlobalSupportScope as jest.Mock).mockReturnValue(false);
        (supportAccess.canCommentSupportTickets as jest.Mock).mockReturnValue(true);

        expect(canCommentTicket(mockUser, mockTicket)).toBe(true); // can views it and can comment on globals
      });

      it("ediÃ§Ã£o pesada exige ManageSupportWorkflow ou ser o autor material do ticket via Id", () => {
        (supportAccess.canManageSupportWorkflow as jest.Mock).mockReturnValue(false);

        // Own Ticket author -> true edit (mesmo n sendo Support Admin)
        expect(canEditTicketContent(mockUser, mockTicket)).toBe(true);

        // Intruder on other ticket sem Workflow powers -> blocked
        expect(canEditTicketContent(mockUser, otherTicket)).toBe(false);

        // Support Op com powers sobre ticket alheio -> Liberado 
        (supportAccess.canManageSupportWorkflow as jest.Mock).mockReturnValue(true);
        expect(canEditTicketContent(mockUser, otherTicket)).toBe(true);
      });
    });

    describe("canAssignTicket & canMoveTicket (Operacionais Puros)", () => {
      it("bloqueiam sumariamente falhas nulas do target ou user", () => {
        expect(canAssignTicket(null, undefined)).toBe(false);
        expect(canMoveTicket(mockUser, undefined)).toBe(false);
      });

      it("exigem explicitamente as DUAS FLAGS juntas: AccessGlobalWorkspace AND ManageWorkflow", () => {
        // Tem Workspace scope (Ve todos), mas n tem o Workflow control (Move/Status)
        (supportAccess.canAccessGlobalSupportScope as jest.Mock).mockReturnValue(true);
        (supportAccess.canManageSupportWorkflow as jest.Mock).mockReturnValue(false);
        expect(canMoveTicket(mockUser, mockTicket)).toBe(false);
        expect(canAssignTicket(mockUser, mockTicket)).toBe(false);

        // Habilitando ambos as ferramentas devem aprovar
        (supportAccess.canManageSupportWorkflow as jest.Mock).mockReturnValue(true);
        expect(canMoveTicket(mockUser, mockTicket)).toBe(true);
        expect(canAssignTicket(mockUser, mockTicket)).toBe(true);
      });
    });
  });
});

