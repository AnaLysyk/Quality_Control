jest.mock("@/backend/jwtAuth", () => ({ authenticateRequest: jest.fn() }));
jest.mock("@/backend/permissions/checkPermission", () => ({ checkPermission: jest.fn() }));
jest.mock("@/backend/userNotificationsStore", () => ({ createNotificationsForUsers: jest.fn() }));
jest.mock("@/backend/audit/writeAuditLog", () => ({ writeAuditLog: jest.fn() }));
jest.mock("@/database/prismaClient", () => ({
  prisma: {
    user: { findMany: jest.fn(), findUnique: jest.fn() },
    project: { findUnique: jest.fn() },
    projectTeamAssignment: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    membership: { findMany: jest.fn(), upsert: jest.fn() },
    userCompanyLink: { findMany: jest.fn() },
    $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(mockPrisma())),
  },
}));

import { GET, POST } from "@/api/usuarios/vinculos/leadership/route";
import { authenticateRequest } from "@/backend/jwtAuth";
import { checkPermission } from "@/backend/permissions/checkPermission";
import { prisma } from "@/database/prismaClient";

const mockedAuthenticateRequest = authenticateRequest as jest.MockedFunction<typeof authenticateRequest>;
const mockedCheckPermission = checkPermission as jest.MockedFunction<typeof checkPermission>;

function mockPrisma() {
  return prisma as unknown as {
    user: { findMany: jest.Mock; findUnique: jest.Mock };
    project: { findUnique: jest.Mock };
    projectTeamAssignment: { findMany: jest.Mock; findFirst: jest.Mock; create: jest.Mock; update: jest.Mock };
    membership: { findMany: jest.Mock; upsert: jest.Mock };
    userCompanyLink: { findMany: jest.Mock };
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
    companySlug: "empresa-1",
    companySlugs: ["empresa-1"],
    ...overrides,
  };
}

function makeRequest(method: string, opts: { url?: string; body?: unknown } = {}) {
  return new Request(opts.url ?? "https://app.local/api/usuarios/vinculos/leadership?projectId=project-1", {
    method,
    headers: { "content-type": "application/json" },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  }) as unknown as Request;
}

const project = {
  id: "project-1",
  name: "Projeto",
  slug: "projeto-1",
  companyId: "company-1",
  company: { id: "company-1", name: "Empresa", company_name: "Empresa", slug: "empresa-1" },
};

describe("app/api/usuarios/vinculos/leadership/route.ts - matriz de perfis controla acesso", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const db = mockPrisma();
    db.membership.findMany.mockResolvedValue([]);
    db.userCompanyLink.findMany.mockResolvedValue([]);
    db.projectTeamAssignment.findMany.mockResolvedValue([]);
    db.user.findMany.mockResolvedValue([]);
    db.project.findUnique.mockResolvedValue(project);
  });

  describe("GET", () => {
    it("retorna 401 sem usuário autenticado", async () => {
      mockedAuthenticateRequest.mockResolvedValue(null);
      const res = await GET(makeRequest("GET"));
      expect(res.status).toBe(401);
    });

    it("retorna 403 sem relationships:view", async () => {
      mockedAuthenticateRequest.mockResolvedValue(baseUser() as never);
      mockedCheckPermission.mockReturnValue(false);
      const res = await GET(makeRequest("GET"));
      expect(res.status).toBe(403);
    });

    it("reflete canEdit/canDelete a partir da matriz de perfis, sem depender do texto do role", async () => {
      mockedAuthenticateRequest.mockResolvedValue(baseUser({ role: "some_future_role_name" }) as never);
      mockedCheckPermission.mockImplementation(
        (_user, permission) => permission === "relationships:view" || permission === "relationships:edit",
      );

      const res = await GET(makeRequest("GET"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.permissions).toEqual({ canEdit: true, canDelete: true });
    });

    it("canEdit=false quando a matriz só concede view", async () => {
      mockedAuthenticateRequest.mockResolvedValue(baseUser() as never);
      mockedCheckPermission.mockImplementation((_user, permission) => permission === "relationships:view");

      const res = await GET(makeRequest("GET"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.permissions).toEqual({ canEdit: false, canDelete: false });
    });

    it("retorna 404 quando o projeto não existe", async () => {
      mockedAuthenticateRequest.mockResolvedValue(baseUser() as never);
      mockedCheckPermission.mockReturnValue(true);
      mockPrisma().project.findUnique.mockResolvedValue(null);

      const res = await GET(makeRequest("GET"));
      expect(res.status).toBe(404);
    });
  });

  describe("POST", () => {
    const addQaBody = { action: "add_qa", projectId: "project-1", userId: "qa-1" };

    it("retorna 401 sem usuário autenticado", async () => {
      mockedAuthenticateRequest.mockResolvedValue(null);
      const res = await POST(makeRequest("POST", { body: addQaBody }));
      expect(res.status).toBe(401);
    });

    it("retorna 403 quando a matriz não concede relationships:edit nem relationships:create", async () => {
      mockedAuthenticateRequest.mockResolvedValue(baseUser() as never);
      mockedCheckPermission.mockReturnValue(false);
      const res = await POST(makeRequest("POST", { body: addQaBody }));
      expect(res.status).toBe(403);
      expect(mockPrisma().projectTeamAssignment.create).not.toHaveBeenCalled();
    });

    it("adiciona Usuário TC ao projeto com sucesso quando a matriz concede relationships:create", async () => {
      mockedAuthenticateRequest.mockResolvedValue(baseUser() as never);
      mockedCheckPermission.mockImplementation((_user, permission) => permission === "relationships:create");
      const db = mockPrisma();
      db.user.findUnique.mockResolvedValue({ id: "qa-1", name: "Usuário TC", full_name: "Usuário TC Completo", email: "qa@x.com" });
      db.projectTeamAssignment.findFirst
        .mockResolvedValueOnce({ userId: "leader-1" }) // líder ativo
        .mockResolvedValueOnce(null); // sem duplicado
      db.membership.upsert.mockResolvedValue({});
      db.projectTeamAssignment.create.mockResolvedValue({ id: "assignment-novo" });

      const res = await POST(makeRequest("POST", { body: addQaBody }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.result.action).toBe("add_qa");
    });

    it("bloqueia adicionar Usuário TC quando o projeto não tem liderança definida", async () => {
      mockedAuthenticateRequest.mockResolvedValue(baseUser() as never);
      mockedCheckPermission.mockReturnValue(true);
      const db = mockPrisma();
      db.user.findUnique.mockResolvedValue({ id: "qa-1", name: "Usuário TC" });
      db.projectTeamAssignment.findFirst.mockResolvedValueOnce(null);

      const res = await POST(makeRequest("POST", { body: addQaBody }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/Defina a liderança/);
    });
  });
});
