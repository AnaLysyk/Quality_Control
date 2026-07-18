import "server-only";

import Papa from "papaparse";
import * as XLSX from "xlsx";

import type { BrainAccessContext } from "@/backend/brain/access";
import { prisma } from "@/database/prismaClient";
import {
  BRAIN_SOURCE_MEMORY_TYPE,
  canConfigureBrainSources,
  createBrainSource,
} from "@/backend/brain/sourceSettings";

// Limite defensivo: nao deixa um arquivo gigante virar uma BrainMemory sem tamanho.
const MAX_EXTRACTED_CHARS = 20000;

export type SupportedFileKind = "text" | "markdown" | "json" | "csv" | "spreadsheet";

const EXTENSION_KIND: Record<string, SupportedFileKind> = {
  txt: "text",
  md: "markdown",
  markdown: "markdown",
  json: "json",
  csv: "csv",
  xlsx: "spreadsheet",
  xls: "spreadsheet",
};

export function detectFileKind(fileName: string, mimeType?: string | null): SupportedFileKind | null {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (EXTENSION_KIND[extension]) return EXTENSION_KIND[extension];

  if (mimeType) {
    if (mimeType.includes("json")) return "json";
    if (mimeType.includes("csv")) return "csv";
    if (mimeType.includes("markdown")) return "markdown";
    if (mimeType.includes("sheet") || mimeType.includes("excel")) return "spreadsheet";
    if (mimeType.startsWith("text/")) return "text";
  }

  return null;
}

function truncate(text: string) {
  const trimmed = text.trim();
  if (trimmed.length <= MAX_EXTRACTED_CHARS) return { text: trimmed, truncated: false };
  return { text: `${trimmed.slice(0, MAX_EXTRACTED_CHARS)}\n...[conteudo truncado]`, truncated: true };
}

function extractCsv(buffer: Buffer): string {
  const parsed = Papa.parse<string[]>(buffer.toString("utf8"), { skipEmptyLines: true });
  const rows = parsed.data.slice(0, 500);
  return rows.map((row) => row.join(" | ")).join("\n");
}

function extractSpreadsheet(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const parts: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    parts.push(`# ${sheetName}\n${csv}`);
  }
  return parts.join("\n\n");
}

function extractJson(buffer: Buffer): string {
  try {
    const parsed = JSON.parse(buffer.toString("utf8"));
    return JSON.stringify(parsed, null, 2);
  } catch {
    return buffer.toString("utf8");
  }
}

/**
 * Extrai texto legivel de um arquivo suportado sem depender de bibliotecas novas:
 * texto/Markdown/JSON sao lidos diretamente, CSV usa papaparse e planilhas usam xlsx
 * (ambas ja eram dependencias do projeto). PDF e DOCX nao sao suportados aqui ainda.
 */
export function extractTextFromFile(fileName: string, buffer: Buffer, mimeType?: string | null) {
  const kind = detectFileKind(fileName, mimeType);
  if (!kind) return null;

  const raw =
    kind === "csv" ? extractCsv(buffer) :
    kind === "spreadsheet" ? extractSpreadsheet(buffer) :
    kind === "json" ? extractJson(buffer) :
    buffer.toString("utf8");

  return { kind, ...truncate(raw) };
}

export type ImportBrainFileInput = {
  name: string;
  fileName: string;
  buffer: Buffer;
  mimeType?: string | null;
  scopeType?: string;
  companyId?: string | null;
  projectId?: string | null;
};

export async function importBrainFileDocument(access: BrainAccessContext, input: ImportBrainFileInput) {
  if (!canConfigureBrainSources(access)) {
    throw new Error("Sem permissao para importar contexto no Brain");
  }

  const extracted = extractTextFromFile(input.fileName, input.buffer, input.mimeType);
  if (!extracted) {
    throw new Error(
      "Formato nao suportado ainda. Aceitos: .txt, .md, .json, .csv, .xlsx, .xls. PDF e DOCX ainda nao sao suportados.",
    );
  }

  const source = await createBrainSource(access, {
    name: input.name || input.fileName,
    sourceType: "file_document",
    status: "active",
    scopeType: input.scopeType ?? "user",
    companyId: input.companyId,
    projectId: input.projectId,
    useForGeneralQuestions: true,
    useForRagIngestion: true,
    fileOriginalName: input.fileName,
    fileMimeType: input.mimeType ?? null,
    fileSizeBytes: input.buffer.byteLength,
    fileExtractedChars: extracted.text.length,
    fileTruncated: extracted.truncated,
  });

  const memory = await prisma.brainMemory.create({
    data: {
      title: input.name || input.fileName,
      summary: extracted.text,
      memoryType: "CONTEXT",
      importance: 2,
      relatedNodeIds: [],
      sourceType: BRAIN_SOURCE_MEMORY_TYPE,
      sourceId: source.id,
      status: "ACTIVE",
      metadata: {
        createdFrom: "brain-file-import",
        fileName: input.fileName,
        fileKind: extracted.kind,
        truncated: extracted.truncated,
        importedBy: access.user.id,
      },
    },
  });

  return { source, memory };
}
