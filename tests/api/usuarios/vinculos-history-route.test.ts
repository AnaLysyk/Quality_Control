jest.mock("@/backend/jwtAuth", () => ({ authenticateRequest: jest.fn() }));
jest.mock("@/backend/permissions/checkPermission", () => ({ checkPermission: jest.fn() }));
jest.mock("@/database/prismaClient", () => ({
  prisma: {
    membership: { findMany: jest.fn() },
    userCompanyLink: { findMany: jest.fn() },
    projectTeamAssignment: { findMany: jest.fn() },
    auditLog: { findMany: jest.fn() },
    company: { findMany: jest.fn() },
    project: { findMany: jest.fn() },
    user: { findMany: jest.fn() },
  },
}));

import { GET } from "@/api/usuarios/vinculos/history/route";
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
    auditLog: { findMany: jest.Mock };
    company: { findMany: jest.Mock };
    project: { findMany: jest.Mock };
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

function makeRequest(url = "https://app.local/api/usuarios/vinculos/history") {
  return new Request(url, { method: "GET" }) as unknown as Request;
}

const logCreate = {
  id: "log-1",
  created_at: new Date("2026-01-01T00:00:00.000Z"),
  actor_user_id: "actor-1",
  actor_email: "actor@x.com",
  action: "create",
  entity_id: "assignment-1",
  entity_label: "Fulano",
  metadata: { companyId: "company-1", projectId: "project-1", targetUserId: "target-1", role: "qa_tc" },
};

const logAssignLeader = {
  id: "log-2",
  created_at: new Date("2026-01-02T00:00:00.000Z"),
  actor_user_id: "actor-1",
  actor_email: "actor@x.com",
  action: "assign_leader",
  entity_id: "assignment-2",
  entity_label: "Ciclana",
  metadata: { companyId: "company-1", projectId: "project-1", targetUserId: "target-2" },
};

const logDeactivateBusiness = {
  id: "log-3",
  created_at: new Date("2026-01-03T00:00:00.000Z"),
  actor_user_id: "actor-1",
  actor_email: "actor@x.com",
  action: "deactivate_business_user",
  entity_id: "user-3",
  entity_label: "Empresarial",
  metadata: { companyId: "company-2", userId: "target-3", reason: "Encerramento" },
};

describe("app/api/usuarios/vinculos/history/route.ts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const db = mockPrisma();
    db.membership.findMany.mockResolvedValue([]);
    db.userCompanyLink.findMany.mockResolvedValue([]);
    db.projectTeamAssignment.findMany.mockResolvedValue([]);
    db.company.findMany.mockResolvedValue([]);
    db.project.findMany.mockResolvedValue([]);
    db.user.findMany.mockResolvedValue([]);
  });

  it("retorna 401 sem usuário autenticado", async () => {
    mockedAuthenticateRequest.mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("retorna 403 sem relationships:view", async () => {
    mockedAuthenticateRequest.mockResolvedValue(baseUser() as never);
    mockedCheckPermission.mockReturnValue(false);
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
  });

  it("retorna 403 ao pedir uma empresa fora do escopo do operador", async () => {
    mockedAuthenticateRequest.mockResolvedValue(baseUser() as never);
    mockedCheckPermission.mockReturnValue(true);
    mockPrisma().auditLog.findMany.mockResolvedValue([]);

    const res = await GET(makeRequest("https://app.local/api/usuarios/vinculos/history?companyId=outra-empresa"));
    expect(res.status).toBe(403);
  });

  it("operador com escopo de empresa só vê logs da própria empresa, mesmo sem filtrar por companyId", async () => {
    mockedAuthenticateRequest.mockResolvedValue(baseUser() as never);
    mockedCheckPermission.mockReturnValue(true);
    mockPrisma().auditLog.findMany.mockResolvedValue([logCreate, logDeactivateBusiness]);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.globalVisibility).toBe(false);
    expect(body.scopedCompanyIds).toEqual(["company-1"]);
  });

  it("perfil com visão global (technical_support) vê logs de todas as empresas", async () => {
    mockedAuthenticateRequest.mockResolvedValue(
      baseUser({ role: "technical_support", permissionRole: "technical_support", companyRole: "technical_support" }) as never,
    );
    mockedCheckPermission.mockReturnValue(true);
    mockPrisma().auditLog.findMany.mockResolvedValue([logCreate, logDeactivateBusiness]);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(2);
    expect(body.globalVisibility).toBe(true);
    expect(body.scopedCompanyIds).toEqual([]);
  });

  it("classifica cada log no perfil correto (leader_tc, qa_tc, business_user) e enriquece com dados relacionados", async () => {
    mockedAuthenticateRequest.mockResolvedValue(
      baseUser({ role: "technical_support", permissionRole: "technical_support", companyRole: "technical_support" }) as never,
    );
    mockedCheckPermission.mockReturnValue(true);
    const db = mockPrisma();
    db.auditLog.findMany.mockResolvedValue([logCreate, logAssignLeader, logDeactivateBusiness]);
    db.company.findMany.mockResolvedValue([
      { id: "company-1", name: "Empresa 1", company_name: "Empresa 1", slug: "empresa-1" },
      { id: "company-2", name: "Empresa 2", company_name: "Empresa 2", slug: "empresa-2" },
    ]);
    db.project.findMany.mockResolvedValue([{ id: "project-1", name: "Projeto", slug: "projeto-1", companyId: "company-1" }]);
    db.user.findMany.mockResolvedValue([
      { id: "target-1", name: "Alvo Um", full_name: null, email: "alvo1@x.com" },
      { id: "target-2", name: "Alvo Dois", full_name: null, email: "alvo2@x.com" },
      { id: "target-3", name: "Alvo Três", full_name: null, email: "alvo3@x.com" },
      { id: "actor-1", name: "Ator", full_name: null, email: "actor@x.com" },
    ]);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();

    const qaProfile = body.profiles.find((p: { key: string }) => p.key === "qa_tc");
    const leaderProfile = body.profiles.find((p: { key: string }) => p.key === "leader_tc");
    const businessProfile = body.profiles.find((p: { key: string }) => p.key === "business_user");

    expect(qaProfile.entries).toHaveLength(1);
    expect(qaProfile.entries[0]).toMatchObject({ id: "log-1", action: "create", company: { id: "company-1" } });

    expect(leaderProfile.entries).toHaveLength(1);
    expect(leaderProfile.entries[0]).toMatchObject({ id: "log-2", action: "assign_leader" });

    expect(businessProfile.entries).toHaveLength(1);
    expect(businessProfile.entries[0]).toMatchObject({ id: "log-3", action: "deactivate_business_user", reason: "Encerramento" });
  });
});
