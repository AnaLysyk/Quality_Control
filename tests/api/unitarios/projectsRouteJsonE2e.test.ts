jest.mock("@/backend/context/operationalContext", () => ({
  resolveOperationalContext: jest.fn(),
}));

import { GET } from "@/api/projects/route";
import { resolveOperationalContext } from "@/backend/context/operationalContext";

const mockedResolveOperationalContext = resolveOperationalContext as jest.MockedFunction<
  typeof resolveOperationalContext
>;

const ACCESS = {
  userId: "usr-e2e-relational",
  email: "relational@example.test",
  isGlobalAdmin: false,
  role: "testing_company_user",
  permissionRole: "testing_company_user",
  companyRole: "testing_company_user",
  companyId: "cmp-a",
  companySlug: "empresa-a",
  companySlugs: ["empresa-a", "empresa-b"],
  allowedProjectIds: null,
  projectScope: "restricted",
  capabilities: [],
  assignments: [
    {
      companyId: "cmp-a",
      companySlug: "empresa-a",
      companyName: "Empresa A",
      projectId: null,
      projectSlug: null,
      projectName: null,
      projectAccess: "all_company_projects",
      role: "testing_company_user",
      status: "active",
      source: "membership",
    },
    {
      companyId: "cmp-b",
      companySlug: "empresa-b",
      companyName: "Empresa B",
      projectId: null,
      projectSlug: null,
      projectName: null,
      projectAccess: "all_company_projects",
      role: "testing_company_user",
      status: "active",
      source: "membership",
    },
  ],
} as any;

describe("GET /api/projects em E2E_USE_JSON", () => {
  const previousE2eUseJson = process.env.E2E_USE_JSON;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.E2E_USE_JSON = "1";
    mockedResolveOperationalContext.mockResolvedValue({
      ok: true,
      context: { access: ACCESS },
    } as any);
  });

  afterAll(() => {
    if (previousE2eUseJson === undefined) delete process.env.E2E_USE_JSON;
    else process.env.E2E_USE_JSON = previousE2eUseJson;
  });

  it("retorna o projeto determinístico da empresa sem consultar Prisma", async () => {
    const response = await GET(
      new Request("https://app.local/api/projects?companySlug=empresa-b"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.access).toEqual({ mode: "all", projectIds: [] });
    expect(body.projects).toEqual([
      expect.objectContaining({
        id: "e2e-project-empresa-b",
        slug: "portal-empresa-b",
        name: "Portal empresa-b",
        companyId: "cmp-b",
      }),
    ]);
  });

  it("não cria projeto para empresa sem assignment", async () => {
    const response = await GET(
      new Request("https://app.local/api/projects?companySlug=empresa-c"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      projects: [],
      access: { mode: "none", projectIds: [] },
    });
  });
});
