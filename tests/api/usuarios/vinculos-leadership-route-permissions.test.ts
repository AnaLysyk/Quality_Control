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
    $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(prisma)),
  },
}));

import { GET, POST } from "@/api/usuarios/vinculos/leadership/route";
import { authenticateRequest } from "@/backend/jwtAuth";
import { checkPermission } from "@/backend/permissions/checkPermission";
import { createNotificationsForUsers } from "@/backend/userNotificationsStore";
import { writeAuditLog } from "@/backend/audit/writeAuditLog";
import { prisma } from "@/database/prismaClient";

const auth = authenticateRequest as jest.MockedFunction<typeof authenticateRequest>;
const permission = checkPermission as jest.MockedFunction<typeof checkPermission>;
const notify = createNotificationsForUsers as jest.MockedFunction<typeof createNotificationsForUsers>;
const audit = writeAuditLog as jest.MockedFunction<typeof writeAuditLog>;
const db = prisma as unknown as {
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

const project = {
  id: "project-1",
  name: "Projeto",
  slug: "projeto-1",
  companyId: "company-1",
  company: { id: "company-1", name: "Empresa", company_name: "Empresa", slug: "empresa-1" },
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

function request(method: string, body?: unknown, url = "https://app.local/api/usuarios/vinculos/leadership?projectId=project-1") {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as unknown as Request;
}

describe("leadership route permissions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.project.findUnique.mockResolvedValue(project);
    db.membership.findMany.mockResolvedValue([]);
    db.userCompanyLink.findMany.mockResolvedValue([]);
    db.projectTeamAssignment.findMany.mockResolvedValue([]);
    db.user.findMany.mockResolvedValue([]);
    notify.mockResolvedValue(undefined as never);
    audit.mockResolvedValue(undefined as never);
  });

  it("retorna 401 sem autenticação", async () => {
    auth.mockResolvedValue(null);
    expect((await GET(request("GET"))).status).toBe(401);
  });

  it("retorna 403 sem permissão de visualização", async () => {
    auth.mockResolvedValue(user() as never);
    permission.mockReturnValue(false);
    expect((await GET(request("GET"))).status).toBe(403);
  });

  it("monta liderança, QA, candidatos e permissões sem depender da ordem dos mocks", async () => {
    auth.mockResolvedValue(user({ role: "future_role" }) as never);
    permission.mockImplementation((_current, name) => name !== "relationships:delete");

    db.projectTeamAssignment.findMany.mockImplementation(({ where }: { where?: Record<string, unknown> }) => {
      if (where?.userId === "user-1") return Promise.resolve([]);
      if (where?.projectId === "project-1") {
        return Promise.resolve([
          { id: "a1", role: "leader_tc", user: { id: "leader-1" } },
          { id: "a2", role: "qa_tc", user: { id: "qa-1" } },
        ]);
      }
      return Promise.resolve([]);
    });
    db.user.findMany
      .mockResolvedValueOnce([{ id: "leader-1" }, { id: "leader-2" }])
      .mockResolvedValueOnce([{ id: "qa-2" }]);

    const body = await (await GET(request("GET"))).json();
    expect(body.leader.id).toBe("a1");
    expect(body.qaUsers).toHaveLength(1);
    expect(body.leaderCandidates).toEqual([{ id: "leader-2" }]);
    expect(body.permissions).toEqual({ canEdit: true, canDelete: true });
  });

  it("retorna 404 quando o projeto não existe", async () => {
    auth.mockResolvedValue(user() as never);
    permission.mockReturnValue(true);
    db.project.findUnique.mockResolvedValue(null);
    expect((await GET(request("GET"))).status).toBe(404);
  });

  it("atribui liderança e registra notificação e auditoria", async () => {
    auth.mockResolvedValue(user() as never);
    permission.mockReturnValue(true);
    db.user.findUnique.mockResolvedValue({
      id: "leader-1",
      name: "Líder",
      full_name: "Líder Completo",
      email: "leader@example.com",
      role: "leader_tc",
      globalRole: null,
      memberships: [],
    });
    db.projectTeamAssignment.findFirst.mockResolvedValue(null);
    db.membership.upsert.mockResolvedValue({});
    db.projectTeamAssignment.create.mockResolvedValue({ id: "assignment-1" });

    const res = await POST(request("POST", {
      action: "assign_leader",
      projectId: "project-1",
      userId: "leader-1",
    }));

    expect(res.status).toBe(200);
    expect(notify).toHaveBeenCalledWith(["leader-1"], expect.objectContaining({ title: "Liderança atribuída" }));
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: "assign_leader" }));
  });

  it("bloqueia alteração sem permissão", async () => {
    auth.mockResolvedValue(user() as never);
    permission.mockReturnValue(false);
    expect((await POST(request("POST", { action: "add_qa", projectId: "project-1", userId: "qa-1" }))).status).toBe(403);
  });
});
