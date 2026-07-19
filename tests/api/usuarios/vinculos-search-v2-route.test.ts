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

  it("restringe operador de empresa aos modos qa_users/business_users, ignorando 'companies' pedido", async () => {
    mockedAuthenticateRequest.mockResolvedValue(baseUser() as never);
    mockedCheckPermission.mockReturnValue(true);

    const res = await GET(makeRequest("https://app.local/api/usuarios/vinculos/search-v2?mode=companies"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.allowedModes).toEqual(["qa_users", "business_users"]);
    expect(body.mode).toBe("qa_users");
    expect(body.companyOperator).toBe(true);
  });

  it("libera todos os modos, incluindo 'companies', para perfil com visão de plataforma", async () => {
    mockedAuthenticateRequest.mockResolvedValue(baseUser({ role: "technical_support", permissionRole: "technical_support", companyRole: "technical_support" }) as never);
    mockedCheckPermission.mockReturnValue(true);

    const res = await GET(makeRequest("https://app.local/api/usuarios/vinculos/search-v2?mode=companies"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.allowedModes).toEqual(["companies", "leaders", "qa_users", "business_users"]);
    expect(body.mode).toBe("companies");
  });

  it("bloqueia query curta (1-2 caracteres) sem consultar o banco, mas ainda devolve permissions", async () => {
    mockedAuthenticateRequest.mockResolvedValue(baseUser() as never);
    mockedCheckPermission.mockImplementation((_user, permission) => permission === "relationships:view" || permission === "relationships:edit");

    const res = await GET(makeRequest("https://app.local/api/usuarios/vinculos/search-v2?q=ab"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.people).toEqual([]);
    expect(body.permissions).toEqual({ canCreate: false, canEdit: true, canDelete: false });
    expect(mockPrisma().user.findMany).not.toHaveBeenCalled();
  });

  it("retorna pessoas no modo qa_users com query válida", async () => {
    mockedAuthenticateRequest.mockResolvedValue(baseUser() as never);
    mockedCheckPermission.mockReturnValue(true);
    mockPrisma().user.findMany.mockResolvedValue([{ id: "qa-1", name: "Fulano TC", email: "fulano@x.com" }]);

    const res = await GET(makeRequest("https://app.local/api/usuarios/vinculos/search-v2?mode=qa_users&q=fulano"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.people).toEqual([{ id: "qa-1", name: "Fulano TC", email: "fulano@x.com" }]);
  });
});
