import {
  parseStructuredTicketDraft,
  inferTicketType,
  inferTicketPriority,
  buildTicketTitle,
  buildTicketDescription,
  buildStructuredTicketDescription,
  extractNarrativePayload,
  extractTicketNarrativeSource,
  isTicketTemplateRequest,
  isGenericTicketPrompt,
} from "@/lib/assistant/tools/ticketHelpers";
import type { AssistantScreenContext } from "@/lib/assistant/types";

/* â”€â”€ Helpers â”€â”€ */

function ctx(overrides: Partial<AssistantScreenContext> = {}): AssistantScreenContext {
  return {
    route: "/admin/support",
    module: "support",
    screenLabel: "Kanban global de suporte",
    screenSummary: "",
    entityType: "screen",
    entityId: null,
    companySlug: null,
    suggestedPrompts: [],
    ...overrides,
  };
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
/*  parseStructuredTicketDraft                      */
/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

describe("parseStructuredTicketDraft", () => {
  it("returns null for plain text without named fields", () => {
    expect(parseStructuredTicketDraft("apenas um texto simples sem campos")).toBeNull();
  });

  it("parses a complete structured draft", () => {
    const input = [
      "Titulo: BotÃ£o de login sem resposta",
      "Descricao: Ao clicar em login, nada acontece",
      "Impacto: UsuÃ¡rios nÃ£o conseguem acessar o sistema",
      "Comportamento esperado: Redirecionar para o dashboard",
      "Comportamento atual: A tela fica branca",
      "Tipo: bug",
      "Prioridade: alta",
    ].join("\n");

    const result = parseStructuredTicketDraft(input);
    expect(result).not.toBeNull();
    expect(result!.hasNamedFields).toBe(true);
    expect(result!.title).toBe("BotÃ£o de login sem resposta");
    expect(result!.description).toBe("Ao clicar em login, nada acontece");
    expect(result!.impact).toContain("nÃ£o conseguem acessar");
    expect(result!.type).toBe("bug");
    expect(result!.priority).toBe("high");
  });

  it("parses with accented field names (TÃ­tulo, DescriÃ§Ã£o)", () => {
    const input = [
      "TÃ­tulo: Erro no dashboard",
      "DescriÃ§Ã£o: O grÃ¡fico nÃ£o carrega",
    ].join("\n");

    const result = parseStructuredTicketDraft(input);
    expect(result).not.toBeNull();
    expect(result!.title).toBe("Erro no dashboard");
    expect(result!.description).toBe("O grÃ¡fico nÃ£o carrega");
  });

  it("parses priority 'media' as medium", () => {
    const input = "Titulo: teste\nDescricao: desc\nPrioridade: media";
    const result = parseStructuredTicketDraft(input);
    expect(result!.priority).toBe("medium");
  });

  it("parses priority 'baixa' as low", () => {
    const input = "Titulo: teste\nDescricao: desc\nPrioridade: baixa";
    const result = parseStructuredTicketDraft(input);
    expect(result!.priority).toBe("low");
  });

  it("parses type 'melhoria'", () => {
    const input = "Titulo: teste\nDescricao: desc\nTipo: melhoria";
    const result = parseStructuredTicketDraft(input);
    expect(result!.type).toBe("melhoria");
  });

  it("parses type 'tarefa'", () => {
    const input = "Titulo: teste\nDescricao: desc\nTipo: tarefa";
    const result = parseStructuredTicketDraft(input);
    expect(result!.type).toBe("tarefa");
  });

  it("handles multiline description", () => {
    const input = [
      "Titulo: Bug X",
      "Descricao: Linha 1",
      "mais contexto aqui",
      "e aqui tambem",
    ].join("\n");

    const result = parseStructuredTicketDraft(input);
    expect(result!.description).toContain("mais contexto aqui");
    expect(result!.description).toContain("e aqui tambem");
  });

  it("returns null type/priority when not provided", () => {
    const input = "Titulo: Algo\nDescricao: Detalhe do problema aqui";
    const result = parseStructuredTicketDraft(input);
    expect(result!.type).toBeNull();
    expect(result!.priority).toBeNull();
  });
});

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
/*  inferTicketType                                 */
/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

describe("inferTicketType", () => {
  it("detects 'bug' keyword â†’ bug", () => {
    expect(inferTicketType("Tem um bug no login", ctx())).toBe("bug");
  });

  it("detects 'erro' keyword â†’ bug", () => {
    expect(inferTicketType("Erro ao salvar formulÃ¡rio", ctx())).toBe("bug");
  });

  it("detects 'falha' keyword â†’ bug", () => {
    expect(inferTicketType("Falha na integraÃ§Ã£o", ctx())).toBe("bug");
  });

  it("detects 'melhoria' keyword â†’ melhoria", () => {
    expect(inferTicketType("SugestÃ£o de melhoria na tela", ctx())).toBe("melhoria");
  });

  it("detects 'sugestÃ£o' â†’ melhoria", () => {
    expect(inferTicketType("Uma sugestÃ£o para o dashboard", ctx())).toBe("melhoria");
  });

  it("defaults to tarefa for test_plans module", () => {
    expect(inferTicketType("preciso organizar", ctx({ module: "test_plans" }))).toBe("tarefa");
  });

  it("defaults to tarefa for unrecognized text", () => {
    expect(inferTicketType("verificar o relatÃ³rio", ctx())).toBe("tarefa");
  });
});

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
/*  inferTicketPriority                             */
/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

describe("inferTicketPriority", () => {
  it("detects 'urgente' â†’ high", () => {
    expect(inferTicketPriority("Isso Ã© urgente")).toBe("high");
  });

  it("detects 'critico' â†’ high", () => {
    expect(inferTicketPriority("cenÃ¡rio critico")).toBe("high");
  });

  it("detects 'bloqueia' â†’ high", () => {
    expect(inferTicketPriority("o erro bloqueia o acesso")).toBe("high");
  });

  it("detects 'nÃ£o abre' â†’ high", () => {
    expect(inferTicketPriority("a tela nÃ£o abre")).toBe("high");
  });

  it("detects 'baixa' â†’ low", () => {
    expect(inferTicketPriority("prioridade baixa")).toBe("low");
  });

  it("detects 'simples' â†’ low", () => {
    expect(inferTicketPriority("ajuste simples")).toBe("low");
  });

  it("defaults to medium", () => {
    expect(inferTicketPriority("verificar o relatÃ³rio")).toBe("medium");
  });
});

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
/*  buildTicketTitle                                */
/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

describe("buildTicketTitle", () => {
  it("strips action verbs and ticket keywords", () => {
    const result = buildTicketTitle("criar chamado sobre botÃ£o quebrado", ctx());
    expect(result).not.toContain("criar");
    expect(result).not.toContain("chamado");
    expect(result).toContain("botÃ£o quebrado");
  });

  it("takes only the first sentence", () => {
    const result = buildTicketTitle("Erro no login. Precisamos resolver logo.", ctx());
    expect(result).toBe("Erro no login");
  });

  it("falls back to context label when message is empty after cleaning", () => {
    const result = buildTicketTitle("criar chamado", ctx());
    expect(result).toContain("Kanban global de suporte");
  });

  it("truncates to 110 chars", () => {
    const long = "A".repeat(200);
    expect(buildTicketTitle(long, ctx()).length).toBeLessThanOrEqual(110);
  });
});

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
/*  buildTicketDescription                          */
/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

describe("buildTicketDescription", () => {
  it("includes screen label and route", () => {
    const result = buildTicketDescription("O botÃ£o nÃ£o funciona", ctx());
    expect(result).toContain("Kanban global de suporte");
    expect(result).toContain("/admin/support");
  });

  it("includes the user message", () => {
    const result = buildTicketDescription("O botÃ£o nÃ£o funciona", ctx());
    expect(result).toContain("O botÃ£o nÃ£o funciona");
  });

  it("truncates to 1900 chars max", () => {
    const long = "X".repeat(3000);
    expect(buildTicketDescription(long, ctx()).length).toBeLessThanOrEqual(1900);
  });
});

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
/*  buildStructuredTicketDescription                */
/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

describe("buildStructuredTicketDescription", () => {
  it("includes description, impact, and behavior fields", () => {
    const draft = {
      hasNamedFields: true,
      title: "Bug X",
      description: "Detalhe do problema",
      impact: "UsuÃ¡rios sem acesso",
      expectedBehavior: "Deveria funcionar",
      currentBehavior: "Tela branca",
      type: null,
      priority: null,
    };
    const result = buildStructuredTicketDescription(draft, ctx());
    expect(result).toContain("Detalhe do problema");
    expect(result).toContain("UsuÃ¡rios sem acesso");
    expect(result).toContain("Deveria funcionar");
    expect(result).toContain("Tela branca");
  });

  it("handles missing optional fields", () => {
    const draft = {
      hasNamedFields: true,
      title: "Bug Y",
      description: "Apenas descriÃ§Ã£o",
      impact: "",
      expectedBehavior: "",
      currentBehavior: "",
      type: null,
      priority: null,
    };
    const result = buildStructuredTicketDescription(draft, ctx());
    expect(result).toContain("Apenas descriÃ§Ã£o");
    expect(result).not.toContain("Impacto:");
  });
});

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
/*  extractNarrativePayload                         */
/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

describe("extractNarrativePayload", () => {
  it("extracts payload from 'converter esta nota ... em chamado'", () => {
    const result = extractNarrativePayload("converter esta nota o botÃ£o estÃ¡ quebrado em chamado");
    expect(result).toContain("botÃ£o estÃ¡ quebrado");
  });

  it("extracts payload from 'nota: ...' pattern", () => {
    const result = extractNarrativePayload("nota: o sistema nÃ£o responde apÃ³s login");
    expect(result).toContain("o sistema nÃ£o responde");
  });

  it("returns empty string when no pattern matches", () => {
    expect(extractNarrativePayload("nada relevante aqui")).toBe("");
  });
});

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
/*  extractTicketNarrativeSource                    */
/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

describe("extractTicketNarrativeSource", () => {
  it("strips action verbs and noise words", () => {
    const result = extractTicketNarrativeSource("transformar este texto em ticket com base nesta tela");
    expect(result).not.toContain("transformar");
    expect(result).not.toContain("ticket");
    expect(result).not.toContain("com base");
  });

  it("preserves actual content", () => {
    const result = extractTicketNarrativeSource("criar chamado: o relatÃ³rio mostra dados errados");
    expect(result).toContain("relatÃ³rio mostra dados errados");
  });
});

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
/*  isTicketTemplateRequest                         */
/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

describe("isTicketTemplateRequest", () => {
  it("returns true for 'modelo de chamado'", () => {
    expect(isTicketTemplateRequest("Quero o modelo de chamado")).toBe(true);
  });

  it("returns true for 'modelo de ticket'", () => {
    expect(isTicketTemplateRequest("modelo de ticket")).toBe(true);
  });

  it("returns true for structured field reference", () => {
    expect(isTicketTemplateRequest("titulo, descricao, impacto e comportamento esperado")).toBe(true);
  });

  it("returns false for regular text", () => {
    expect(isTicketTemplateRequest("o botÃ£o nÃ£o funciona")).toBe(false);
  });
});

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
/*  isGenericTicketPrompt                           */
/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

describe("isGenericTicketPrompt", () => {
  it("returns true for exact generic phrases", () => {
    expect(isGenericTicketPrompt("transformar texto ou nota em chamado")).toBe(true);
    expect(isGenericTicketPrompt("transformar nota em chamado")).toBe(true);
    expect(isGenericTicketPrompt("transformar relato em chamado")).toBe(true);
    expect(isGenericTicketPrompt("criar ticket a partir desta tela")).toBe(true);
  });

  it("returns false for text with actual content", () => {
    expect(isGenericTicketPrompt("criar ticket sobre erro no login")).toBe(false);
  });

  it("is case-insensitive via normalizeSearch", () => {
    expect(isGenericTicketPrompt("TRANSFORMAR TEXTO EM CHAMADO")).toBe(true);
  });
});

