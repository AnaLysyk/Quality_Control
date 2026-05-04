import {
  stripAccents,
  normalizeSearch,
  normalizeText,
  normalizePromptText,
  compactMultiline,
  formatDateTime,
  normalizeCommentForComparison,
  formatValidationIssues,
  sanitizeRoute,
} from "@/lib/assistant/helpers";

/* ──────────────────────────────────────────────── */
/*  stripAccents                                    */
/* ──────────────────────────────────────────────── */

describe("stripAccents", () => {
  it("removes accents from Portuguese text", () => {
    expect(stripAccents("descrição")).toBe("descricao");
    expect(stripAccents("título")).toBe("titulo");
    expect(stripAccents("próximo")).toBe("proximo");
  });

  it("leaves ASCII text unchanged", () => {
    expect(stripAccents("hello")).toBe("hello");
  });
});

/* ──────────────────────────────────────────────── */
/*  normalizeSearch                                 */
/* ──────────────────────────────────────────────── */

describe("normalizeSearch", () => {
  it("lowercases and strips accents", () => {
    expect(normalizeSearch("Criar Chamado")).toBe("criar chamado");
  });

  it("strips accents", () => {
    expect(normalizeSearch("Ação disponível")).toBe("acao disponivel");
  });

  it("trims whitespace", () => {
    expect(normalizeSearch("  oi  ")).toBe("oi");
  });
});

/* ──────────────────────────────────────────────── */
/*  normalizeText                                   */
/* ──────────────────────────────────────────────── */

describe("normalizeText", () => {
  it("returns empty string for non-string input", () => {
    expect(normalizeText(null)).toBe("");
    expect(normalizeText(undefined)).toBe("");
    expect(normalizeText(42)).toBe("");
  });

  it("trims and collapses whitespace", () => {
    expect(normalizeText("  hello   world  ")).toBe("hello world");
  });

  it("truncates to max length", () => {
    expect(normalizeText("abcdefgh", 5)).toBe("abcde");
  });
});

/* ──────────────────────────────────────────────── */
/*  normalizePromptText                             */
/* ──────────────────────────────────────────────── */

describe("normalizePromptText", () => {
  it("returns empty string for non-string input", () => {
    expect(normalizePromptText(123)).toBe("");
  });

  it("normalizes lines preserving structure", () => {
    expect(normalizePromptText("  line1  \n  line2  ")).toBe("line1\n line2");
  });

  it("converts CRLF to LF", () => {
    expect(normalizePromptText("a\r\nb")).toBe("a\nb");
  });
});

/* ──────────────────────────────────────────────── */
/*  compactMultiline                                */
/* ──────────────────────────────────────────────── */

describe("compactMultiline", () => {
  it("trims trailing spaces on each line", () => {
    expect(compactMultiline("hello   \nworld   ")).toBe("hello\nworld");
  });

  it("trims leading/trailing blank lines", () => {
    expect(compactMultiline("\n\nhello\n\n")).toBe("hello");
  });
});

/* ──────────────────────────────────────────────── */
/*  formatDateTime                                  */
/* ──────────────────────────────────────────────── */

describe("formatDateTime", () => {
  it("returns 'sem data' for null/undefined", () => {
    expect(formatDateTime(null)).toBe("sem data");
    expect(formatDateTime(undefined)).toBe("sem data");
  });

  it("returns the raw value for invalid dates", () => {
    expect(formatDateTime("not-a-date")).toBe("not-a-date");
  });

  it("formats a valid ISO date in pt-BR", () => {
    const result = formatDateTime("2024-06-15T14:30:00Z");
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });
});

/* ──────────────────────────────────────────────── */
/*  normalizeCommentForComparison                   */
/* ──────────────────────────────────────────────── */

describe("normalizeCommentForComparison", () => {
  it("removes accents, punctuation and extra spaces", () => {
    expect(normalizeCommentForComparison("Olá, tudo bem?")).toBe("ola tudo bem");
  });

  it("lowercases text", () => {
    expect(normalizeCommentForComparison("HELLO")).toBe("hello");
  });
});

/* ──────────────────────────────────────────────── */
/*  formatValidationIssues                          */
/* ──────────────────────────────────────────────── */

describe("formatValidationIssues", () => {
  it("numbers issues starting from 1", () => {
    const result = formatValidationIssues(["A", "B"]);
    expect(result).toBe("1. A\n2. B");
  });

  it("returns empty string for empty array", () => {
    expect(formatValidationIssues([])).toBe("");
  });
});

/* ──────────────────────────────────────────────── */
/*  sanitizeRoute                                   */
/* ──────────────────────────────────────────────── */

describe("sanitizeRoute", () => {
  it("prepends / if missing", () => {
    expect(sanitizeRoute("admin")).toBe("/admin");
  });

  it("keeps a valid route as-is", () => {
    expect(sanitizeRoute("/dashboard")).toBe("/dashboard");
  });

  it("returns / for null/undefined", () => {
    expect(sanitizeRoute(null)).toBe("/");
    expect(sanitizeRoute(undefined)).toBe("/");
  });

  it("trims whitespace", () => {
    expect(sanitizeRoute("  /test  ")).toBe("/test");
  });
});
