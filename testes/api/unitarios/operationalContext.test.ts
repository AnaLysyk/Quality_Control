jest.mock("@/backend/auth/session", () => ({ getAccessContext: jest.fn() }));
jest.mock("@/backend/serverPermissionAccess", () => ({ resolvePermissionAccessForUser: jest.fn() }));
jest.mock("@/backend/context/operationalProjectResolver", () => ({ resolveOperationalProject: jest.fn() }));

import { getAccessContext } from "@/backend/auth/session";
import { resolveOperationalContext, assertOperationalAccess } from "@/backend/context/operationalContext";
import { resolveOperationalProject } from "@/backend/context/operationalProjectResolver";
import { resolvePermissionAccessForUser } from "@/backend/serverPermissionAccess";

const mockedGetAccessContext = getAccessContext as jest.MockedFunction<typeof getAccessContext>;
const mockedResolvePermissions = resolvePermissionAccessForUser as jest.MockedFunction<
  typeof resolvePermissionAccessForUser
>;
const mockedResolveProject = resolveOperationalProject as jest.MockedFunction<typeof resolveOperationalProject>;

function assignment(input: {
  companyId: string;
  companySlug: string;
  projectId?: string | null;
  projectSlug?: string | null;
  projectAccess?: "company_only" | "selected_projects" | "all_company_projects";
}) {
  return {
    companyId: input.companyId,
    companySlug: input.companySlug,
    companyName: input.companySlug,
    projectId: input.projectId ?? null,
    projectSlug: input.projectSlug ?? null,
    projectName: input.projectSlug ?? null,
    projectAccess: input.projectAccess ?? "selected_projects",
    role: "leader_tc",
    status: "active" as const,
    source: "project_assignment" as const,
  };
}

const A_A1 = assignment({
  companyId: "A",
  companySlug: "empresa-a",
  projectId: "A1",
  projectSlug: "projeto-a1",
});
const B_B1 = assignment({
  companyId: "B",
  companySlug: "empresa-b",
  projectId: "B1",
  projectSlug: "projeto-b1",
});

function access(overrides: Record<string, unknown> = {}) {
  return {
    userId: "user-1",
    email: "user@example.com",
    user: "user",
    userOrigin: "testing_company",
    isGlobalAdmin: false,
    role: "leader_tc",
    permissionRole: "leader_tc",
    globalRole: null,
    companyRole: "leader_tc",
    capabilities: ["tickets:view", "tickets:delete"],
    companyId: "A",
    companySlug: "empresa-a",
    companySlugs: ["empresa-a", "empresa-b"],
    allowedProjectIds: ["A1", "B1"],
    assignments: [A_A1, B_B1],
    projectScope: "restricted",
    ...overrides,
  } as any;
}

function permissions(matrix: Record<string, string[]>) {
  mockedResolvePermissions.mockResolvedValue({
    userId: "user-1",
    roleKey: "leader_tc",
    roleDefaults: {},
    override: null,
    permissions: matrix,
  } as any);
}

function request(query = "") {
  return new Request(`https://app.local/api/test${query}`);
}

function resolvedProject(id: string, slug: string, companyId: string, companySlug: string) {
  mockedResolveProject.mockResolvedValue({
    kind: "resolved",
    project: { id, slug, companyId, companySlug },
  });
}

describe("operationalContext relacional - Etapa 2.3C", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetAccessContext.mockResolvedValue(access());
    permissions({ tickets: ["view", "create"] });
    mockedResolveProject.mockResolvedValue({ kind: "none" });
  });

  it("retorna 401 sem sessão", async () => {
    mockedGetAccessContext.mockResolvedValue(null);
    const result = await resolveOperationalContext(request(), { moduleId: "tickets", action: "view" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it("usa a matriz efetiva e respeita deny mesmo quando capabilities/defaults permitiriam", async () => {
    permissions({ tickets: [] });
    const result = await resolveOperationalContext(request(), { moduleId: "tickets", action: "view" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it("usa a matriz efetiva para screenCapabilities e assertOperationalAccess", async () => {
    permissions({ tickets: ["view", "create"] });
    const result = await resolveOperationalContext(request(), { moduleId: "tickets", action: "view" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.context.screenCapabilities.canRead).toBe(true);
    expect(result.context.screenCapabilities.canCreate).toBe(true);
    expect(result.context.screenCapabilities.canDelete).toBe(false);
    expect(assertOperationalAccess(result.context, { moduleId: "tickets", action: "delete" })).toBe(false);
  });

  it("aceita o par real Empresa A + Projeto A1", async () => {
    resolvedProject("A1", "projeto-a1", "A", "empresa-a");
    const result = await resolveOperationalContext(request("?companyId=A&projectId=A1"), {
      moduleId: "tickets",
      action: "view",
      requireCompany: true,
      requireProject: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.companyId).toBe("A");
      expect(result.context.projectId).toBe("A1");
    }
  });

  it("nega produto cartesiano Empresa A + Projeto B1", async () => {
    resolvedProject("B1", "projeto-b1", "B", "empresa-b");
    const result = await resolveOperationalContext(request("?companyId=A&projectId=B1"), {
      moduleId: "tickets",
      action: "view",
      requireCompany: true,
      requireProject: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it("resolve a empresa pelo projeto quando nenhum companyId/companySlug foi enviado", async () => {
    resolvedProject("B1", "projeto-b1", "B", "empresa-b");
    const result = await resolveOperationalContext(request("?projectId=B1"), {
      moduleId: "tickets",
      action: "view",
      requireCompany: true,
      requireProject: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.companyId).toBe("B");
      expect(result.context.companySlug).toBe("empresa-b");
    }
  });

  it("nega projeto para vínculo company_only", async () => {
    mockedGetAccessContext.mockResolvedValue(
      access({
        companyId: "A",
        companySlug: "empresa-a",
        companySlugs: ["empresa-a"],
        allowedProjectIds: null,
        projectScope: "none",
        assignments: [
          assignment({
            companyId: "A",
            companySlug: "empresa-a",
            projectAccess: "company_only",
          }),
        ],
      }),
    );
    resolvedProject("A1", "projeto-a1", "A", "empresa-a");
    const result = await resolveOperationalContext(request("?companyId=A&projectId=A1"), {
      moduleId: "tickets",
      action: "view",
    });
    expect(result.ok).toBe(false);
  });

  it("aceita contexto só de empresa quando o vínculo company_only é real", async () => {
    mockedGetAccessContext.mockResolvedValue(
      access({
        projectScope: "none",
        assignments: [
          assignment({ companyId: "A", companySlug: "empresa-a", projectAccess: "company_only" }),
        ],
      }),
    );
    const result = await resolveOperationalContext(request("?companyId=A"), {
      moduleId: "tickets",
      action: "view",
      requireCompany: true,
    });
    expect(result.ok).toBe(true);
  });

  it("all_company_projects exige a empresa real resolvida pelo servidor", async () => {
    mockedGetAccessContext.mockResolvedValue(
      access({
        projectScope: "restricted",
        assignments: [
          assignment({
            companyId: "A",
            companySlug: "empresa-a",
            projectAccess: "all_company_projects",
          }),
        ],
      }),
    );
    resolvedProject("B1", "projeto-b1", "B", "empresa-b");
    const result = await resolveOperationalContext(request("?companyId=A&projectId=B1"), {
      moduleId: "tickets",
      action: "view",
    });
    expect(result.ok).toBe(false);
  });

  it("projectScope none nunca vira acesso irrestrito", async () => {
    mockedGetAccessContext.mockResolvedValue(
      access({ projectScope: "none", assignments: [], allowedProjectIds: null }),
    );
    resolvedProject("A1", "projeto-a1", "A", "empresa-a");
    const result = await resolveOperationalContext(request("?companyId=A&projectId=A1"), {
      moduleId: "tickets",
      action: "view",
    });
    expect(result.ok).toBe(false);
  });

  it("projectScope unrestricted permite o projeto resolvido sem assignment sintético", async () => {
    mockedGetAccessContext.mockResolvedValue(
      access({
        isGlobalAdmin: true,
        projectScope: "unrestricted",
        assignments: [],
        companyId: null,
        companySlug: null,
        companySlugs: ["empresa-a", "empresa-b"],
        allowedProjectIds: null,
      }),
    );
    resolvedProject("B1", "projeto-b1", "B", "empresa-b");
    const result = await resolveOperationalContext(request("?companyId=B&projectId=B1"), {
      moduleId: "tickets",
      action: "view",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.context.scope).toBe("global");
  });

  it("deriva allowedProjectIds dos assignments relacionais, não do array legado", async () => {
    mockedGetAccessContext.mockResolvedValue(
      access({ allowedProjectIds: ["PROJETO-LEGADO-INCORRETO"] }),
    );
    const result = await resolveOperationalContext(request(), {
      moduleId: "tickets",
      action: "view",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.context.allowedProjectIds.sort()).toEqual(["A1", "B1"]);
  });
});
