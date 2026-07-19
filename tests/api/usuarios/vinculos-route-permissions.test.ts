jest.mock("@/backend/jwtAuth", () => ({ authenticateRequest: jest.fn() }));
jest.mock("@/backend/permissions/checkPermission", () => ({ checkPermission: jest.fn() }));
jest.mock("@/backend/userNotificationsStore", () => ({ createNotificationsForUsers: jest.fn() }));
jest.mock("@/backend/audit/writeAuditLog", () => ({ writeAuditLog: jest.fn() }));
jest.mock("@/database/prismaClient", () => ({
  prisma: {
    user: { findFirst: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
    company: { findMany: jest.fn(), findUnique: jest.fn() },
    project: { findMany: jest.fn(), findUnique: jest.fn() },
    projectTeamAssignment: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    membership: { upsert: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
    $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(mockPrisma())),
  },
}));

import { GET, POST, DELETE } from "@/api/usuarios/vinculos/route";
import { authenticateRequest } from "@/backend/jwtAuth";
import { checkPermission } from "@/backend/permissions/checkPermission";
import { prisma } from "@/database/prismaClient";

const mockedAuthenticateRequest = authenticateRequest as jest.MockedFunction<typeof authenticateRequest>;
const mockedCheckPermission = checkPermission as jest.MockedFunction<typeof checkPermission>;

function mockPrisma() {
  return prisma as unknown as {
    user: { findFirst: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock };
    company: { findMany: jest.Mock; findUnique: jest.Mock };
    project: { findMany: jest.Mock; findUnique: jest.Mock };
    projectTeamAssignment: { findFirst: jest.Mock; findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    membership: { upsert: jest.Mock; update: jest.Mock; findUnique: jest.Mock };
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
    assignments: [],
    projectScope: null,
    ...overrides,
  };
}

function makeRequest(method: string, opts: { url?: string; body?: unknown } = {}) {
  return new Request(opts.url ?? "https://app.local/api/usuarios/vinculos", {
    method,
    headers: { "content-type": "application/json" },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  }) as unknown as Request;
}

describe("app/api/usuarios/vinculos/route.ts - matriz de perfis controla acesso", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma().company.findMany.mockResolvedValue([]);
    mockPrisma().project.findMany.mockResolvedValue([]);
    mockPrisma().user.findMany.mockResolvedValue([]);
  });

  describe("GET", () => {
    it("retorna 401 sem usuário autenticado", async () => {
      mockedAuthenticateRequest.mockResolvedValue(null);
      const res = await GET(makeRequest("GET"));
      expect(res.status).toBe(401);
    });

    it("retorna 403 quando o usuário não tem relationships:view nem users:view", async () => {
      mockedAuthenticateRequest.mockResolvedValue(baseUser() as never);
      mockedCheckPermission.mockReturnValue(false);
      const res = await GET(makeRequest("GET"));
      expect(res.status).toBe(403);
    });

    it("permite GET e reflete canManage=true quando a matriz concede relationships:edit", async () => {
      mockedAuthenticateRequest.mockResolvedValue(baseUser() as never);
      mockedCheckPermission.mockImplementation((_user, permission) => permission === "relationships:view" || permission === "relationships:edit");

      const res = await GET(makeRequest("GET"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.permissions).toEqual({ canManage: true });
    });

    it("canManage=false quando a matriz só concede view (perfil sem edição)", async () => {
      mockedAuthenticateRequest.mockResolvedValue(baseUser() as never);
      mockedCheckPermission.mockImplementation((_user, permission) => permission === "relationships:view");

      const res = await GET(makeRequest("GET"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.permissions).toEqual({ canManage: false });
    });
  });

  describe("POST", () => {
    const validBody = { userId: "target-1", companyId: "company-1", projectId: "project-1", role: "qa_tc" as const };

    it("retorna 401 sem usuário autenticado", async () => {
      mockedAuthenticateRequest.mockResolvedValue(null);
      const res = await POST(makeRequest("POST", { body: validBody }));
      expect(res.status).toBe(401);
    });

    it("retorna 403 quando a matriz não concede relationships:create/edit nem users:update/permissions:update", async () => {
      mockedAuthenticateRequest.mockResolvedValue(baseUser() as never);
      mockedCheckPermission.mockReturnValue(false);
      const res = await POST(makeRequest("POST", { body: validBody }));
      expect(res.status).toBe(403);
      expect(mockPrisma().user.findUnique).not.toHaveBeenCalled();
    });

    it("retorna 400 quando o corpo está incompleto", async () => {
      mockedAuthenticateRequest.mockResolvedValue(baseUser() as never);
      mockedCheckPermission.mockReturnValue(true);
      const res = await POST(makeRequest("POST", { body: { userId: "target-1" } }));
      expect(res.status).toBe(400);
    });

    it("retorna 403 quando a empresa selecionada está fora do escopo do usuário", async () => {
      mockedAuthenticateRequest.mockResolvedValue(baseUser({ companyId: "outra-empresa" }) as never);
      mockedCheckPermission.mockReturnValue(true);
      const res = await POST(makeRequest("POST", { body: validBody }));
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toMatch(/fora do seu contexto/i);
    });

    it("cria o vínculo com sucesso (201) quando tudo é válido", async () => {
      mockedAuthenticateRequest.mockResolvedValue(baseUser() as never);
      mockedCheckPermission.mockReturnValue(true);
      const db = mockPrisma();
      db.user.findUnique.mockResolvedValue({ id: "target-1", name: "Alvo", full_name: "Alvo Completo", email: "alvo@x.com", role: "testing_company_user" });
      db.company.findUnique.mockResolvedValue({ id: "company-1", name: "Empresa", company_name: "Empresa Completa", slug: "empresa-1" });
      db.project.findUnique.mockResolvedValue({ id: "project-1", name: "Projeto", slug: "projeto-1", companyId: "company-1" });
      db.projectTeamAssignment.findFirst
        .mockResolvedValueOnce({ userId: "leader-1" }) // leader ativo (exigido pra qa_tc)
        .mockResolvedValueOnce(null); // sem duplicado
      db.membership.upsert.mockResolvedValue({ userId: "target-1", companyId: "company-1", allowedProjectIds: ["project-1"] });
      db.projectTeamAssignment.create.mockResolvedValue({ id: "assignment-1" });

      const res = await POST(makeRequest("POST", { body: validBody }));
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.assignment).toEqual({ id: "assignment-1" });
    });

    it("bloqueia vínculo de qa_tc quando o projeto não tem Líder TC ativo", async () => {
      mockedAuthenticateRequest.mockResolvedValue(baseUser() as never);
      mockedCheckPermission.mockReturnValue(true);
      const db = mockPrisma();
      db.user.findUnique.mockResolvedValue({ id: "target-1", name: "Alvo", role: "testing_company_user" });
      db.company.findUnique.mockResolvedValue({ id: "company-1", name: "Empresa", slug: "empresa-1" });
      db.project.findUnique.mockResolvedValue({ id: "project-1", name: "Projeto", slug: "projeto-1", companyId: "company-1" });
      db.projectTeamAssignment.findFirst.mockResolvedValueOnce(null); // sem líder

      const res = await POST(makeRequest("POST", { body: validBody }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/Líder TC ativo/);
    });

    it("bloqueia vínculo duplicado já ativo", async () => {
      mockedAuthenticateRequest.mockResolvedValue(baseUser() as never);
      mockedCheckPermission.mockReturnValue(true);
      const db = mockPrisma();
      db.user.findUnique.mockResolvedValue({ id: "target-1", name: "Alvo", role: "testing_company_user" });
      db.company.findUnique.mockResolvedValue({ id: "company-1", name: "Empresa", slug: "empresa-1" });
      db.project.findUnique.mockResolvedValue({ id: "project-1", name: "Projeto", slug: "projeto-1", companyId: "company-1" });
      db.projectTeamAssignment.findFirst
        .mockResolvedValueOnce({ userId: "leader-1" })
        .mockResolvedValueOnce({ id: "assignment-existente" });

      const res = await POST(makeRequest("POST", { body: validBody }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/já está ativo/);
    });
  });

  describe("DELETE", () => {
    const validBody = { assignmentId: "assignment-1", reason: "Encerramento do contrato" };

    it("retorna 401 sem usuário autenticado", async () => {
      mockedAuthenticateRequest.mockResolvedValue(null);
      const res = await DELETE(makeRequest("DELETE", { body: validBody }));
      expect(res.status).toBe(401);
    });

    it("retorna 403 quando a matriz não concede permissão de remoção", async () => {
      mockedAuthenticateRequest.mockResolvedValue(baseUser() as never);
      mockedCheckPermission.mockReturnValue(false);
      const res = await DELETE(makeRequest("DELETE", { body: validBody }));
      expect(res.status).toBe(403);
      expect(mockPrisma().projectTeamAssignment.findUnique).not.toHaveBeenCalled();
    });

    it("retorna 400 quando falta a justificativa", async () => {
      mockedAuthenticateRequest.mockResolvedValue(baseUser() as never);
      mockedCheckPermission.mockReturnValue(true);
      const res = await DELETE(makeRequest("DELETE", { body: { assignmentId: "assignment-1" } }));
      expect(res.status).toBe(400);
    });

    it("bloqueia remoção direta de vínculo de Líder TC", async () => {
      mockedAuthenticateRequest.mockResolvedValue(baseUser() as never);
      mockedCheckPermission.mockReturnValue(true);
      const db = mockPrisma();
      db.projectTeamAssignment.findUnique.mockResolvedValue({
        id: "assignment-1",
        status: "active",
        role: "leader_tc",
        companyId: "company-1",
        projectId: "project-1",
        userId: "leader-1",
        user: { id: "leader-1", name: "Líder" },
        company: { id: "company-1", name: "Empresa", slug: "empresa-1" },
        project: { id: "project-1", name: "Projeto", slug: "projeto-1" },
      });

      const res = await DELETE(makeRequest("DELETE", { body: validBody }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/Líder TC não pode ser removido diretamente/);
    });

    it("remove o vínculo com sucesso (200) para um Usuário TC", async () => {
      mockedAuthenticateRequest.mockResolvedValue(baseUser() as never);
      mockedCheckPermission.mockReturnValue(true);
      const db = mockPrisma();
      db.projectTeamAssignment.findUnique.mockResolvedValue({
        id: "assignment-1",
        status: "active",
        role: "qa_tc",
        companyId: "company-1",
        projectId: "project-1",
        userId: "qa-1",
        user: { id: "qa-1", name: "Usuário TC" },
        company: { id: "company-1", name: "Empresa", slug: "empresa-1" },
        project: { id: "project-1", name: "Projeto", slug: "projeto-1" },
      });
      db.projectTeamAssignment.findFirst.mockResolvedValue({ userId: "leader-1" });
      db.projectTeamAssignment.update.mockResolvedValue({ id: "assignment-1", status: "removed" });
      db.membership.findUnique.mockResolvedValue({ allowedProjectIds: ["project-1"] });

      const res = await DELETE(makeRequest("DELETE", { body: validBody }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    it("bloqueia remoção (400) quando a empresa do vínculo está fora do escopo do usuário", async () => {
      mockedAuthenticateRequest.mockResolvedValue(baseUser({ companyId: "outra-empresa" }) as never);
      mockedCheckPermission.mockReturnValue(true);
      const db = mockPrisma();
      db.projectTeamAssignment.findUnique.mockResolvedValue({
        id: "assignment-1",
        status: "active",
        role: "qa_tc",
        companyId: "company-1",
        projectId: "project-1",
        userId: "qa-1",
        user: { id: "qa-1", name: "Usuário TC" },
        company: { id: "company-1", name: "Empresa", slug: "empresa-1" },
        project: { id: "project-1", name: "Projeto", slug: "projeto-1" },
      });

      const res = await DELETE(makeRequest("DELETE", { body: validBody }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/fora do seu contexto/i);
    });
  });
});
