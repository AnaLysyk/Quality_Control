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

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
/*  stripAccents                                    */
/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

describe("stripAccents", () => {
  it("removes accents from Portuguese text", () => {
    expect(stripAccents("descriÃ§Ã£o")).toBe("descricao");
    expect(stripAccents("tÃ­tulo")).toBe("titulo");
    expect(stripAccents("prÃ³ximo")).toBe("proximo");
  });

  it("leaves ASCII text unchanged", () => {
    expect(stripAccents("hello")).toBe("hello");
  });
});

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
/*  normalizeSearch                                 */
/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

describe("normalizeSearch", () => {
  it("lowercases and strips accents", () => {
    expect(normalizeSearch("Criar Chamado")).toBe("criar chamado");
  });

  it("strips accents", () => {
    expect(normalizeSearch("AÃ§Ã£o disponÃ­vel")).toBe("acao disponivel");
  });

  it("trims whitespace", () => {
    expect(normalizeSearch("  oi  ")).toBe("oi");
  });
});

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
/*  normalizeText                                   */
/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

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

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
/*  normalizePromptText                             */
/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

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

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
/*  compactMultiline                                */
/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

describe("compactMultiline", () => {
  it("trims trailing spaces on each line", () => {
    expect(compactMultiline("hello   \nworld   ")).toBe("hello\nworld");
  });

  it("trims leading/trailing blank lines", () => {
    expect(compactMultiline("\n\nhello\n\n")).toBe("hello");
  });
});

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
/*  formatDateTime                                  */
/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

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

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
/*  normalizeCommentForComparison                   */
/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

describe("normalizeCommentForComparison", () => {
  it("removes accents, punctuation and extra spaces", () => {
    expect(normalizeCommentForComparison("OlÃ¡, tudo bem?")).toBe("ola tudo bem");
  });

  it("lowercases text", () => {
    expect(normalizeCommentForComparison("HELLO")).toBe("hello");
  });
});

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
/*  formatValidationIssues                          */
/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

describe("formatValidationIssues", () => {
  it("numbers issues starting from 1", () => {
    const result = formatValidationIssues(["A", "B"]);
    expect(result).toBe("1. A\n2. B");
  });

  it("returns empty string for empty array", () => {
    expect(formatValidationIssues([])).toBe("");
  });
});

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
/*  sanitizeRoute                                   */
/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

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

