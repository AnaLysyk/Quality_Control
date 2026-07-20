jest.mock("@/backend/jwtAuth", () => ({ authenticateRequest: jest.fn() }));
jest.mock("@/backend/permissions/checkPermission", () => ({ checkPermission: jest.fn() }));
jest.mock("@/backend/userNotificationsStore", () => ({ createNotificationsForUsers: jest.fn() }));
jest.mock("@/backend/audit/writeAuditLog", () => ({ writeAuditLog: jest.fn() }));
jest.mock("@/database/prismaClient", () => ({
  prisma: {
    user: { findMany: jest.fn(), findUnique: jest.fn() },
    project: { findUnique: jest.fn() },
    projectTeamAssignment: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    membership: { findMany: jest.fn(), upsert: jest.fn() },
    userCompanyLink: { findMany: jest.fn() },
    $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(mockPrisma())),
  },
}));

import { GET, POST } from "@/api/usuarios/vinculos/leadership/route";
import { authenticateRequest } from "@/backend/jwtAuth";
import { checkPermission } from "@/backend/permissions/checkPermission";
import { createNotificationsForUsers } from "@/backend/userNotificationsStore";
import { writeAuditLog } from "@/backend/audit/writeAuditLog";
import { prisma } from "@/database/prismaClient";

const mockedAuthenticateRequest = authenticateRequest as jest.MockedFunction<typeof authenticateRequest>;
const mockedCheckPermission = checkPermission as jest.MockedFunction<typeof checkPermission>;
const mockedCreateNotifications = createNotificationsForUsers as jest.MockedFunction<typeof createNotificationsForUsers>;
const mockedWriteAuditLog = writeAuditLog as jest.MockedFunction<typeof writeAuditLog>;

function mockPrisma() {
  return prisma as unknown as {
    user: { findMany: jest.Mock; findUnique: jest.Mock };
    project: { findUnique: jest.Mock };
    projectTeamAssignment: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
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

function makeRequest(method: string, opts: { url?: string; body?: unknown; rawBody?: string } = {}) {
  return new Request(opts.url ?? "https://app.local/api/usuarios/vinculos/leadership?projectId=project-1", {
    method,
    headers: { "content-type": "application/json" },
    body: opts.rawBody ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
  }) as unknown as Request;
}

const project = {
  id: "project-1",
  name: "Projeto",
  slug: "projeto-1",
  companyId: "company-1",
  company: { id: "company-1", name: "Empresa", company_name: "Empresa", slug: "empresa-1" },
};

const leader = {
  id: "leader-1",
  name: "Líder",
  full_name: "Líder Completo",
  email: "leader@example.com",
  role: "leader_tc",
  globalRole: null,
  memberships: [],
};

const qaUser = {
  id: "qa-1",
  name: "Usuário TC",
  full_name: "Usuário TC Completo",
  email: "qa@example.com",
};

describe("app/api/usuarios/vinculos/leadership/route.ts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const db = mockPrisma();
    db.membership.findMany.mockResolvedValue([]);
    db.userCompanyLink.findMany.mockResolvedValue([]);
    db.projectTeamAssignment.findMany.mockResolvedValue([]);
    db.user.findMany.mockResolvedValue([]);
    db.project.findUnique.mockResolvedValue(project);
    mockedCreateNotifications.mockResolvedValue(undefined as never);
  });

  describe("GET", () => {
    it("retorna 401 sem usuário autenticado", async () => {
      mockedAuthenticateRequest.mockResolvedValue(null);
      expect((await GET(makeRequest("GET"))).status).toBe(401);
    });

    it("retorna 403 sem relationships:view", async () => {
      mockedAuthenticateRequest.mockResolvedValue(baseUser() as never);
      mockedCheckPermission.mockReturnValue(false);
      expect((await GET(makeRequest("GET"))).status).toBe(403);
    });

    it("retorna 400 sem projectId", async () => {
      mockedAuthenticateRequest.mockResolvedValue(baseUser() as never);
      mockedCheckPermission.mockReturnValue(true);
      expect((await GET(makeRequest("GET", { url: "https://app.local/api/usuarios/vinculos/leadership" }))).status).toBe(400);
    });

    it("retorna 403 quando o projeto está fora do escopo", async () => {
      mockedAuthenticateRequest.mockResolvedValue(baseUser({ companyId: "company-2" }) as never);
      mockedCheckPermission.mockReturnValue(true);
      expect((await GET(makeRequest("GET"))).status).toBe(403);
    });

    it("monta liderança, QA, candidatos e permissões", async () => {
      mockedAuthenticateRequest.mockResolvedValue(baseUser({ role: "future_role" }) as never);
      mockedCheckPermission.mockImplementation((_user, permission) => permission !== "relationships:delete");
      const db = mockPrisma();
      db.projectTeamAssignment.findMany
        .mockResolvedValueOnce([
          { id: "a1", role: "leader_tc", user: { id: "leader-1" } },
          { id: "a2", role: "qa_tc", user: { id: "qa-1" } },
        ])
        .mockResolvedValueOnce([]);
      db.user.findMany
        .mockResolvedValueOnce([{ id: "leader-1" }, { id: "leader-2" }])
        .mockResolvedValueOnce([{ id: "qa-2" }]);

      const body = await (await GET(makeRequest("GET"))).json();
      expect(body.leader.id).toBe("a1");
      expect(body.qaUsers).toHaveLength(1);
      expect(body.leaderCandidates).toEqual([{ id: "leader-2" }]);
      expect(body.permissions).toEqual({ canEdit: true, canDelete: true });
    });

    it("retorna 404 quando o projeto não existe", async () => {
      mockedAuthenticateRequest.mockResolvedValue(baseUser() as never);
      mockedCheckPermission.mockReturnValue(true);
      mockPrisma().project.findUnique.mockResolvedValue(null);
      expect((await GET(makeRequest("GET"))).status).toBe(404);
    });
  });

  describe("POST", () => {
    beforeEach(() => {
      mockedAuthenticateRequest.mockResolvedValue(baseUser() as never);
      mockedCheckPermission.mockReturnValue(true);
    });

    it("retorna 401 sem usuário autenticado", async () => {
      mockedAuthenticateRequest.mockResolvedValue(null);
      expect((await POST(makeRequest("POST", { body: { action: "add_qa" } }))).status).toBe(401);
    });

    it("retorna 403 sem permissão de edição ou criação", async () => {
      mockedCheckPermission.mockReturnValue(false);
      expect((await POST(makeRequest("POST", { body: { action: "add_qa", projectId: "project-1", userId: "qa-1" } }))).status).toBe(403);
    });

    it("valida JSON, ação e projeto", async () => {
      expect((await POST(makeRequest("POST", { rawBody: "{" }))).status).toBe(400);
      expect((await POST(makeRequest("POST", { body: { action: "invalid" } }))).status).toBe(400);
      expect((await POST(makeRequest("POST", { body: { action: "add_qa" } }))).status).toBe(400);
    });

    it("bloqueia empresa divergente", async () => {
      const res = await POST(makeRequest("POST", {
        body: { action: "add_qa", projectId: "project-1", companyId: "company-2", userId: "qa-1" },
      }));
      expect(res.status).toBe(400);
    });

    it("atribui liderança com notificação e auditoria", async () => {
      const db = mockPrisma();
      db.user.findUnique.mockResolvedValue(leader);
      db.projectTeamAssignment.findFirst.mockResolvedValue(null);
      db.membership.upsert.mockResolvedValue({});
      db.projectTeamAssignment.create.mockResolvedValue({ id: "assignment-leader" });

      const res = await POST(makeRequest("POST", {
        body: { action: "assign_leader", projectId: "project-1", userId: "leader-1" },
      }));
      expect(res.status).toBe(200);
      expect(mockedCreateNotifications).toHaveBeenCalledWith(["leader-1"], expect.objectContaining({ title: "Liderança atribuída" }));
      expect(mockedWriteAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "assign_leader" }));
    });

    it("transfere liderança e notifica líder anterior, novo líder e QA", async () => {
      const db = mockPrisma();
      db.projectTeamAssignment.findFirst.mockResolvedValue({ id: "old-assignment", userId: "old-leader" });
      db.user.findUnique.mockResolvedValue({ ...leader, id: "new-leader" });
      db.membership.upsert.mockResolvedValue({});
      db.projectTeamAssignment.update.mockResolvedValue({ id: "old-assignment" });
      db.projectTeamAssignment.create.mockResolvedValue({ id: "new-assignment" });
      db.projectTeamAssignment.findMany.mockResolvedValue([{ userId: "qa-1" }]);

      const res = await POST(makeRequest("POST", {
        body: {
          action: "transfer_leader",
          projectId: "project-1",
          newLeaderId: "new-leader",
          reason: "Troca necessária",
        },
      }));
      expect(res.status).toBe(200);
      expect(mockedCreateNotifications).toHaveBeenCalledWith(
        expect.arrayContaining(["old-leader", "new-leader", "qa-1"]),
        expect.objectContaining({ title: "Liderança transferida" }),
      );
    });

    it("bloqueia QA duplicado", async () => {
      const db = mockPrisma();
      db.user.findUnique.mockResolvedValue(qaUser);
      db.projectTeamAssignment.findFirst
        .mockResolvedValueOnce({ userId: "leader-1" })
        .mockResolvedValueOnce({ id: "duplicate" });

      const res = await POST(makeRequest("POST", {
        body: { action: "add_qa", projectId: "project-1", userId: "qa-1" },
      }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/já está vinculado/i);
    });

    it("adiciona QA com sucesso", async () => {
      const db = mockPrisma();
      db.user.findUnique.mockResolvedValue(qaUser);
      db.projectTeamAssignment.findFirst
        .mockResolvedValueOnce({ userId: "leader-1" })
        .mockResolvedValueOnce(null);
      db.membership.upsert.mockResolvedValue({});
      db.projectTeamAssignment.create.mockResolvedValue({ id: "assignment-qa" });

      const res = await POST(makeRequest("POST", {
        body: { action: "add_qa", projectId: "project-1", userId: "qa-1" },
      }));
      expect(res.status).toBe(200);
      expect((await res.json()).result.action).toBe("add_qa");
    });

    it("remove QA com justificativa", async () => {
      const db = mockPrisma();
      db.projectTeamAssignment.findUnique.mockResolvedValue({
        id: "assignment-qa",
        projectId: "project-1",
        role: "qa_tc",
        status: "active",
        userId: "qa-1",
        user: qaUser,
      });
      db.projectTeamAssignment.findFirst.mockResolvedValue({ userId: "leader-1" });
      db.projectTeamAssignment.update.mockResolvedValue({ id: "assignment-qa" });

      const res = await POST(makeRequest("POST", {
        body: {
          action: "remove_qa",
          projectId: "project-1",
          assignmentId: "assignment-qa",
          reason: "Fim do vínculo",
        },
      }));
      expect(res.status).toBe(200);
      expect(mockedCreateNotifications).toHaveBeenCalledWith(
        ["qa-1", "leader-1"],
        expect.objectContaining({ type: "RELATIONSHIP_REMOVED" }),
      );
    });
  });
});