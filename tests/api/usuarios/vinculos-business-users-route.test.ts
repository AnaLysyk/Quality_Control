jest.mock("@/backend/jwtAuth", () => ({ authenticateRequest: jest.fn() }));
jest.mock("@/backend/companyUserScope", () => ({ assertUserCanLinkToCompany: jest.fn() }));
jest.mock("@/backend/userNotificationsStore", () => ({ createNotificationsForUsers: jest.fn() }));
jest.mock("@/backend/audit/writeAuditLog", () => ({ writeAuditLog: jest.fn() }));
jest.mock("@/database/prismaClient", () => ({
  prisma: {
    user: { findUnique: jest.fn(), update: jest.fn() },
    company: { findUnique: jest.fn() },
    project: { findMany: jest.fn() },
    membership: { upsert: jest.fn() },
    userCompanyLink: { updateMany: jest.fn() },
    projectTeamAssignment: { updateMany: jest.fn() },
    $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(mockPrisma())),
  },
}));

import { GET, POST } from "@/api/usuarios/vinculos/business-users/route";
import { authenticateRequest } from "@/backend/jwtAuth";
import { createNotificationsForUsers } from "@/backend/userNotificationsStore";
import { writeAuditLog } from "@/backend/audit/writeAuditLog";
import { prisma } from "@/database/prismaClient";

const mockedAuthenticateRequest = authenticateRequest as jest.MockedFunction<typeof authenticateRequest>;
const mockedCreateNotifications = createNotificationsForUsers as jest.MockedFunction<typeof createNotificationsForUsers>;
const mockedWriteAuditLog = writeAuditLog as jest.MockedFunction<typeof writeAuditLog>;

function mockPrisma() {
  return prisma as unknown as {
    user: { findUnique: jest.Mock; update: jest.Mock };
    company: { findUnique: jest.Mock };
    project: { findMany: jest.Mock };
    membership: { upsert: jest.Mock };
    userCompanyLink: { updateMany: jest.Mock };
    projectTeamAssignment: { updateMany: jest.Mock };
    $transaction: jest.Mock;
  };
}

const targetUser = {
  id: "biz-user-1",
  name: "Usuário Empresarial",
  full_name: "Usuário Empresarial Completo",
  email: "biz@empresa.com",
  active: true,
  status: "active",
  role: "company_user",
  globalRole: null,
  home_company_id: "company-1",
  created_by_company_id: null,
  user_origin: "client_company",
  user_scope: "company_only",
  allow_multi_company_link: false,
  memberships: [{ companyId: "company-1", role: "user", allowedProjectIds: [], company: { id: "company-1", name: "Empresa", company_name: "Empresa", slug: "empresa-1" } }],
};

const company = { id: "company-1", name: "Empresa", company_name: "Empresa", slug: "empresa-1", active: true };
const projects = [{ id: "project-1", name: "Projeto", slug: "projeto-1", status: "active", companyId: "company-1" }];

function operatorUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "operator-1",
    email: "operator@empresa.com",
    isGlobalAdmin: false,
    role: "empresa",
    permissionRole: "empresa",
    companyRole: "empresa",
    globalRole: null,
    companyId: "company-1",
    companySlug: "empresa-1",
    ...overrides,
  };
}

function makeRequest(method: string, opts: { url?: string; body?: unknown; rawBody?: string } = {}) {
  return new Request(opts.url ?? "https://app.local/api/usuarios/vinculos/business-users?userId=biz-user-1", {
    method,
    headers: { "content-type": "application/json" },
    body: opts.rawBody ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
  }) as unknown as Request;
}

describe("app/api/usuarios/vinculos/business-users/route.ts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const db = mockPrisma();
    db.user.findUnique.mockResolvedValue(targetUser);
    db.company.findUnique.mockResolvedValue(company);
    db.project.findMany.mockResolvedValue(projects);
    db.$transaction.mockImplementation((callback: (tx: unknown) => unknown) => callback(db));
  });

  describe("GET", () => {
    it("retorna 401 sem usuário autenticado", async () => {
      mockedAuthenticateRequest.mockResolvedValue(null);
      expect((await GET(makeRequest("GET"))).status).toBe(401);
    });

    it("retorna 400 sem userId na query", async () => {
      mockedAuthenticateRequest.mockResolvedValue(operatorUser() as never);
      expect((await GET(makeRequest("GET", { url: "https://app.local/api/usuarios/vinculos/business-users" }))).status).toBe(400);
    });

    it("retorna 403 quando o usuário empresarial não existe", async () => {
      mockedAuthenticateRequest.mockResolvedValue(operatorUser() as never);
      mockPrisma().user.findUnique.mockResolvedValue(null);
      const res = await GET(makeRequest("GET"));
      expect(res.status).toBe(403);
      expect((await res.json()).error).toMatch(/não encontrado/i);
    });

    it("retorna 403 quando o usuário não possui empresa de origem", async () => {
      mockedAuthenticateRequest.mockResolvedValue(operatorUser() as never);
      mockPrisma().user.findUnique.mockResolvedValue({ ...targetUser, home_company_id: null, created_by_company_id: null, memberships: [] });
      const res = await GET(makeRequest("GET"));
      expect(res.status).toBe(403);
      expect((await res.json()).error).toMatch(/sem empresa de origem/i);
    });

    it("retorna 403 quando a empresa de origem está inativa", async () => {
      mockedAuthenticateRequest.mockResolvedValue(operatorUser() as never);
      mockPrisma().company.findUnique.mockResolvedValue({ ...company, active: false });
      const res = await GET(makeRequest("GET"));
      expect(res.status).toBe(403);
      expect((await res.json()).error).toMatch(/inativa/i);
    });

    it("retorna 403 quando o operador é de outra empresa", async () => {
      mockedAuthenticateRequest.mockResolvedValue(operatorUser({ companyId: "outra-empresa" }) as never);
      const res = await GET(makeRequest("GET"));
      expect(res.status).toBe(403);
      expect((await res.json()).error).toMatch(/fora do seu contexto/i);
    });

    it("visão de plataforma pode ver, mas não gerenciar", async () => {
      mockedAuthenticateRequest.mockResolvedValue(operatorUser({ role: "technical_support", permissionRole: "technical_support", companyRole: "technical_support", companyId: "outra-empresa" }) as never);
      const body = await (await GET(makeRequest("GET"))).json();
      expect(body.permissions).toEqual({ canManage: false, canDeactivate: false });
    });

    it("retorna dados e projetos selecionados para a própria empresa", async () => {
      mockedAuthenticateRequest.mockResolvedValue(operatorUser() as never);
      mockPrisma().user.findUnique.mockResolvedValue({ ...targetUser, memberships: [{ ...targetUser.memberships[0], allowedProjectIds: ["project-1"] }] });
      const res = await GET(makeRequest("GET"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.selectedProjectIds).toEqual(["project-1"]);
      expect(body.permissions).toEqual({ canManage: true, canDeactivate: true });
    });
  });

  describe("POST", () => {
    it("retorna 401 sem usuário autenticado", async () => {
      mockedAuthenticateRequest.mockResolvedValue(null);
      expect((await POST(makeRequest("POST", { body: { action: "set_projects", userId: "biz-user-1" } }))).status).toBe(401);
    });

    it("retorna 400 para JSON inválido ou body incompleto", async () => {
      mockedAuthenticateRequest.mockResolvedValue(operatorUser() as never);
      expect((await POST(makeRequest("POST", { rawBody: "{" }))).status).toBe(400);
      expect((await POST(makeRequest("POST", { body: { userId: "biz-user-1" } }))).status).toBe(400);
    });

    it("retorna 400 quando o operador não é da mesma empresa", async () => {
      mockedAuthenticateRequest.mockResolvedValue(operatorUser({ isGlobalAdmin: true, role: "technical_support", permissionRole: "technical_support", companyRole: "technical_support" }) as never);
      const res = await POST(makeRequest("POST", { body: { action: "set_projects", userId: "biz-user-1", projectIds: ["project-1"] } }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/Somente a própria empresa/);
    });

    it("valida lista vazia e projetos externos", async () => {
      mockedAuthenticateRequest.mockResolvedValue(operatorUser() as never);
      expect((await POST(makeRequest("POST", { body: { action: "set_projects", userId: "biz-user-1", projectIds: [] } }))).status).toBe(400);
      expect((await POST(makeRequest("POST", { body: { action: "set_projects", userId: "biz-user-1", projectIds: ["externo"] } }))).status).toBe(400);
    });

    it("deduplica projetos e atualiza acessos com notificação e auditoria", async () => {
      mockedAuthenticateRequest.mockResolvedValue(operatorUser() as never);
      mockPrisma().membership.upsert.mockResolvedValue({ id: "membership-1", allowedProjectIds: ["project-1"] });
      const res = await POST(makeRequest("POST", { body: { action: "set_projects", userId: "biz-user-1", projectIds: ["project-1", "project-1"] } }));
      expect(res.status).toBe(200);
      expect(mockPrisma().membership.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ allowedProjectIds: ["project-1"] }) }));
      expect(mockedCreateNotifications).toHaveBeenCalled();
      expect(mockedWriteAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "update_business_user_projects" }));
    });

    it("retorna 400 quando a persistência dos projetos falha", async () => {
      mockedAuthenticateRequest.mockResolvedValue(operatorUser() as never);
      mockPrisma().membership.upsert.mockRejectedValue(new Error("db indisponível"));
      const res = await POST(makeRequest("POST", { body: { action: "set_projects", userId: "biz-user-1", projectIds: ["project-1"] } }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("db indisponível");
    });

    it("exige justificativa para desativar", async () => {
      mockedAuthenticateRequest.mockResolvedValue(operatorUser() as never);
      expect((await POST(makeRequest("POST", { body: { action: "deactivate", userId: "biz-user-1" } }))).status).toBe(400);
    });

    it("desativa usuário, vínculos e assignments preservando histórico", async () => {
      mockedAuthenticateRequest.mockResolvedValue(operatorUser() as never);
      const db = mockPrisma();
      db.user.update.mockResolvedValue({ id: "biz-user-1", name: "Usuário Empresarial", full_name: "Usuário Empresarial Completo", email: "biz@empresa.com" });
      const res = await POST(makeRequest("POST", { body: { action: "deactivate", userId: "biz-user-1", reason: " Encerramento de contrato " } }));
      expect(res.status).toBe(200);
      expect(db.userCompanyLink.updateMany).toHaveBeenCalled();
      expect(db.projectTeamAssignment.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "removed", removalReason: "Encerramento de contrato" }) }));
      expect(mockedWriteAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "deactivate_business_user" }));
    });

    it("retorna 400 para ação inválida", async () => {
      mockedAuthenticateRequest.mockResolvedValue(operatorUser() as never);
      const res = await POST(makeRequest("POST", { body: { action: "desconhecida", userId: "biz-user-1" } }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("Ação inválida");
    });
  });
});
