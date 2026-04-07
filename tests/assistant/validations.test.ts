import {
  validateAssistantTicketDraft,
  validateAssistantCommentBody,
  validateAssistantTestCaseDraft,
  looksLikeInstructionOnly,
  normalizeTicketTypeInput,
  normalizeTicketPriorityInput,
} from "@/lib/assistant/validations";

/* ──────────────────────────────────────────────── */
/*  normalizeTicketTypeInput                        */
/* ──────────────────────────────────────────────── */

describe("normalizeTicketTypeInput", () => {
  it.each(["bug", "tarefa", "melhoria"] as const)("accepts '%s'", (v) => {
    expect(normalizeTicketTypeInput(v)).toBe(v);
  });

  it("returns null for unknown type", () => {
    expect(normalizeTicketTypeInput("feature")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(normalizeTicketTypeInput("")).toBeNull();
  });
});

/* ──────────────────────────────────────────────── */
/*  normalizeTicketPriorityInput                    */
/* ──────────────────────────────────────────────── */

describe("normalizeTicketPriorityInput", () => {
  it.each([
    ["high", "high"],
    ["alta", "high"],
    ["urgente", "high"],
    ["low", "low"],
    ["baixa", "low"],
    ["medium", "medium"],
    ["media", "medium"],
    ["média", "medium"],
  ] as const)("maps '%s' → '%s'", (input, expected) => {
    expect(normalizeTicketPriorityInput(input)).toBe(expected);
  });

  it("returns null for unknown priority", () => {
    expect(normalizeTicketPriorityInput("critical")).toBeNull();
  });
});

/* ──────────────────────────────────────────────── */
/*  looksLikeInstructionOnly                        */
/* ──────────────────────────────────────────────── */

describe("looksLikeInstructionOnly", () => {
  it("returns true for empty string", () => {
    expect(looksLikeInstructionOnly("")).toBe(true);
  });

  it("returns true for exact instruction strings", () => {
    expect(looksLikeInstructionOnly("criar chamado")).toBe(true);
    expect(looksLikeInstructionOnly("gerar caso de teste")).toBe(true);
    expect(looksLikeInstructionOnly("publicar comentario")).toBe(true);
  });

  it("returns true for partial instruction patterns", () => {
    expect(looksLikeInstructionOnly("criar um chamado")).toBe(true);
    expect(looksLikeInstructionOnly("abrir um ticket")).toBe(true);
  });

  it("returns false for real content", () => {
    expect(looksLikeInstructionOnly("O botão de login não funciona no Safari")).toBe(false);
  });

  it("returns false for descriptive text", () => {
    expect(looksLikeInstructionOnly("Quando clico em salvar, a tela fica branca e perde os dados")).toBe(false);
  });
});

/* ──────────────────────────────────────────────── */
/*  validateAssistantTicketDraft                    */
/* ──────────────────────────────────────────────── */

describe("validateAssistantTicketDraft", () => {
  const VALID_DRAFT = {
    title: "Erro no login SSO",
    description: "Ao tentar acessar via SSO, o sistema retorna 500.",
    type: "bug",
    priority: "alta",
  };

  it("accepts a valid draft", () => {
    const result = validateAssistantTicketDraft(VALID_DRAFT);
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.type).toBe("bug");
    expect(result.priority).toBe("high");
  });

  it("rejects missing title", () => {
    const result = validateAssistantTicketDraft({ ...VALID_DRAFT, title: "" });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.includes("Titulo"))).toBe(true);
  });

  it("rejects title that is too short", () => {
    const result = validateAssistantTicketDraft({ ...VALID_DRAFT, title: "ab" });
    expect(result.ok).toBe(false);
  });

  it("rejects missing description", () => {
    const result = validateAssistantTicketDraft({ ...VALID_DRAFT, description: "" });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.includes("Descricao"))).toBe(true);
  });

  it("rejects instruction-only title", () => {
    const result = validateAssistantTicketDraft({ ...VALID_DRAFT, title: "criar chamado" });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.includes("instrucao"))).toBe(true);
  });

  it("rejects invalid type", () => {
    const result = validateAssistantTicketDraft({ ...VALID_DRAFT, type: "feature" });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.includes("Tipo"))).toBe(true);
  });

  it("rejects invalid priority", () => {
    const result = validateAssistantTicketDraft({ ...VALID_DRAFT, priority: "critical" });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.includes("Prioridade"))).toBe(true);
  });

  it("defaults type to tarefa when omitted", () => {
    const result = validateAssistantTicketDraft({ ...VALID_DRAFT, type: undefined });
    expect(result.type).toBe("tarefa");
  });

  it("defaults priority to medium when omitted", () => {
    const result = validateAssistantTicketDraft({ ...VALID_DRAFT, priority: undefined });
    expect(result.priority).toBe("medium");
  });
});

/* ──────────────────────────────────────────────── */
/*  validateAssistantCommentBody                    */
/* ──────────────────────────────────────────────── */

describe("validateAssistantCommentBody", () => {
  it("accepts valid comment body", () => {
    const result = validateAssistantCommentBody("Verificado e corrigido.");
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("rejects empty comment", () => {
    const result = validateAssistantCommentBody("");
    expect(result.ok).toBe(false);
  });

  it("rejects instruction-only comment", () => {
    const result = validateAssistantCommentBody("publicar comentario");
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.includes("instrucao"))).toBe(true);
  });

  it("normalizes non-string input", () => {
    const result = validateAssistantCommentBody(123);
    expect(result.ok).toBe(false);
    expect(result.body).toBe("");
  });
});

/* ──────────────────────────────────────────────── */
/*  validateAssistantTestCaseDraft                  */
/* ──────────────────────────────────────────────── */

describe("validateAssistantTestCaseDraft", () => {
  const VALID_TC = {
    sourceTitle: "Bug no formulário de cadastro",
    objective: "Validar que o cadastro funciona corretamente após correção",
    reproductionBase: "Acessar a tela de cadastro, preencher os campos e submeter",
    expectedResult: "Formulário salva sem erros e exibe mensagem de sucesso",
  };

  it("accepts a valid test case draft", () => {
    const result = validateAssistantTestCaseDraft(VALID_TC);
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("rejects missing sourceTitle", () => {
    const result = validateAssistantTestCaseDraft({ ...VALID_TC, sourceTitle: "" });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.includes("Titulo"))).toBe(true);
  });

  it("rejects short objective", () => {
    const result = validateAssistantTestCaseDraft({ ...VALID_TC, objective: "testar" });
    expect(result.ok).toBe(false);
  });

  it("rejects missing reproductionBase", () => {
    const result = validateAssistantTestCaseDraft({ ...VALID_TC, reproductionBase: "" });
    expect(result.ok).toBe(false);
  });

  it("rejects instruction-only sourceTitle", () => {
    const result = validateAssistantTestCaseDraft({ ...VALID_TC, sourceTitle: "gerar caso de teste" });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.includes("contexto funcional"))).toBe(true);
  });
});
