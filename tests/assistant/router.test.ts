/* Mock ticketHelpers to avoid transitive server-only deps */
jest.mock("@/lib/assistant/tools/ticketHelpers", () => ({
  parseStructuredTicketDraft: () => null,
  extractNarrativePayload: () => null,
}));

import { chooseTool, isAwaitingTicketPayload, isAwaitingTestCasePayload } from "@/lib/assistant/router";
import type { AssistantConversationTurn, AssistantScreenContext } from "@/lib/assistant/types";

/* ── Helpers ── */

function makeContext(overrides: Partial<AssistantScreenContext> = {}): AssistantScreenContext {
  return {
    route: "/",
    module: "general",
    screenLabel: "General",
    screenSummary: "General context",
    entityType: "screen",
    entityId: null,
    companySlug: null,
    suggestedPrompts: [],
    ...overrides,
  };
}

const EMPTY_HISTORY: AssistantConversationTurn[] = [];

/* ──────────────────────────────────────────────── */
/*  chooseTool                                      */
/* ──────────────────────────────────────────────── */

describe("chooseTool", () => {
  /* ── greeting / empty message → screen context ── */

  it("routes empty message to get_screen_context", () => {
    expect(chooseTool("", makeContext(), EMPTY_HISTORY)).toBe("get_screen_context");
  });

  it("routes 'oi' to get_screen_context", () => {
    expect(chooseTool("oi", makeContext(), EMPTY_HISTORY)).toBe("get_screen_context");
  });

  it("routes 'bom dia' to get_screen_context", () => {
    expect(chooseTool("bom dia", makeContext(), EMPTY_HISTORY)).toBe("get_screen_context");
  });

  /* ── summarize entity ── */

  it("routes 'meu perfil' to summarize_entity", () => {
    expect(chooseTool("meu perfil", makeContext(), EMPTY_HISTORY)).toBe("summarize_entity");
  });

  it("routes 'resumir meus dados' to summarize_entity", () => {
    expect(chooseTool("resumir meus dados", makeContext(), EMPTY_HISTORY)).toBe("summarize_entity");
  });

  /* ── explain permission ── */

  it("routes 'explicar meu escopo de acesso' to explain_permission", () => {
    expect(chooseTool("explicar meu escopo de acesso", makeContext(), EMPTY_HISTORY)).toBe("explain_permission");
  });

  it("routes 'por que não vejo tal tela' to explain_permission", () => {
    expect(chooseTool("por que não vejo tal tela", makeContext(), EMPTY_HISTORY)).toBe("explain_permission");
  });

  /* ── list available actions ── */

  it("routes 'ações disponíveis' to list_available_actions", () => {
    expect(chooseTool("ações disponíveis", makeContext(), EMPTY_HISTORY)).toBe("list_available_actions");
  });

  it("routes 'o que posso fazer' to list_available_actions", () => {
    expect(chooseTool("o que posso fazer", makeContext(), EMPTY_HISTORY)).toBe("list_available_actions");
  });

  /* ── draft test case ── */

  it("routes 'gerar caso de teste' to draft_test_case", () => {
    expect(chooseTool("gerar caso de teste", makeContext(), EMPTY_HISTORY)).toBe("draft_test_case");
  });

  it("routes 'caso de teste montar com base em bug' to draft_test_case", () => {
    expect(chooseTool("caso de teste montar com base em bug", makeContext(), EMPTY_HISTORY)).toBe("draft_test_case");
  });

  /* ── create comment ── */

  it("routes 'comentar no ticket SP-123' to create_comment", () => {
    expect(chooseTool("comentar no ticket SP-123", makeContext(), EMPTY_HISTORY)).toBe("create_comment");
  });

  it("routes 'publicar comentário no chamado 456' to create_comment", () => {
    expect(chooseTool("publicar comentário no chamado 456", makeContext(), EMPTY_HISTORY)).toBe("create_comment");
  });

  /* ── create ticket ── */

  it("routes 'criar chamado' to create_ticket", () => {
    expect(chooseTool("criar chamado", makeContext(), EMPTY_HISTORY)).toBe("create_ticket");
  });

  it("routes 'transformar nota em ticket' to create_ticket", () => {
    expect(chooseTool("transformar nota em ticket", makeContext(), EMPTY_HISTORY)).toBe("create_ticket");
  });

  it("routes 'abrir suporte' to create_ticket", () => {
    expect(chooseTool("abrir suporte", makeContext(), EMPTY_HISTORY)).toBe("create_ticket");
  });

  it("routes 'modelo de chamado' to create_ticket", () => {
    expect(chooseTool("modelo de chamado", makeContext(), EMPTY_HISTORY)).toBe("create_ticket");
  });

  /* ── search ── */

  it("routes 'buscar chamado' to search_internal_records", () => {
    expect(chooseTool("buscar chamado", makeContext(), EMPTY_HISTORY)).toBe("search_internal_records");
  });

  it("routes 'localizar ticket' to search_internal_records", () => {
    expect(chooseTool("localizar ticket", makeContext(), EMPTY_HISTORY)).toBe("search_internal_records");
  });

  it("routes SP-XXX reference to search_internal_records", () => {
    expect(chooseTool("SP-999", makeContext(), EMPTY_HISTORY)).toBe("search_internal_records");
  });

  /* ── suggest next step (fallback) ── */

  it("routes 'próximo passo' to suggest_next_step", () => {
    expect(chooseTool("próximo passo", makeContext(), EMPTY_HISTORY)).toBe("suggest_next_step");
  });

  it("falls back to suggest_next_step for unrecognized input", () => {
    expect(chooseTool("algo completamente aleatório", makeContext(), EMPTY_HISTORY)).toBe("suggest_next_step");
  });

  /* ── context module influences fallback priority ── */

  it("support module favors search for ambiguous messages", () => {
    const ctx = makeContext({ module: "support" });
    // "listar tudo" matches search keywords + support module bonus
    expect(chooseTool("listar tudo", ctx, EMPTY_HISTORY)).toBe("search_internal_records");
  });
});

/* ──────────────────────────────────────────────── */
/*  isAwaitingTicketPayload                         */
/* ──────────────────────────────────────────────── */

describe("isAwaitingTicketPayload", () => {
  it("returns false with empty history", () => {
    expect(isAwaitingTicketPayload([])).toBe(false);
  });

  it("returns false if last assistant turn is not create_ticket", () => {
    const history: AssistantConversationTurn[] = [
      { from: "assistant", text: "preciso do conteudo real", tool: "search_internal_records" },
    ];
    expect(isAwaitingTicketPayload(history)).toBe(false);
  });

  it("returns true when last assistant turn is create_ticket with awaiting text", () => {
    const history: AssistantConversationTurn[] = [
      { from: "assistant", text: "Preciso do conteúdo real do chamado.", tool: "create_ticket" },
    ];
    expect(isAwaitingTicketPayload(history)).toBe(true);
  });

  it("returns true for 'complete o modelo' variant", () => {
    const history: AssistantConversationTurn[] = [
      { from: "assistant", text: "Complete o modelo acima com os dados.", tool: "create_ticket" },
    ];
    expect(isAwaitingTicketPayload(history)).toBe(true);
  });

  it("returns false when last create_ticket turn has no awaiting phrase", () => {
    const history: AssistantConversationTurn[] = [
      { from: "assistant", text: "Chamado criado com sucesso!", tool: "create_ticket" },
    ];
    expect(isAwaitingTicketPayload(history)).toBe(false);
  });
});

/* ──────────────────────────────────────────────── */
/*  isAwaitingTestCasePayload                       */
/* ──────────────────────────────────────────────── */

describe("isAwaitingTestCasePayload", () => {
  it("returns false with empty history", () => {
    expect(isAwaitingTestCasePayload([])).toBe(false);
  });

  it("returns true when last turn is draft_test_case awaiting payload", () => {
    const history: AssistantConversationTurn[] = [
      { from: "assistant", text: "Antes de montar o caso de teste, preciso de mais detalhes.", tool: "draft_test_case" },
    ];
    expect(isAwaitingTestCasePayload(history)).toBe(true);
  });

  it("returns false when tool is not draft_test_case", () => {
    const history: AssistantConversationTurn[] = [
      { from: "assistant", text: "Antes de montar o caso de teste, preciso de mais detalhes.", tool: "create_ticket" },
    ];
    expect(isAwaitingTestCasePayload(history)).toBe(false);
  });
});
