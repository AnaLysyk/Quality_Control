jest.mock("@/lib/userNotificationsStore", () => ({
  closeNotificationsByDedupeKey: jest.fn().mockResolvedValue(false),
  createNotificationsForUsers: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/lib/auth/localStore", () => ({
  listLocalCompanies: jest.fn().mockResolvedValue([]),
  listLocalLinksForCompany: jest.fn().mockResolvedValue([]),
  listLocalUsers: jest.fn().mockResolvedValue([]),
  listLocalMemberships: jest.fn().mockResolvedValue([]),
  getLocalUserById: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/lib/requestRouting", () => ({
  canAdminReviewQueue: jest.fn().mockReturnValue(false),
  resolveReviewQueue: jest.fn().mockReturnValue("global_only"),
  toRequestProfileTypeLabel: jest.fn().mockReturnValue("Usuario"),
}));

import { createNotificationsForUsers } from "@/lib/userNotificationsStore";
import { listLocalCompanies, listLocalLinksForCompany } from "@/lib/auth/localStore";
import { notifyTicketCommentAdded, notifyTicketStatusChanged } from "@/lib/notificationService";

describe("notificationService support recipients", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("notifica o criador quando o suporte comenta no ticket", async () => {
    await notifyTicketCommentAdded({
      ticket: {
        id: "ticket-1",
        title: "Erro no login",
        createdBy: "creator-1",
        assignedToUserId: "support-2",
        companySlug: "Demo",
      } as never,
      comment: {
        id: "comment-1",
        body: "Atualizei o status e iniciei a analise.",
      } as never,
      actorId: "support-1",
      actorName: "Suporte",
    });

    expect(createNotificationsForUsers).toHaveBeenCalledWith(
      expect.arrayContaining(["creator-1"]),
      expect.objectContaining({
        type: "TICKET_COMMENT_ADDED",
        title: "Novo comentario no suporte",
        ticketId: "ticket-1",
      }),
    );
  });

  it("notifica usuarios vinculados da empresa em mudanca de status", async () => {
    (listLocalCompanies as jest.Mock).mockResolvedValueOnce([
      { id: "company-demo", slug: "demo" },
    ]);
    (listLocalLinksForCompany as jest.Mock).mockResolvedValueOnce([
      { userId: "company-user-1" },
      { userId: "company-account-1" },
      { userId: "tc-linked-1" },
    ]);

    await notifyTicketStatusChanged({
      ticket: {
        id: "ticket-2",
        title: "Erro na API",
        createdBy: "creator-2",
        assignedToUserId: "support-2",
        companySlug: "demo",
        updatedAt: "2026-04-14T00:00:00.000Z",
      } as never,
      actorId: "support-2",
      nextStatusLabel: "Em andamento",
    });

    expect(createNotificationsForUsers).toHaveBeenCalledWith(
      expect.arrayContaining(["creator-2", "company-user-1", "company-account-1", "tc-linked-1"]),
      expect.objectContaining({
        type: "TICKET_STATUS_CHANGED",
        ticketId: "ticket-2",
      }),
    );
  });

  it("notifica usuarios vinculados da empresa em comentario", async () => {
    (listLocalCompanies as jest.Mock).mockResolvedValueOnce([
      { id: "company-demo", slug: "demo" },
    ]);
    (listLocalLinksForCompany as jest.Mock).mockResolvedValueOnce([
      { userId: "company-user-1" },
      { userId: "company-account-1" },
      { userId: "tc-linked-1" },
    ]);

    await notifyTicketCommentAdded({
      ticket: {
        id: "ticket-3",
        title: "Erro no login",
        createdBy: "creator-3",
        assignedToUserId: "support-3",
        companySlug: "demo",
      } as never,
      comment: {
        id: "comment-3",
        body: "Ajuste aplicado no backend.",
      } as never,
      actorId: "support-3",
      actorName: "Suporte",
    });

    expect(createNotificationsForUsers).toHaveBeenCalledWith(
      expect.arrayContaining(["creator-3", "company-user-1", "company-account-1", "tc-linked-1"]),
      expect.objectContaining({
        type: "TICKET_COMMENT_ADDED",
        ticketId: "ticket-3",
      }),
    );
  });

  it("nao adiciona vinculados da empresa quando fan-out estiver desativado", async () => {
    (listLocalCompanies as jest.Mock).mockResolvedValueOnce([
      { id: "company-demo", slug: "demo", notifications_fanout_enabled: false },
    ]);
    (listLocalLinksForCompany as jest.Mock).mockResolvedValueOnce([
      { userId: "company-user-1" },
      { userId: "company-account-1" },
      { userId: "tc-linked-1" },
    ]);

    await notifyTicketStatusChanged({
      ticket: {
        id: "ticket-4",
        title: "Erro em homolog",
        createdBy: "creator-4",
        assignedToUserId: "support-4",
        companySlug: "demo",
        updatedAt: "2026-04-14T00:00:00.000Z",
      } as never,
      actorId: "support-4",
      nextStatusLabel: "Concluído",
    });

    const recipients = (createNotificationsForUsers as jest.Mock).mock.calls[0]?.[0] as string[];
    expect(recipients).toContain("creator-4");
    expect(recipients).not.toContain("company-user-1");
    expect(recipients).not.toContain("company-account-1");
    expect(recipients).not.toContain("tc-linked-1");
  });
});

