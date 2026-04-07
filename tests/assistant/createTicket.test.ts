/* ── Mock server-only and all store/RBAC dependencies ── */

jest.mock("@/lib/auth/localStore", () => ({
  getLocalUserById: jest.fn().mockResolvedValue({ id: "u1", name: "Ana", email: "ana@test.com" }),
  findLocalCompanyBySlug: jest.fn().mockResolvedValue({ id: "c1", slug: "acme" }),
}));

jest.mock("@/lib/permissionMatrix", () => ({
  hasPermissionAccess: jest.fn().mockReturnValue(true),
}));

jest.mock("@/lib/ticketEventsStore", () => ({
  appendTicketEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/notificationService", () => ({
  notifyTicketCreated: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/ticketsPresenter", () => ({
  attachAssigneeToTicket: jest.fn().mockImplementation((t: Record<string, unknown>) => Promise.resolve(t)),
}));

jest.mock("@/lib/ticketsStore", () => ({
  createTicket: jest.fn().mockResolvedValue({
    id: "t1",
    code: "SP-000001",
    title: "Mock ticket",
    description: "Mock desc",
    type: "bug",
    priority: "high",
    status: "backlog",
    createdBy: "u1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }),
}));

jest.mock("@/lib/assistant/data", () => ({
  buildPromptActions: jest.fn().mockReturnValue([]),
  displayName: jest.fn().mockReturnValue("Ana"),
  formatTicketCard: jest.fn().mockReturnValue("SP-000001 | Mock ticket | bug | high"),
}));

import { buildTicketCreationAction, executeCreateTicket } from "@/lib/assistant/tools/createTicket";
import { hasPermissionAccess } from "@/lib/permissionMatrix";
import { createTicket } from "@/lib/ticketsStore";
import type { AuthUser } from "@/lib/jwtAuth";
import type { AssistantScreenContext, AssistantToolAction } from "@/lib/assistant/types";

/* ── Helpers ── */

function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "u1",
    email: "ana@test.com",
    name: "Ana",
    role: "admin",
    companySlug: "acme",
    companyId: "c1",
    permissions: {},
    ...overrides,
  } as AuthUser;
}

function makeContext(overrides: Partial<AssistantScreenContext> = {}): AssistantScreenContext {
  return {
    route: "/admin/support",
    module: "support",
    screenLabel: "Kanban global de suporte",
    screenSummary: "",
    entityType: "screen",
    entityId: null,
    companySlug: "acme",
    suggestedPrompts: [],
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  (hasPermissionAccess as jest.Mock).mockReturnValue(true);
});

/* ──────────────────────────────────────────────── */
/*  buildTicketCreationAction                       */
/* ──────────────────────────────────────────────── */

describe("buildTicketCreationAction", () => {
  /* ── Permission denied ── */

  it("rejects user without permission", async () => {
    (hasPermissionAccess as jest.Mock).mockReturnValue(false);
    const result = await buildTicketCreationAction(makeUser(), makeContext(), "criar chamado");
    expect(result.success).toBe(false);
    expect(result.reply).toContain("nao pode criar chamados");
  });

  /* ── Generic prompt (instruction-only) ── */

  it("asks for content on generic prompt", async () => {
    const result = await buildTicketCreationAction(makeUser(), makeContext(), "transformar texto em chamado");
    expect(result.tool).toBe("create_ticket");
    expect(result.reply).toContain("conteudo real");
    expect(result.actions).toBeDefined();
    expect(result.actions!.length).toBeGreaterThan(0);
  });

  /* ── Structured draft — incomplete ── */

  it("returns pending issues for incomplete structured draft", async () => {
    const message = "Titulo: \nDescricao: ";
    const result = await buildTicketCreationAction(makeUser(), makeContext(), message);
    expect(result.tool).toBe("create_ticket");
    expect(result.reply).toContain("Pendencias");
  });

  /* ── Structured draft — valid ── */

  it("prepares a valid structured draft with create action", async () => {
    const message = [
      "Titulo: Erro no dashboard ao exportar CSV",
      "Descricao: Ao clicar em exportar, o sistema retorna 500 e não gera o arquivo",
      "Impacto: Gerentes não conseguem extrair relatórios semanais",
      "Tipo: bug",
      "Prioridade: alta",
    ].join("\n");

    const result = await buildTicketCreationAction(makeUser(), makeContext(), message);
    expect(result.success).toBe(true);
    expect(result.reply).toContain("Titulo:");
    expect(result.actions).toBeDefined();

    const toolAction = result.actions?.find((a) => a.kind === "tool");
    expect(toolAction).toBeDefined();
    expect((toolAction as AssistantToolAction).input.title).toContain("Erro no dashboard");
  });

  /* ── Structured draft — validation failures ── */

  it("rejects structured draft with instruction-only title", async () => {
    const message = [
      "Titulo: criar chamado",
      "Descricao: Ao clicar em exportar, o sistema retorna 500 e não gera o arquivo",
      "Tipo: bug",
    ].join("\n");

    const result = await buildTicketCreationAction(makeUser(), makeContext(), message);
    expect(result.reply).toContain("validacoes");
  });

  /* ── Narrative too short ── */

  it("asks for more content when narrative is too short", async () => {
    const result = await buildTicketCreationAction(makeUser(), makeContext(), "criar ticket xyz");
    expect(result.reply).toContain("validacoes");
  });

  /* ── Narrative with enough content ── */

  it("builds a draft from a narrative with enough content", async () => {
    const message = "criar chamado: o relatório financeiro mostra valores duplicados e os totais estão errados desde a ultima atualização";
    const result = await buildTicketCreationAction(makeUser(), makeContext(), message);
    expect(result.success).toBe(true);
    expect(result.actions).toBeDefined();
  });
});

/* ──────────────────────────────────────────────── */
/*  executeCreateTicket                             */
/* ──────────────────────────────────────────────── */

describe("executeCreateTicket", () => {
  function makeAction(overrides: Partial<AssistantToolAction["input"]> = {}): AssistantToolAction {
    return {
      kind: "tool",
      label: "Criar chamado agora",
      tool: "create_ticket",
      input: {
        title: "Erro no dashboard",
        description: "Ao exportar CSV, o sistema retorna erro 500 interno",
        type: "bug",
        priority: "high",
        companySlug: "acme",
        ...overrides,
      },
    };
  }

  it("rejects user without permission", async () => {
    (hasPermissionAccess as jest.Mock).mockReturnValue(false);
    const result = await executeCreateTicket(makeUser(), makeContext(), makeAction());
    expect(result.success).toBe(false);
    expect(result.reply).toContain("nao pode criar chamados");
  });

  it("rejects invalid draft data", async () => {
    const result = await executeCreateTicket(makeUser(), makeContext(), makeAction({ title: "ab" }));
    expect(result.success).toBe(false);
    expect(result.reply).toContain("validacoes");
  });

  it("creates ticket successfully", async () => {
    const result = await executeCreateTicket(makeUser(), makeContext(), makeAction());
    expect(result.success).toBe(true);
    expect(result.reply).toContain("SP-000001");
    expect(createTicket).toHaveBeenCalledTimes(1);
  });

  it("returns failure when store returns null", async () => {
    (createTicket as jest.Mock).mockResolvedValueOnce(null);
    const result = await executeCreateTicket(makeUser(), makeContext(), makeAction());
    expect(result.success).toBe(false);
    expect(result.reply).toContain("Nao consegui criar");
  });
});
