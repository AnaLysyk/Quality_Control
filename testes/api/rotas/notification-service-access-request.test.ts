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

import { createNotificationsForUsers } from "@/lib/userNotificationsStore";
import {
  listLocalCompanies,
  listLocalLinksForCompany,
  listLocalUsers,
  listLocalMemberships,
} from "@/lib/auth/localStore";
import {
  notifyAccessRequestCreated,
  notifyAccessRequestComment,
  notifyAccessRequestAccepted,
  notifyAccessRequestRejected,
} from "@/lib/notificationService";

describe("notificationService access request recipients", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (listLocalUsers as jest.Mock).mockResolvedValue([
      {
        id: "admin-1",
        is_global_admin: true,
        globalRole: "global_admin",
        role: "leader_tc",
      },
    ]);
    (listLocalMemberships as jest.Mock).mockResolvedValue([]);
    (listLocalCompanies as jest.Mock).mockResolvedValue([
      { id: "company-demo", slug: "demo" },
    ]);
    (listLocalLinksForCompany as jest.Mock).mockResolvedValue([
      { userId: "company-user-1" },
      { userId: "company-account-1" },
      { userId: "tc-linked-1" },
    ]);
  });

  it("notifica vinculados da empresa na criacao da solicitacao", async () => {
    await notifyAccessRequestCreated({
      requestId: "req-1",
      requesterName: "Fulano",
      profileType: "company_user",
      reviewQueue: "admin_and_global",
      clientId: "company-demo",
    });

    expect(createNotificationsForUsers).toHaveBeenCalledWith(
      expect.arrayContaining(["admin-1", "company-user-1", "company-account-1", "tc-linked-1"]),
      expect.objectContaining({
        type: "ACCESS_REQUEST_CREATED",
        requestId: "req-1",
      }),
    );
  });

  it("notifica vinculados da empresa em comentario", async () => {
    await notifyAccessRequestComment({
      requestId: "req-2",
      commentId: "comment-2",
      authorName: "Fulano",
      body: "Ajustei os dados solicitados.",
      reviewQueue: "admin_and_global",
      clientId: "company-demo",
    });

    expect(createNotificationsForUsers).toHaveBeenCalledWith(
      expect.arrayContaining(["admin-1", "company-user-1", "company-account-1", "tc-linked-1"]),
      expect.objectContaining({
        type: "ACCESS_REQUEST_COMMENT",
        requestId: "req-2",
      }),
    );
  });

  it("notifica vinculados da empresa em aceite e rejeicao", async () => {
    await notifyAccessRequestAccepted({
      requestId: "req-3",
      requesterName: "Fulano",
      approverName: "Admin",
      profileType: "company_user",
      reviewQueue: "admin_and_global",
      clientId: "company-demo",
    });

    await notifyAccessRequestRejected({
      requestId: "req-3",
      requesterName: "Fulano",
      rejectorName: "Admin",
      profileType: "company_user",
      reviewQueue: "admin_and_global",
      reason: "Dados inconsistentes",
      clientId: "company-demo",
    });

    expect(createNotificationsForUsers).toHaveBeenCalledWith(
      expect.arrayContaining(["admin-1", "company-user-1", "company-account-1", "tc-linked-1"]),
      expect.objectContaining({
        type: "ACCESS_REQUEST_ACCEPTED",
        requestId: "req-3",
      }),
    );

    expect(createNotificationsForUsers).toHaveBeenCalledWith(
      expect.arrayContaining(["admin-1", "company-user-1", "company-account-1", "tc-linked-1"]),
      expect.objectContaining({
        type: "ACCESS_REQUEST_REJECTED",
        requestId: "req-3",
      }),
    );
  });

  it("nao adiciona vinculados da empresa quando fan-out estiver desativado", async () => {
    (listLocalCompanies as jest.Mock).mockResolvedValue([
      { id: "company-demo", slug: "demo", notifications_fanout_enabled: false },
    ]);
    (listLocalLinksForCompany as jest.Mock).mockResolvedValueOnce([
      { userId: "company-user-1" },
      { userId: "company-account-1" },
      { userId: "tc-linked-1" },
    ]);

    await notifyAccessRequestCreated({
      requestId: "req-4",
      requesterName: "Fulano",
      profileType: "company_user",
      reviewQueue: "admin_and_global",
      clientId: "company-demo",
    });

    const recipients = (createNotificationsForUsers as jest.Mock).mock.calls[0]?.[0] as string[];
    expect(recipients).toContain("admin-1");
    expect(recipients).not.toContain("company-user-1");
    expect(recipients).not.toContain("company-account-1");
    expect(recipients).not.toContain("tc-linked-1");
  });
});
