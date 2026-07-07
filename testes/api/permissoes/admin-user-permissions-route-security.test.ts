/// <reference types="jest" />

jest.mock("@/lib/auth/session", () => ({
  getAccessContext: jest.fn(),
}));

jest.mock("@/lib/serverPermissionAccess", () => ({
  invalidatePermissionAccessCache: jest.fn(),
  resolvePermissionAccessForUser: jest.fn(),
}));

jest.mock("@/data/auditLogRepository", () => ({
  addAuditLogSafe: jest.fn(),
}));

jest.mock("@/lib/adminUsers", () => ({
  getAdminUserItem: jest.fn(),
}));

jest.mock("@/lib/notificationService", () => ({
  notifyUserAccessUpdated: jest.fn(),
}));

jest.mock("@/lib/brain/cache", () => ({
  invalidateBrainCache: jest.fn(),
}));

import { DELETE, GET, PATCH } from "../../../app/api/admin/users/[id]/permissions/route";

type PermissionRouteHandler = typeof GET;
type PermissionRouteParams = Parameters<PermissionRouteHandler>[1];

const { getAccessContext } = jest.requireMock("@/lib/auth/session") as {
  getAccessContext: jest.Mock;
};
const { resolvePermissionAccessForUser } = jest.requireMock("@/lib/serverPermissionAccess") as {
  resolvePermissionAccessForUser: jest.Mock;
};

const routeCases: Array<[string, PermissionRouteHandler]> = [
  ["GET", GET],
  ["PATCH", PATCH],
  ["DELETE", DELETE],
];

const actorAccess = {
  userId: "actor-without-permissions",
  email: "user-no-permissions@example.com",
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

function routeParams(): PermissionRouteParams {
  return { params: Promise.resolve({ id: "target-user" }) };
}

function makeRequest(method: string): Parameters<PermissionRouteHandler>[0] {
  return new Request("http://localhost/api/admin/users/target-user/permissions", {
    method,
    headers: { "content-type": "application/json" },
  }) as Parameters<PermissionRouteHandler>[0];
}

describe("admin user permissions API security", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getAccessContext.mockResolvedValue(actorAccess);
    resolvePermissionAccessForUser.mockResolvedValue({
      userId: actorAccess.userId,
      roleKey: "testing_company_user",
      roleDefaults: {},
      override: null,
      permissions: { users: ["view"] },
    });
  });

  it.each(routeCases)("returns 403 for direct %s calls without permissions permission", async (method, handler) => {
    const response = await handler(makeRequest(method), routeParams());

    expect(response.status).toBe(403);
    expect(resolvePermissionAccessForUser).toHaveBeenCalledWith(actorAccess.userId);
  });
});
