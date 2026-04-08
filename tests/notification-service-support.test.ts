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
import { notifyTicketCommentAdded } from "@/lib/notificationService";

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
        companySlug: "griaule",
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
});
