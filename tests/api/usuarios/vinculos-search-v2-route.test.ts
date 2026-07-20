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

const auth = authenticateRequest as jest.MockedFunction<typeof authenticateRequest>;
const permission = checkPermission as jest.MockedFunction<typeof checkPermission>;
const db = prisma as unknown as {
  membership: { findMany: jest.Mock };
  userCompanyLink: { findMany: jest.Mock };
  projectTeamAssignment: { findMany: jest.Mock };
  company: { findMany: jest.Mock };
  user: { findMany: jest.Mock };
};

function user(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    email: "user@example.com",
    isGlobalAdmin: false,
    role: "empresa",
    permissionRole: "empresa",
    companyRole: "empresa",
    globalRole: null,
    companyId: "company-1",
    ...overrides,
  };
}

function request(url: string) {
  return new Request(url, { method: "GET" }) as unknown as Request;
}

describe("search-v2 relationship route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.membership.findMany.mockResolvedValue([]);
    db.userCompanyLink.findMany.mockResolvedValue([]);
    db.projectTeamAssignment.findMany.mockResolvedValue([]);
    db.company.findMany.mockResolvedValue([]);
    db.user.findMany.mockResolvedValue([]);
  });

  it("retorna 401 sem autenticação", async () => {
    auth.mockResolvedValue(null);
    expect((await GET(request("https://app.local/api/usuarios/vinculos/search-v2"))).status).toBe(401);
  });

  it("retorna 403 sem permissão de visualização", async () => {
    auth.mockResolvedValue(user() as never);
    permission.mockReturnValue(false);
    expect((await GET(request("https://app.local/api/usuarios/vinculos/search-v2"))).status).toBe(403);
  });

  it("restringe operador empresarial aos modos permitidos", async () => {
    auth.mockResolvedValue(user() as never);
    permission.mockReturnValue(true);

    const body = await (await GET(request("https://app.local/api/usuarios/vinculos/search-v2?mode=companies"))).json();
    expect(body.allowedModes).toEqual(["qa_users", "business_users"]);
    expect(body.mode).toBe("qa_users");
    expect(body.companyOperator).toBe(true);
  });

  it("libera todos os modos para suporte técnico", async () => {
    auth.mockResolvedValue(user({
      isGlobalAdmin: true,
      role: "technical_support",
      permissionRole: "technical_support",
      companyRole: "technical_support",
      companyId: null,
    }) as never);
    permission.mockReturnValue(true);

    const body = await (await GET(request("https://app.local/api/usuarios/vinculos/search-v2?mode=companies"))).json();
    expect(body.allowedModes).toEqual(["companies", "leaders", "qa_users", "business_users"]);
    expect(body.mode).toBe("companies");
  });

  it("não consulta entidades quando a busca é curta", async () => {
    auth.mockResolvedValue(user() as never);
    permission.mockImplementation((_current, name) => name === "relationships:view" || name === "relationships:edit");

    const body = await (await GET(request("https://app.local/api/usuarios/vinculos/search-v2?q=ab"))).json();
    expect(body.people).toEqual([]);
    expect(body.permissions).toEqual({ canCreate: false, canEdit: true, canDelete: false });
    expect(db.user.findMany).not.toHaveBeenCalled();
    expect(db.company.findMany).not.toHaveBeenCalled();
  });

  it("combina todas as fontes de escopo empresarial", async () => {
    auth.mockResolvedValue(user() as never);
    permission.mockReturnValue(true);
    db.membership.findMany.mockResolvedValue([{ companyId: "company-2" }]);
    db.userCompanyLink.findMany.mockResolvedValue([{ companyId: "company-3" }]);
    db.projectTeamAssignment.findMany.mockImplementation(({ where }: { where?: Record<string, unknown> }) => {
      if (where?.userId === "user-1") return Promise.resolve([{ companyId: "company-4" }]);
      return Promise.resolve([]);
    });

    await GET(request("https://app.local/api/usuarios/vinculos/search-v2?mode=qa_users&q=fulano"));
    expect(db.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ AND: expect.any(Array) }),
    }));
  });

  it("retorna empresas e assignments ativos no modo companies", async () => {
    auth.mockResolvedValue(user({
      isGlobalAdmin: true,
      role: "technical_support",
      permissionRole: "technical_support",
      companyRole: "technical_support",
      companyId: null,
    }) as never);
    permission.mockReturnValue(true);
    db.company.findMany.mockResolvedValue([
      { id: "company-1", name: "Empresa A", company_name: "Empresa A", slug: "empresa-a", status: "active", logo_url: null },
    ]);
    db.projectTeamAssignment.findMany.mockImplementation(({ where }: { where?: { companyId?: unknown } }) => {
      if (where?.companyId) {
        return Promise.resolve([
          { id: "assignment-1", role: "leader_tc", status: "active", company: { id: "company-1" }, project: { id: "project-1" }, user: { id: "leader-1" } },
        ]);
      }
      return Promise.resolve([]);
    });

    const body = await (await GET(request("https://app.local/api/usuarios/vinculos/search-v2?mode=companies&q=empresa"))).json();
    expect(body.modeLabel).toBe("Empresas");
    expect(body.companies).toHaveLength(1);
    expect(body.assignments).toHaveLength(1);
    expect(db.user.findMany).not.toHaveBeenCalled();
  });

  it.each([
    ["leaders", "Líder TC"],
    ["qa_users", "Usuário TC"],
    ["business_users", "Usuário empresarial"],
  ])("consulta pessoas no modo %s", async (mode, label) => {
    auth.mockResolvedValue(user({ isGlobalAdmin: true, permissionRole: "technical_support", companyId: null }) as never);
    permission.mockReturnValue(true);
    db.user.findMany.mockResolvedValue([{ id: `${mode}-1`, name: "Pessoa", email: "pessoa@example.com" }]);
    db.projectTeamAssignment.findMany.mockResolvedValue([{ id: "assignment-1", user: { id: `${mode}-1` } }]);

    const body = await (await GET(request(`https://app.local/api/usuarios/vinculos/search-v2?mode=${mode}&q=pessoa`))).json();
    expect(body.modeLabel).toBe(label);
    expect(body.people).toHaveLength(1);
    expect(body.assignments).toHaveLength(1);
  });
});
