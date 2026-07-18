/// <reference types="jest" />

jest.mock("@/backend/auth/session", () => ({
  getAccessContext: jest.fn(),
}));

jest.mock("@/backend/serverPermissionAccess", () => ({
  resolvePermissionAccessForUser: jest.fn(),
}));

jest.mock("@/backend/adminUsers", () => ({
  getAdminUserItem: jest.fn(),
}));

jest.mock("@/backend/auth/localStore", () => ({
  findLocalCompanyById: jest.fn(),
  listLocalLinksForUser: jest.fn(),
  listLocalUsers: jest.fn(),
  removeLocalLink: jest.fn(),
  updateLocalUser: jest.fn(),
  upsertLocalLink: jest.fn(),
}));

jest.mock("@/data/auditLogRepository", () => ({
  addAuditLogSafe: jest.fn(),
}));

jest.mock("@/backend/brain/autoSync", () => ({
  brainOnUserCreated: jest.fn(),
}));

jest.mock("@/backend/email", () => ({
  emailService: {
    sendWelcomeEmail: jest.fn(),
  },
}));

import { DELETE, GET, PATCH } from "../../../app/api/admin/users/[id]/route";

type RouteParams = Parameters<typeof GET>[1];

const { getAccessContext } = jest.requireMock("@/backend/auth/session") as {
  getAccessContext: jest.Mock;
};
const { resolvePermissionAccessForUser } = jest.requireMock("@/backend/serverPermissionAccess") as {
  resolvePermissionAccessForUser: jest.Mock;
};
const { getAdminUserItem } = jest.requireMock("@/backend/adminUsers") as {
  getAdminUserItem: jest.Mock;
};
const localStore = jest.requireMock("@/backend/auth/localStore") as {
  listLocalLinksForUser: jest.Mock;
  updateLocalUser: jest.Mock;
};

const actorAccess = {
  userId: "actor-user",
  email: "actor@example.com",
  isGlobalAdmin: false,
  role: "testing_company_user",
  permissionRole: "testing_company_user",
  globalRole: null,
  companyRole: "testing_company_user",
  capabilities: [],
  companyId: null,
  companySlug: null,
  companySlugs: [],
};

function routeParams(): RouteParams {
  return { params: Promise.resolve({ id: "target-user" }) };
}

function request(method: string, body?: unknown) {
  return new Request("http://localhost/api/admin/users/target-user", {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as Parameters<typeof GET>[0];
}

function mockPermissions(permissions: Record<string, string[]>) {
  resolvePermissionAccessForUser.mockResolvedValue({
    userId: actorAccess.userId,
    roleKey: "testing_company_user",
    roleDefaults: {},
    override: null,
    permissions,
  });
}

describe("admin users [id] API permissions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getAccessContext.mockResolvedValue(actorAccess);
    getAdminUserItem.mockResolvedValue({
      id: "target-user",
      email: "target@example.com",
      user: "target",
      permission_role: "company_user",
    });
    localStore.listLocalLinksForUser.mockResolvedValue([]);
    localStore.updateLocalUser.mockResolvedValue({
      id: "target-user",
      email: "target@example.com",
      user: "target",
    });
  });

  it("permite GET direto quando a matriz efetiva tem users:view", async () => {
    mockPermissions({ users: ["view"] });

    const response = await GET(request("GET"), routeParams());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ item: { id: "target-user" } });
  });

  it("bloqueia GET direto sem users:view", async () => {
    mockPermissions({ users: [] });

    const response = await GET(request("GET"), routeParams());

    expect(response.status).toBe(403);
  });

  it("permite promover perfil privilegiado quando a matriz tem users:edit e permissions:edit", async () => {
    mockPermissions({ users: ["edit"], permissions: ["edit"] });

    const response = await PATCH(request("PATCH", { role: "leader_tc" }), routeParams());

    expect(response.status).toBe(200);
    expect(localStore.updateLocalUser).toHaveBeenCalledWith(
      "target-user",
      expect.objectContaining({
        globalRole: "global_admin",
        is_global_admin: true,
        role: "leader_tc",
      }),
    );
  });

  it("permite DELETE direto para perfil nao privilegiado quando a matriz tem users:delete", async () => {
    mockPermissions({ users: ["delete"] });

    const response = await DELETE(request("DELETE"), routeParams());

    expect(response.status).toBe(200);
    expect(localStore.updateLocalUser).toHaveBeenCalledWith(
      "target-user",
      expect.objectContaining({
        active: false,
        status: "blocked",
      }),
    );
  });
});
