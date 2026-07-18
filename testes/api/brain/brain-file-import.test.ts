jest.mock("@/database/prismaClient", () => ({
  prisma: {
    brainMemory: { create: jest.fn() },
  },
}));

jest.mock("@/lib/brain/sourceSettings", () => ({
  BRAIN_SOURCE_MEMORY_TYPE: "BRAIN_SOURCE",
  canConfigureBrainSources: jest.fn(),
  createBrainSource: jest.fn(),
  isBrainSourceStorageUnavailable: jest.fn().mockReturnValue(false),
}));

import { detectFileKind, extractTextFromFile, importBrainFileDocument } from "@/lib/brain/fileImport";
import { canConfigureBrainSources, createBrainSource } from "@/lib/brain/sourceSettings";
import { prisma } from "@/database/prismaClient";
import type { BrainAccessContext } from "@/lib/brain/access";

function fakeAccess(): BrainAccessContext {
  return { user: { id: "user-1", email: "user@example.com", isGlobalAdmin: false } } as unknown as BrainAccessContext;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("detectFileKind", () => {
  it("detecta pela extensao do nome do arquivo", () => {
    expect(detectFileKind("notas.txt")).toBe("text");
    expect(detectFileKind("regras.md")).toBe("markdown");
    expect(detectFileKind("dados.json")).toBe("json");
    expect(detectFileKind("planilha.csv")).toBe("csv");
    expect(detectFileKind("relatorio.xlsx")).toBe("spreadsheet");
    expect(detectFileKind("legado.xls")).toBe("spreadsheet");
  });

  it("cai para o mimeType quando a extensao e desconhecida", () => {
    expect(detectFileKind("arquivo-sem-extensao", "application/json")).toBe("json");
    expect(detectFileKind("arquivo-sem-extensao", "text/plain")).toBe("text");
  });

  it("retorna null para formatos nao suportados (ex.: pdf, docx)", () => {
    expect(detectFileKind("manual.pdf", "application/pdf")).toBeNull();
    expect(detectFileKind("contrato.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBeNull();
  });
});

describe("extractTextFromFile", () => {
  it("extrai texto simples de .txt/.md", () => {
    const result = extractTextFromFile("nota.md", Buffer.from("# Regra\nSempre validar por empresa."));
    expect(result?.kind).toBe("markdown");
    expect(result?.text).toContain("Sempre validar por empresa.");
    expect(result?.truncated).toBe(false);
  });

  it("re-serializa JSON de forma legivel", () => {
    const result = extractTextFromFile("dados.json", Buffer.from(JSON.stringify({ a: 1 })));
    expect(result?.kind).toBe("json");
    expect(result?.text).toContain('"a": 1');
  });

  it("extrai linhas de um CSV", () => {
    const result = extractTextFromFile("dados.csv", Buffer.from("nome,status\nSMART,ativo"));
    expect(result?.kind).toBe("csv");
    expect(result?.text).toContain("nome | status");
    expect(result?.text).toContain("SMART | ativo");
  });

  it("retorna null para formato nao suportado", () => {
    expect(extractTextFromFile("manual.pdf", Buffer.from("%PDF-1.4"))).toBeNull();
  });

  it("trunca conteudo muito grande e marca truncated", () => {
    const big = "a".repeat(30000);
    const result = extractTextFromFile("grande.txt", Buffer.from(big));
    expect(result?.truncated).toBe(true);
    expect(result?.text.length).toBeLessThan(big.length);
  });
});

describe("importBrainFileDocument", () => {
  it("nega sem permissao de configurar fontes", async () => {
    (canConfigureBrainSources as jest.Mock).mockReturnValue(false);

    await expect(
      importBrainFileDocument(fakeAccess(), { name: "Regras", fileName: "regras.md", buffer: Buffer.from("conteudo") }),
    ).rejects.toThrow(/permissao/i);
    expect(createBrainSource).not.toHaveBeenCalled();
  });

  it("rejeita formato nao suportado com mensagem clara", async () => {
    (canConfigureBrainSources as jest.Mock).mockReturnValue(true);

    await expect(
      importBrainFileDocument(fakeAccess(), { name: "Manual", fileName: "manual.pdf", buffer: Buffer.from("%PDF") }),
    ).rejects.toThrow(/nao suportado/i);
  });

  it("cria a fonte file_document e a memoria vinculada com o texto extraido", async () => {
    (canConfigureBrainSources as jest.Mock).mockReturnValue(true);
    (createBrainSource as jest.Mock).mockResolvedValue({ id: "source-1", name: "Regras SMART" });
    (prisma.brainMemory.create as jest.Mock).mockResolvedValue({ id: "memory-1" });

    const result = await importBrainFileDocument(fakeAccess(), {
      name: "Regras SMART",
      fileName: "regras.md",
      buffer: Buffer.from("O limite de reanalise deve seguir o SMART."),
      mimeType: "text/markdown",
    });

    expect(createBrainSource).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ sourceType: "file_document", fileOriginalName: "regras.md" }),
    );
    expect(prisma.brainMemory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sourceType: "BRAIN_SOURCE",
          sourceId: "source-1",
          summary: expect.stringContaining("O limite de reanalise"),
        }),
      }),
    );
    expect(result).toEqual({ source: { id: "source-1", name: "Regras SMART" }, memory: { id: "memory-1" } });
  });
});
