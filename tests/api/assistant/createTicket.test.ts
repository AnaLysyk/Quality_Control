/* â”€â”€ Mock server-only and all store/RBAC dependencies â”€â”€ */

jest.mock("@/backend/auth/localStore", () => ({
  getLocalUserById: jest.fn().mockResolvedValue({ id: "u1", name: "Ana", email: "ana@test.com" }),
  findLocalCompanyBySlug: jest.fn().mockResolvedValue({ id: "c1", slug: "acme" }),
}));

jest.mock("@/backend/permissionMatrix", () => ({
  hasPermissionAccess: jest.fn().mockReturnValue(true),
}));

jest.mock("@/backend/ticketEventsStore", () => ({
  appendTicketEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/backend/notificationService", () => ({
  notifyTicketCreated: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/backend/ticketsPresenter", () => ({
  attachAssigneeToTicket: jest.fn().mockImplementation((t: Record<string, unknown>) => Promise.resolve(t)),
}));

jest.mock("@/backend/ticketsStore", () => ({
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

jest.mock("@/backend/assistant/data", () => ({
  buildPromptActions: jest.fn().mockReturnValue([]),
  displayName: jest.fn().mockReturnValue("Ana"),
  formatTicketCard: jest.fn().mockReturnValue("SP-000001 | Mock ticket | bug | high"),
}));

import { buildTicketCreationAction, executeCreateTicket } from "@/backend/assistant/tools/createTicket";
import { hasPermissionAccess } from "@/backend/permissionMatrix";
import { createTicket } from "@/backend/ticketsStore";
import type { AuthUser } from "@/backend/jwtAuth";
import type { AssistantScreenContext, AssistantToolAction } from "@/backend/assistant/types";

/* â”€â”€ Helpers â”€â”€ */

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

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
/*  buildTicketCreationAction                       */
/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

describe("buildTicketCreationAction", () => {
  /* â”€â”€ Permission denied â”€â”€ */

  it("rejects user without permission", async () => {
    (hasPermissionAccess as jest.Mock).mockReturnValue(false);
    const result = await buildTicketCreationAction(makeUser(), makeContext(), "criar chamado");
    expect(result.success).toBe(false);
    expect(result.reply).toContain("não pode criar chamados");
  });

  /* â”€â”€ Generic prompt (instruction-only) â”€â”€ */

  it("asks for content on generic prompt", async () => {
    const result = await buildTicketCreationAction(makeUser(), makeContext(), "transformar texto em chamado");
    expect(result.tool).toBe("create_ticket");
    expect(result.reply).toContain("conteúdo real");
    expect(result.actions).toBeDefined();
    expect(result.actions!.length).toBeGreaterThan(0);
  });

  /* â”€â”€ Structured draft — incomplete â”€â”€ */

  it("returns pending issues for incomplete structured draft", async () => {
    const message = "Titulo: \nDescricao: ";
    const result = await buildTicketCreationAction(makeUser(), makeContext(), message);
    expect(result.tool).toBe("create_ticket");
    expect(result.reply).toContain("Pendências");
  });

  /* â”€â”€ Structured draft — valid â”€â”€ */

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
    expect(result.reply).toContain("Título:");
    expect(result.actions).toBeDefined();

    const toolAction = result.actions?.find((a) => a.kind === "tool");
    expect(toolAction).toBeDefined();
    expect((toolAction as AssistantToolAction).input.title).toContain("Erro no dashboard");
  });

  /* â”€â”€ Structured draft — validation failures â”€â”€ */

  it("rejects structured draft with instruction-only title", async () => {
    const message = [
      "Titulo: criar chamado",
      "Descricao: Ao clicar em exportar, o sistema retorna 500 e não gera o arquivo",
      "Tipo: bug",
    ].join("\n");

    const result = await buildTicketCreationAction(makeUser(), makeContext(), message);
    expect(result.reply).toContain("validações");
  });

  /* â”€â”€ Narrative too short â”€â”€ */

  it("asks for more content when narrative is too short", async () => {
    const result = await buildTicketCreationAction(makeUser(), makeContext(), "criar ticket xyz");
    expect(result.reply).toContain("validações");
  });

  /* â”€â”€ Narrative with enough content â”€â”€ */

  it("builds a draft from a narrative with enough content", async () => {
    const message = "criar chamado: o relatório financeiro mostra valores duplicados e os totais estão errados desde a ultima atualização";
    const result = await buildTicketCreationAction(makeUser(), makeContext(), message);
    expect(result.success).toBe(true);
    expect(result.actions).toBeDefined();
  });
});

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
/*  executeCreateTicket                             */
/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

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
    expect(result.reply).toContain("não pode criar chamados");
  });

  it("rejects invalid draft data", async () => {
    const result = await executeCreateTicket(makeUser(), makeContext(), makeAction({ title: "ab" }));
    expect(result.success).toBe(false);
    expect(result.reply).toContain("validações");
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
    expect(result.reply).toContain("Não consegui criar");
  });
});

