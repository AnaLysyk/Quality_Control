import { buildCurrentUserResponse } from "@/backend/auth/currentUserResponse";

const access = {
  userId: "user-1",
  email: "ana@example.com",
  user: "ana",
  userOrigin: "testing_company",
  isGlobalAdmin: false,
  role: "leader_tc",
  permissionRole: "leader_tc",
  globalRole: null,
  companyRole: "leader_tc",
  capabilities: ["tickets:view"],
  companyId: "cmp-b",
  companySlug: "empresa-b",
  companySlugs: ["empresa-b", "empresa-a"],
  allowedProjectIds: ["proj-b1", "proj-a1"],
  projectScope: "restricted",
  assignments: [
    {
      companyId: "cmp-b",
      companySlug: "empresa-b",
      companyName: "Empresa B",
      projectId: "proj-b1",
      projectSlug: "b1",
      projectName: "B1",
      projectAccess: "selected_projects",
      role: "leader_tc",
      status: "active",
      source: "project_assignment",
    },
    {
      companyId: "cmp-a",
      companySlug: "empresa-a",
      companyName: "Empresa A",
      projectId: "proj-a1",
      projectSlug: "a1",
      projectName: "A1",
      projectAccess: "selected_projects",
      role: "leader_tc",
      status: "active",
      source: "project_assignment",
    },
  ],
} as const;

const user = {
  id: "user-1",
  email: "ana@example.com",
  name: "Ana",
  full_name: "Ana Paula",
  user: "ana",
  avatar_key: "robot",
  avatar_url: "/avatar.png",
  active: true,
  status: "active",
  password_hash: "nao-pode-vazar",
  qase_token: "nao-pode-vazar",
} as any;

describe("buildCurrentUserResponse", () => {
  it("produz contrato canônico, ordena assignments e não modifica o input", () => {
    const originalAssignments = access.assignments.map((item) => ({ ...item }));
    const result = buildCurrentUserResponse({
      access: access as any,
      permissions: { tickets: ["edit", "view", "view"], dashboard: ["view"] },
      permissionRole: "leader_tc",
      user,
      companyLogoUrl: "/logo.png",
    });

    expect(result.user.name).toBe("Ana Paula");
    expect(result.user.permissionRole).toBe("leader_tc");
    expect(result.user.companyLogoUrl).toBe("/logo.png");
    expect(result.access.projectScope).toBe("restricted");
    expect(result.access.assignments.map((item) => `${item.companySlug}:${item.projectSlug}`)).toEqual([
      "empresa-a:a1",
      "empresa-b:b1",
    ]);
    expect(result.permissions).toEqual({
      dashboard: ["view"],
      tickets: ["edit", "view"],
    });
    expect(access.assignments).toEqual(originalAssignments);
  });

  it("preserva none e [] sem converter para unrestricted", () => {
    const result = buildCurrentUserResponse({
      access: {
        ...(access as any),
        projectScope: "none",
        assignments: [],
        allowedProjectIds: [],
      },
      permissions: {},
      permissionRole: "company_user",
      user,
    });

    expect(result.access.projectScope).toBe("none");
    expect(result.access.assignments).toEqual([]);
    expect(result.access.allowedProjectIds).toEqual([]);
  });

  it("preserva unrestricted e null sem criar assignment global sintético", () => {
    const result = buildCurrentUserResponse({
      access: {
        ...(access as any),
        isGlobalAdmin: true,
        projectScope: "unrestricted",
        assignments: [],
        allowedProjectIds: null,
      },
      permissions: {},
      permissionRole: "leader_tc",
      user,
    });

    expect(result.access.projectScope).toBe("unrestricted");
    expect(result.access.assignments).toEqual([]);
    expect(result.access.allowedProjectIds).toBeNull();
  });

  it("usa allowlist e não serializa segredos do objeto de usuário", () => {
    const result = buildCurrentUserResponse({
      access: access as any,
      permissions: {},
      permissionRole: "leader_tc",
      user,
    });
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("nao-pode-vazar");
    expect(serialized).not.toContain("password_hash");
    expect(serialized).not.toContain("qase_token");
    expect(serialized).not.toContain("authorization");
    expect(serialized).not.toContain("cookie");
  });
});
