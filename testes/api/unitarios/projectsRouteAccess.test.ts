jest.mock("@/lib/context/operationalContext", () => ({ resolveOperationalContext: jest.fn() }));
jest.mock("@/lib/audit/writeAuditLog", () => ({ writeAuditLog: jest.fn() }));

const companyFindUnique = jest.fn();
const projectFindMany = jest.fn();
const projectFindUnique = jest.fn();
const projectCreate = jest.fn();

jest.mock("@/lib/prismaClient", () => ({
  prisma: {
    company: { findUnique: companyFindUnique },
    project: {
      findMany: projectFindMany,
      findUnique: projectFindUnique,
      create: projectCreate,
    },
  },
}));

import { GET } from "@/api/projects/route";
import { resolveOperationalContext } from "@/lib/context/operationalContext";

const mockedResolveOperationalContext = resolveOperationalContext as jest.MockedFunction<
  typeof resolveOperationalContext
>;

function assignment(input: {
  companyId?: string;
  companySlug?: string;
  projectId?: string | null;
  projectAccess?: "company_only" | "selected_projects" | "all_company_projects";
}) {
  return {
    companyId: input.companyId ?? "A",
    companySlug: input.companySlug ?? "empresa-a",
    companyName: "Empresa A",
    projectId: input.projectId === undefined ? "A1" : input.projectId,
    projectSlug: input.projectId ? `slug-${input.projectId}` : null,
    projectName: input.projectId ? `Projeto ${input.projectId}` : null,
    projectAccess: input.projectAccess ?? "selected_projects",
    role: "leader_tc",
    status: "active" as const,
    source: input.projectAccess === "selected_projects" || input.projectAccess === undefined
      ? ("project_assignment" as const)
      : ("membership" as const),
  };
}

function mockContext(overrides: Record<string, unknown> = {}) {
  mockedResolveOperationalContext.mockResolvedValue({
    ok: true,
    context: {
      access: {
        userId: "u-1",
        email: "u@example.com",
        isGlobalAdmin: false,
        projectScope: "restricted",
        assignments: [assignment({ projectId: "A1" })],
        allowedProjectIds: ["LEGADO-ERRADO"],
        companyId: "A",
        companySlug: "empresa-a",
        companySlugs: ["empresa-a"],
        capabilities: [],
        ...overrides,
      },
    },
  } as any);
}

function request(companySlug = "empresa-a") {
  return new Request(`https://app.local/api/projects?companySlug=${companySlug}`);
}

describe("GET /api/projects - escopo relacional", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.E2E_USE_JSON;
    companyFindUnique.mockResolvedValue({ id: "A", slug: "empresa-a" });
    projectFindMany.mockResolvedValue([
      {
        id: "A1",
        slug: "slug-A1",
        name: "Projeto A1",
        description: null,
        status: "active",
        color: null,
        iconKey: "folder",
        companyId: "A",
        createdAt: new Date(0),
        qaseProjectCode: null,
        jiraProjectKey: null,
        manualCreationDisabled: false,
      },
    ]);
    mockContext();
  });

  it("retorna 400 sem companySlug", async () => {
    const response = await GET(new Request("https://app.local/api/projects"));
    expect(response.status).toBe(400);
    expect(mockedResolveOperationalContext).not.toHaveBeenCalled();
  });

  it("propaga 403 do operationalContext", async () => {
    mockedResolveOperationalContext.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Sem permissão" }), { status: 403 }),
    } as any);
    const response = await GET(request());
    expect(response.status).toBe(403);
    expect(companyFindUnique).not.toHaveBeenCalled();
  });

  it("selected_projects filtra somente IDs relacionais e ignora allowedProjectIds legado", async () => {
    mockContext({
      projectScope: "restricted",
      assignments: [assignment({ projectId: "A2" }), assignment({ projectId: "A1" })],
      allowedProjectIds: ["LEGADO-ERRADO"],
    });

    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(projectFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyId: "A",
          status: "active",
          id: { in: ["A1", "A2"] },
        },
      }),
    );
    const body = await response.json();
    expect(body.access).toEqual({ mode: "selected", projectIds: ["A1", "A2"] });
  });

  it("all_company_projects lista todos os projetos ativos da empresa sem filtro de IDs", async () => {
    mockContext({
      projectScope: "restricted",
      assignments: [assignment({ projectId: null, projectAccess: "all_company_projects" })],
    });

    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(projectFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: "A", status: "active" } }),
    );
    const body = await response.json();
    expect(body.access).toEqual({ mode: "all", projectIds: [] });
  });

  it("company_only retorna lista vazia e não consulta projetos", async () => {
    mockContext({
      projectScope: "none",
      assignments: [assignment({ projectId: null, projectAccess: "company_only" })],
      allowedProjectIds: null,
    });

    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(projectFindMany).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      projects: [],
      access: { mode: "none", projectIds: [] },
    });
  });

  it("projectScope unrestricted lista todos sem assignment sintético", async () => {
    mockContext({
      isGlobalAdmin: true,
      projectScope: "unrestricted",
      assignments: [],
      allowedProjectIds: null,
    });

    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(projectFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: "A", status: "active" } }),
    );
  });

  it("companyId e companySlug conflitantes nos assignments não liberam projetos", async () => {
    mockContext({
      projectScope: "restricted",
      assignments: [assignment({ companyId: "A", companySlug: "empresa-b", projectId: "A1" })],
    });

    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(projectFindMany).not.toHaveBeenCalled();
    const body = await response.json();
    expect(body.projects).toEqual([]);
    expect(body.access.mode).toBe("none");
  });
});
