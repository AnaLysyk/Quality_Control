jest.mock("@/backend/jwtAuth", () => ({ authenticateRequest: jest.fn() }));
jest.mock("@/backend/permissions/checkPermission", () => ({ checkPermission: jest.fn() }));
jest.mock("@/database/prismaClient", () => ({
  prisma: {
    membership: { findMany: jest.fn() },
    userCompanyLink: { findMany: jest.fn() },
    projectTeamAssignment: { findMany: jest.fn() },
    company: { findMany: jest.fn() },
    user: { findMany: jest.fn() },
  },
}));

import { GET } from "@/api/usuarios/vinculos/search-v2/route";
import { authenticateRequest } from "@/backend/jwtAuth";
import { checkPermission } from "@/backend/permissions/checkPermission";
import { prisma } from "@/database/prismaClient";

const mockedAuthenticateRequest = authenticateRequest as jest.MockedFunction<typeof authenticateRequest>;
const mockedCheckPermission = checkPermission as jest.MockedFunction<typeof checkPermission>;

function mockPrisma() {
  return prisma as unknown as {
    membership: { findMany: jest.Mock };
    userCompanyLink: { findMany: jest.Mock };
    projectTeamAssignment: { findMany: jest.Mock };
    company: { findMany: jest.Mock };
    user: { findMany: jest.Mock };
  };
}

function baseUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    email: "user1@example.com",
    isGlobalAdmin: false,
    role: "empresa",
    permissionRole: "empresa",
    companyRole: "empresa",
    globalRole: null,
    companyId: "company-1",
    ...overrides,
  };
}

function makeRequest(url: string) {
  return new Request(url, { method: "GET" }) as unknown as Request;
}

const platformUser = baseUser({
  role: "technical_support",
  permissionRole: "technical_support",
  companyRole: "technical_support",
  companyId: null,
});

describe("app/api/usuarios/vinculos/search-v2/route.ts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const db = mockPrisma();
    db.membership.findMany.mockResolvedValue([]);
    db.userCompanyLink.findMany.mockResolvedValue([]);
    db.projectTeamAssignment.findMany.mockResolvedValue([]);
    db.company.findMany.mockResolvedValue([]);
    db.user.findMany.mockResolvedValue([]);
  });

  it("retorna 401 sem usuário autenticado", async () => {
    mockedAuthenticateRequest.mockResolvedValue(null);
    const res = await GET(makeRequest("https://app.local/api/usuarios/vinculos/search-v2"));
    expect(res.status).toBe(401);
  });

  it("retorna 403 sem relationships:view", async () => {
    mockedAuthenticateRequest.mockResolvedValue(baseUser() as never);
    mockedCheckPermission.mockReturnValue(false);
    const res = await GET(makeRequest("https://app.local/api/usuarios/vinculos/search-v2"));
    expect(res.status).toBe(403);
  });

  it("restringe operador de empresa aos modos qa_users/business_users", async () => {
    mockedAuthenticateRequest.mockResolvedValue(baseUser() as never);
    mockedCheckPermission.mockReturnValue(true);

    const res = await GET(makeRequest("https://app.local/api/usuarios/vinculos/search-v2?mode=companies"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.allowedModes).toEqual(["qa_users", "business_users"]);
    expect(body.mode).toBe("qa_users");
    expect(body.companyOperator).toBe(true);
  });

  it("libera todos os modos para perfil com visão de plataforma", async () => {
    mockedAuthenticateRequest.mockResolvedValue(platformUser as never);
    mockedCheckPermission.mockReturnValue(true);

    const res = await GET(makeRequest("https://app.local/api/usuarios/vinculos/search-v2?mode=companies"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.allowedModes).toEqual(["companies", "leaders", "qa_users", "business_users"]);
    expect(body.mode).toBe("companies");
  });

  it("bloqueia query curta sem consultar pessoas ou empresas", async () => {
    mockedAuthenticateRequest.mockResolvedValue(baseUser() as never);
    mockedCheckPermission.mockImplementation((_user, permission) => permission === "relationships:view" || permission === "relationships:edit");

    const res = await GET(makeRequest("https://app.local/api/usuarios/vinculos/search-v2?q=ab"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.people).toEqual([]);
    expect(body.permissions).toEqual({ canCreate: false, canEdit: true, canDelete: false });
    expect(mockPrisma().user.findMany).not.toHaveBeenCalled();
    expect(mockPrisma().company.findMany).not.toHaveBeenCalled();
  });

  it("combina companyId, memberships, links e assignments no escopo do operador", async () => {
    mockedAuthenticateRequest.mockResolvedValue(baseUser() as never);
    mockedCheckPermission.mockReturnValue(true);
    const db = mockPrisma();
    db.membership.findMany.mockResolvedValue([{ companyId: "company-2" }]);
    db.userCompanyLink.findMany.mockResolvedValue([{ companyId: "company-3" }]);
    db.projectTeamAssignment.findMany
      .mockResolvedValueOnce([{ companyId: "company-4" }])
      .mockResolvedValueOnce([]);

    const res = await GET(makeRequest("https://app.local/api/usuarios/vinculos/search-v2?mode=qa_users&q=fulano"));

    expect(res.status).toBe(200);
    expect(db.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        AND: expect.arrayContaining([
          expect.objectContaining({ OR: expect.any(Array) }),
        ]),
      }),
    }));
  });

  it("retorna empresas e assignments ativos no modo companies", async () => {
    mockedAuthenticateRequest.mockResolvedValue(platformUser as never);
    mockedCheckPermission.mockReturnValue(true);
    const db = mockPrisma();
    db.company.findMany.mockResolvedValue([
      { id: "company-1", name: "Empresa A", company_name: "Empresa A", slug: "empresa-a", status: "active", logo_url: null },
    ]);
    db.projectTeamAssignment.findMany.mockResolvedValue([
      { id: "assignment-1", role: "leader_tc", status: "active", company: { id: "company-1" }, project: { id: "project-1" }, user: { id: "leader-1" } },
    ]);

    const res = await GET(makeRequest("https://app.local/api/usuarios/vinculos/search-v2?mode=companies&q=empresa"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.modeLabel).toBe("Empresas");
    expect(body.companies).toHaveLength(1);
    expect(body.assignments).toHaveLength(1);
    expect(db.user.findMany).not.toHaveBeenCalled();
  });

  it.each([
    ["leaders", "Líder TC"],
    ["qa_users", "Usuário TC"],
    ["business_users", "Usuário empresarial"],
  ])("consulta pessoas no modo %s", async (mode, expectedLabel) => {
    mockedAuthenticateRequest.mockResolvedValue(platformUser as never);
    mockedCheckPermission.mockReturnValue(true);
    const db = mockPrisma();
    db.user.findMany.mockResolvedValue([{ id: `${mode}-1`, name: "Pessoa", email: "pessoa@x.com" }]);
    db.projectTeamAssignment.findMany.mockResolvedValue([{ id: "assignment-1", user: { id: `${mode}-1` } }]);

    const res = await GET(makeRequest(`https://app.local/api/usuarios/vinculos/search-v2?mode=${mode}&q=pessoa`));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.modeLabel).toBe(expectedLabel);
    expect(body.people).toHaveLength(1);
    expect(body.assignments).toHaveLength(1);
  });

  it("não consulta assignments quando não há resultados", async () => {
    mockedAuthenticateRequest.mockResolvedValue(platformUser as never);
    mockedCheckPermission.mockReturnValue(true);

    const res = await GET(makeRequest("https://app.local/api/usuarios/vinculos/search-v2?mode=leaders&q=inexistente"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.people).toEqual([]);
    expect(body.assignments).toEqual([]);
    expect(mockPrisma().projectTeamAssignment.findMany).not.toHaveBeenCalled();
  });
});