jest.mock("@/backend/jwtAuth", () => ({
  authenticateRequest: jest.fn(),
}));

jest.mock("@/backend/ticketsStore", () => ({
  getTicketById: jest.fn(),
  updateTicketStatus: jest.fn(),
}));

jest.mock("@/backend/ticketsPresenter", () => ({
  attachAssigneeToTicket: jest.fn(),
}));

jest.mock("@/backend/rbac/tickets", () => ({
  canAccessGlobalTicketWorkspace: jest.fn(),
  canMoveTicket: jest.fn(),
}));

jest.mock("@/backend/ticketEventsStore", () => ({
  appendTicketEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/backend/notificationService", () => ({
  notifyTicketStatusChanged: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/backend/ticketsStatus", () => ({
  getTicketStatusLabel: jest.fn(),
}));

import { PATCH } from "@/api/suportes/[id]/status/route";
import { authenticateRequest } from "@/backend/jwtAuth";
import { getTicketById, updateTicketStatus } from "@/backend/ticketsStore";
import { attachAssigneeToTicket } from "@/backend/ticketsPresenter";
import { canAccessGlobalTicketWorkspace, canMoveTicket } from "@/backend/rbac/tickets";
import { notifyTicketStatusChanged } from "@/backend/notificationService";
import { getTicketStatusLabel } from "@/backend/ticketsStatus";

describe("api/suportes/[id]/status notifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("notifica o criador quando o suporte move o ticket pelo kanban", async () => {
    const currentTicket = {
      id: "ticket-1",
      title: "Erro no login",
      status: "backlog",
      createdBy: "creator-1",
      assignedToUserId: "support-2",
    };
    const updatedTicket = {
      ...currentTicket,
      status: "doing",
    };

    (authenticateRequest as jest.Mock).mockResolvedValue({
      id: "support-1",
      permissionRole: "technical_support",
    });
    (getTicketById as jest.Mock).mockResolvedValue(currentTicket);
    (updateTicketStatus as jest.Mock).mockResolvedValue(updatedTicket);
    (attachAssigneeToTicket as jest.Mock).mockResolvedValue(updatedTicket);
    (canMoveTicket as jest.Mock).mockReturnValue(true);
    (canAccessGlobalTicketWorkspace as jest.Mock).mockReturnValue(true);
    (getTicketStatusLabel as jest.Mock).mockReturnValue("Em andamento");

    const response = await PATCH(
      new Request("http://localhost/api/suportes/ticket-1/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "doing" }),
      }),
      { params: Promise.resolve({ id: "ticket-1" }) },
    );

    expect(response.status).toBe(200);
    expect(notifyTicketStatusChanged).toHaveBeenCalledWith({
      ticket: updatedTicket,
      actorId: "support-1",
      nextStatusLabel: "Em andamento",
    });
  });
});

