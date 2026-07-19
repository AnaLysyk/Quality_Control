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
import { prisma } from "@/database/prismaClient";

const mockedAuthenticateRequest = authenticateRequest as jest.MockedFunction<typeof authenticateRequest>;

function mockPrisma() {
  return prisma as unknown as {
    user: { findUnique: jest.Mock; update: jest.Mock };
    company: { findUnique: jest.Mock };
    project: { findMany: jest.Mock };
    membership: { upsert: jest.Mock };
    userCompanyLink: { updateMany: jest.Mock };
    projectTeamAssignment: { updateMany: jest.Mock };
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

function makeRequest(method: string, opts: { url?: string; body?: unknown } = {}) {
  return new Request(opts.url ?? "https://app.local/api/usuarios/vinculos/business-users?userId=biz-user-1", {
    method,
    headers: { "content-type": "application/json" },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  }) as unknown as Request;
}

describe("app/api/usuarios/vinculos/business-users/route.ts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const db = mockPrisma();
    db.user.findUnique.mockResolvedValue(targetUser);
    db.company.findUnique.mockResolvedValue(company);
    db.project.findMany.mockResolvedValue(projects);
  });

  describe("GET", () => {
    it("retorna 401 sem usuário autenticado", async () => {
      mockedAuthenticateRequest.mockResolvedValue(null);
      const res = await GET(makeRequest("GET"));
      expect(res.status).toBe(401);
    });

    it("retorna 400 sem userId na query", async () => {
      mockedAuthenticateRequest.mockResolvedValue(operatorUser() as never);
      const res = await GET(makeRequest("GET", { url: "https://app.local/api/usuarios/vinculos/business-users" }));
      expect(res.status).toBe(400);
    });

    it("retorna 403 quando o operador é de outra empresa", async () => {
      mockedAuthenticateRequest.mockResolvedValue(operatorUser({ companyId: "outra-empresa" }) as never);
      const res = await GET(makeRequest("GET"));
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toMatch(/fora do seu contexto/i);
    });

    it("visão de plataforma (technical_support) também pode ver, mas não gerenciar", async () => {
      mockedAuthenticateRequest.mockResolvedValue(
        operatorUser({ role: "technical_support", permissionRole: "technical_support", companyRole: "technical_support", companyId: "outra-empresa" }) as never,
      );
      const res = await GET(makeRequest("GET"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.permissions).toEqual({ canManage: false, canDeactivate: false });
    });

    it("retorna 200 com permissions.canManage=true para a própria empresa", async () => {
      mockedAuthenticateRequest.mockResolvedValue(operatorUser() as never);
      const res = await GET(makeRequest("GET"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.user).toMatchObject({ id: "biz-user-1", email: "biz@empresa.com" });
      expect(body.permissions).toEqual({ canManage: true, canDeactivate: true });
    });
  });

  describe("POST set_projects", () => {
    it("retorna 401 sem usuário autenticado", async () => {
      mockedAuthenticateRequest.mockResolvedValue(null);
      const res = await POST(makeRequest("POST", { body: { action: "set_projects", userId: "biz-user-1", projectIds: ["project-1"] } }));
      expect(res.status).toBe(401);
    });

    it("retorna 400 quando o operador não é da mesma empresa (nem admin global escapa dessa regra)", async () => {
      mockedAuthenticateRequest.mockResolvedValue(
        operatorUser({ isGlobalAdmin: true, role: "technical_support", permissionRole: "technical_support", companyRole: "technical_support" }) as never,
      );
      const res = await POST(makeRequest("POST", { body: { action: "set_projects", userId: "biz-user-1", projectIds: ["project-1"] } }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/Somente a própria empresa/);
    });

    it("retorna 400 quando nenhum projeto é selecionado", async () => {
      mockedAuthenticateRequest.mockResolvedValue(operatorUser() as never);
      const res = await POST(makeRequest("POST", { body: { action: "set_projects", userId: "biz-user-1", projectIds: [] } }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/Selecione pelo menos um projeto/);
    });

    it("retorna 400 quando um projeto não pertence à empresa de origem do usuário", async () => {
      mockedAuthenticateRequest.mockResolvedValue(operatorUser() as never);
      const res = await POST(makeRequest("POST", { body: { action: "set_projects", userId: "biz-user-1", projectIds: ["project-de-outra-empresa"] } }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/devem pertencer à empresa/);
    });

    it("atualiza os projetos autorizados com sucesso (200)", async () => {
      mockedAuthenticateRequest.mockResolvedValue(operatorUser() as never);
      mockPrisma().membership.upsert.mockResolvedValue({ id: "membership-1", allowedProjectIds: ["project-1"] });

      const res = await POST(makeRequest("POST", { body: { action: "set_projects", userId: "biz-user-1", projectIds: ["project-1"] } }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ success: true, selectedProjectIds: ["project-1"] });
    });
  });

  describe("POST deactivate", () => {
    it("retorna 400 quando não há justificativa", async () => {
      mockedAuthenticateRequest.mockResolvedValue(operatorUser() as never);
      const res = await POST(makeRequest("POST", { body: { action: "deactivate", userId: "biz-user-1" } }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/Informe a justificativa/);
    });

    it("desativa o usuário empresarial com sucesso (200) e preserva histórico dos vínculos", async () => {
      mockedAuthenticateRequest.mockResolvedValue(operatorUser() as never);
      const db = mockPrisma();
      db.user.update.mockResolvedValue({ id: "biz-user-1", name: "Usuário Empresarial", full_name: "Usuário Empresarial Completo", email: "biz@empresa.com" });

      const res = await POST(makeRequest("POST", { body: { action: "deactivate", userId: "biz-user-1", reason: "Encerramento de contrato" } }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ success: true, userId: "biz-user-1" });
      expect(db.projectTeamAssignment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "removed", removalReason: "Encerramento de contrato" }) }),
      );
    });
  });
});
