/**
 * Integration tests for the assistant orchestrator (service.ts).
 *
 * These tests verify the "glue" between routing, tools, and guards.
 * All tool executors and stores are mocked — we test the orchestrator flow,
 * not the tool implementations (those have their own suites).
 */

/* ── Mock everything server-side ── */

jest.mock("@/lib/assistantAuditLog", () => ({
  appendAssistantAuditEntry: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/auth/localStore", () => ({
  getLocalUserById: jest.fn().mockResolvedValue({ id: "u1", name: "Ana", email: "ana@test.com" }),
  findLocalCompanyBySlug: jest.fn().mockResolvedValue({ id: "c1", slug: "acme" }),
  listLocalUsers: jest.fn().mockResolvedValue([]),
  listLocalCompanies: jest.fn().mockResolvedValue([]),
  listLocalMemberships: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/lib/permissionMatrix", () => ({
  hasPermissionAccess: jest.fn().mockReturnValue(true),
}));

jest.mock("@/lib/rbac/tickets", () => ({
  canAccessGlobalTicketWorkspace: jest.fn().mockReturnValue(true),
  canViewTicket: jest.fn().mockReturnValue(true),
  canCommentTicket: jest.fn().mockReturnValue(true),
}));

jest.mock("@/lib/ticketsStore", () => ({
  listAllTickets: jest.fn().mockResolvedValue([]),
  listTicketsForUser: jest.fn().mockResolvedValue([]),
  getTicketById: jest.fn().mockResolvedValue(null),
  createTicket: jest.fn().mockResolvedValue({ id: "t1", code: "SP-000001", title: "Mock", type: "bug", priority: "high", status: "backlog", createdBy: "u1", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }),
  touchTicket: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/ticketsPresenter", () => ({
  attachAssigneeInfo: jest.fn().mockImplementation((t: unknown) => Promise.resolve(t)),
  attachAssigneeToTicket: jest.fn().mockImplementation((t: unknown) => Promise.resolve(t)),
}));

jest.mock("@/lib/ticketCommentsStore", () => ({
  createTicketComment: jest.fn().mockResolvedValue({ id: "c1", body: "mock" }),
  listTicketComments: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/lib/ticketEventsStore", () => ({
  appendTicketEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/notificationService", () => ({
  notifyTicketCreated: jest.fn().mockResolvedValue(undefined),
  notifyTicketCommentAdded: jest.fn().mockResolvedValue(undefined),
}));

import { runAssistantRequest } from "@/lib/assistant/service";
import { appendAssistantAuditEntry } from "@/lib/assistantAuditLog";
import type { AuthUser } from "@/lib/jwtAuth";
import type { AssistantClientRequest, AssistantToolAction } from "@/lib/assistant/types";

/* ── Helpers ── */

function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "u1",
    email: "ana@test.com",
    name: "Ana",
    role: "admin",
    companySlug: "acme",
    companyId: "c1",
    permissions: { tickets: ["create", "read"], support: ["create", "read"] },
    ...overrides,
  } as AuthUser;
}

function makeRequest(overrides: Partial<AssistantClientRequest> = {}): AssistantClientRequest {
  return {
    message: "",
    context: { route: "/admin/support" },
    history: [],
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

/* ──────────────────────────────────────────────── */
/*  Routing — message intent → correct tool        */
/* ──────────────────────────────────────────────── */

describe("routing", () => {
  it("routes empty message as low-signal (clarify)", async () => {
    const result = await runAssistantRequest(makeUser(), makeRequest({ message: "" }));
    expect(result.tool).toBe("suggest_next_step");
    expect(result.reply).toMatch(/nao consegui|não consegui/i);
    expect(result.context.module).toBe("support");
  });

  it("routes short greeting as low-signal (clarify)", async () => {
    const result = await runAssistantRequest(makeUser(), makeRequest({ message: "oi" }));
    expect(["suggest_next_step", "get_screen_context"]).toContain(result.tool);
  });

  it("routes 'mostrar contexto atual' to get_screen_context", async () => {
    const result = await runAssistantRequest(makeUser(), makeRequest({ message: "mostrar contexto atual" }));
    expect(result.tool).toBe("get_screen_context");
  });

  it("routes 'criar chamado' to create_ticket", async () => {
    const result = await runAssistantRequest(makeUser(), makeRequest({ message: "criar chamado" }));
    expect(result.tool).toBe("create_ticket");
  });

  it("routes 'buscar chamado SP-123' to search_internal_records", async () => {
    const result = await runAssistantRequest(makeUser(), makeRequest({ message: "buscar chamado SP-123" }));
    expect(result.tool).toBe("search_internal_records");
  });

  it("routes 'explicar meu escopo de acesso' to explain_permission", async () => {
    const result = await runAssistantRequest(makeUser(), makeRequest({ message: "explicar meu escopo de acesso" }));
    expect(result.tool).toBe("explain_permission");
  });

  it("routes 'gerar caso de teste' to draft_test_case", async () => {
    const result = await runAssistantRequest(makeUser(), makeRequest({ message: "gerar caso de teste" }));
    expect(result.tool).toBe("draft_test_case");
  });

  it("resolves context from route correctly", async () => {
    const result = await runAssistantRequest(
      makeUser(),
      makeRequest({ message: "oi", context: { route: "/empresas/acme/planos-de-teste" } }),
    );
    expect(result.context.module).toBe("test_plans");
    expect(result.context.companySlug).toBe("acme");
  });
});

/* ──────────────────────────────────────────────── */
/*  Low-signal → clarify reply                     */
/* ──────────────────────────────────────────────── */

describe("low-signal detection", () => {
  it("returns clarify reply for very short ambiguous input", async () => {
    const result = await runAssistantRequest(makeUser(), makeRequest({ message: "abc" }));
    expect(result.tool).toBe("suggest_next_step");
    expect(result.reply).toMatch(/nao consegui|não consegui/i);
  });

  it("returns clarify reply for single digit", async () => {
    const result = await runAssistantRequest(makeUser(), makeRequest({ message: "42" }));
    expect(result.tool).toBe("suggest_next_step");
    expect(result.reply).toMatch(/nao consegui|não consegui/i);
  });

  it("does NOT clarify when awaiting ticket payload", async () => {
    const history = [
      { from: "assistant" as const, text: "Preciso do conteúdo real do chamado.", tool: "create_ticket" as const },
    ];
    const result = await runAssistantRequest(
      makeUser(),
      makeRequest({ message: "ok", history }),
    );
    // Should NOT be a clarify reply when awaiting payload
    expect(result.reply).not.toContain("Nao consegui interpretar");
  });
});

/* ──────────────────────────────────────────────── */
/*  Repeat guard                                   */
/* ──────────────────────────────────────────────── */

describe("repeat guard", () => {
  it("short-circuits exact repeated prompt to same tool", async () => {
    const history = [
      { from: "user" as const, text: "buscar chamado SP-100" },
      { from: "assistant" as const, text: "Encontrei o chamado...", tool: "search_internal_records" as const },
    ];
    const result = await runAssistantRequest(
      makeUser(),
      makeRequest({ message: "buscar chamado SP-100", history }),
    );
    expect(result.reply).toContain("busca");
  });

  it("does NOT short-circuit when message differs", async () => {
    const history = [
      { from: "user" as const, text: "buscar chamado SP-100" },
      { from: "assistant" as const, text: "Encontrei o chamado...", tool: "search_internal_records" as const },
    ];
    const result = await runAssistantRequest(
      makeUser(),
      makeRequest({ message: "buscar chamado SP-200", history }),
    );
    expect(result.tool).toBe("search_internal_records");
    // Should be a fresh search, not the repeated reply
    expect(result.reply).not.toContain("Acabei de rodar essa busca");
  });
});

/* ──────────────────────────────────────────────── */
/*  Tool action dispatch                           */
/* ──────────────────────────────────────────────── */

describe("tool action dispatch", () => {
  it("dispatches create_ticket action to executor", async () => {
    const action: AssistantToolAction = {
      kind: "tool",
      label: "Criar chamado agora",
      tool: "create_ticket",
      input: {
        title: "Erro no dashboard",
        description: "Ao exportar CSV, o sistema retorna erro 500 interno",
        type: "bug",
        priority: "high",
        companySlug: "acme",
      },
    };
    const result = await runAssistantRequest(makeUser(), makeRequest({ action }));
    expect(result.tool).toBe("create_ticket");
    expect(result.reply).toContain("SP-000001");
  });

  it("returns error for unsupported tool action", async () => {
    const action = {
      kind: "tool" as const,
      label: "Ação desconhecida",
      tool: "suggest_next_step" as "create_ticket",
      input: {},
    };
    const result = await runAssistantRequest(makeUser(), makeRequest({ action }));
    expect(result.reply).toMatch(/nao esta disponivel|não está disponível/i);
  });
});

/* ──────────────────────────────────────────────── */
/*  Audit logging                                  */
/* ──────────────────────────────────────────────── */

describe("audit logging", () => {
  it("logs every request to audit", async () => {
    await runAssistantRequest(makeUser(), makeRequest({ message: "mostrar contexto atual" }));
    expect(appendAssistantAuditEntry).toHaveBeenCalledTimes(1);
    expect(appendAssistantAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "u1",
        actionType: "message",
        toolName: "get_screen_context",
        success: true,
      }),
    );
  });

  it("logs tool actions with actionType 'tool'", async () => {
    const action: AssistantToolAction = {
      kind: "tool",
      label: "Criar",
      tool: "create_ticket",
      input: { title: "Test", description: "Test description long enough", type: "bug", priority: "high" },
    };
    await runAssistantRequest(makeUser(), makeRequest({ action }));
    expect(appendAssistantAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: "tool" }),
    );
  });

  it("does not crash when audit fails", async () => {
    (appendAssistantAuditEntry as jest.Mock).mockRejectedValueOnce(new Error("db error"));
    const result = await runAssistantRequest(makeUser(), makeRequest({ message: "mostrar contexto atual" }));
    expect(result.tool).toBe("get_screen_context");
  });
});

/* ──────────────────────────────────────────────── */
/*  Reply structure                                */
/* ──────────────────────────────────────────────── */

describe("reply structure", () => {
  it("always includes tool, reply, and context", async () => {
    const result = await runAssistantRequest(makeUser(), makeRequest({ message: "oi" }));
    expect(result).toHaveProperty("tool");
    expect(result).toHaveProperty("reply");
    expect(result).toHaveProperty("context");
    expect(typeof result.reply).toBe("string");
    expect(result.reply.length).toBeGreaterThan(0);
  });

  it("context reflects the resolved route", async () => {
    const result = await runAssistantRequest(
      makeUser(),
      makeRequest({ message: "oi", context: { route: "/dashboard" } }),
    );
    expect(result.context.route).toBe("/dashboard");
    expect(result.context.module).toBe("dashboard");
  });

  it("sanitizes missing route to /", async () => {
    const result = await runAssistantRequest(
      makeUser(),
      makeRequest({ message: "oi", context: {} }),
    );
    expect(result.context.route).toBe("/");
  });

  it("prioritizes authenticated user company context over route slug", async () => {
    const result = await runAssistantRequest(
      makeUser({ companySlug: "griaule" }),
      makeRequest({ message: "mostrar contexto atual", context: { route: "/empresas/demo/runs" } }),
    );

    expect(result.context.route).toBe("/empresas/demo/runs");
    expect(result.context.companySlug).toBe("griaule");
  });

  it("uses actor company context when user has no bound company", async () => {
    const result = await runAssistantRequest(
      makeUser({ companySlug: null, companySlugs: [] }),
      makeRequest({
        message: "mostrar contexto atual",
        context: { route: "/dashboard" },
        actor: {
          userId: "u1",
          companySlug: "griaule",
          companySlugs: ["griaule"],
          permissionRole: "empresa",
        },
      }),
    );

    expect(result.context.route).toBe("/dashboard");
    expect(result.context.companySlug).toBe("griaule");
  });
});
