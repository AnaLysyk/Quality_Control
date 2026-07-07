import { NextRequest, NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import * as XLSX from "xlsx";
import { requirePermission } from "@/lib/rbac/requirePermission";

export const runtime = "nodejs";

type ConvertTarget = "txt" | "md" | "json" | "pdf" | "csv" | "xlsx" | "base64";

type ConvertPayload = {
  filename?: string;
  mimeType?: string;
  contentBase64?: string;
  text?: string;
  targetFormat?: ConvertTarget;
};

const MAX_BYTES = 4 * 1024 * 1024;

function jsonError(message: string, status = 400) {
  return NextResponse.json({ success: false, message }, { status });
}

function safeName(name: string) {
  return name.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim() || "brain-file";
}

function extensionOf(filename: string) {
  const parts = filename.toLowerCase().split(".");
  return parts.length > 1 ? parts.at(-1) ?? "" : "";
}

function responseFile(filename: string, mimeType: string, buffer: Buffer) {
  return NextResponse.json({
    success: true,
    filename,
    mimeType,
    sizeBytes: buffer.length,
    contentBase64: buffer.toString("base64"),
  });
}

function textBuffer(input: string) {
  return Buffer.from(input, "utf8");
}

function decodePayload(payload: ConvertPayload) {
  if (payload.contentBase64) {
    const buffer = Buffer.from(payload.contentBase64, "base64");
    if (buffer.length > MAX_BYTES) throw new Error("Arquivo acima do limite permitido para conversão no Brain.");
    return buffer;
  }

  const buffer = Buffer.from(payload.text ?? "", "utf8");
  if (buffer.length > MAX_BYTES) throw new Error("Conteúdo acima do limite permitido para conversão no Brain.");
  return buffer;
}

function bufferToText(buffer: Buffer) {
  return buffer.toString("utf8");
}

function textToPdfBuffer(text: string, title: string) {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 40;
  const width = pdf.internal.pageSize.getWidth() - margin * 2;
  const lines = pdf.splitTextToSize(text || title, width);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text(title, margin, margin);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);

  let y = margin + 24;
  for (const line of lines) {
    if (y > pdf.internal.pageSize.getHeight() - margin) {
      pdf.addPage();
      y = margin;
    }
    pdf.text(line, margin, y);
    y += 14;
  }

  return Buffer.from(pdf.output("arraybuffer"));
}

function jsonToCsv(value: unknown) {
  const items = Array.isArray(value) ? value : [value];
  const keys = Array.from(
    new Set(items.flatMap((item) => (item && typeof item === "object" && !Array.isArray(item) ? Object.keys(item) : ["value"]))),
  );
  const escape = (input: unknown) => {
    const raw = typeof input === "string" ? input : JSON.stringify(input ?? "");
    return /[",\n;]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
  };
  return [keys.join(","), ...items.map((item) => keys.map((key) => escape((item as Record<string, unknown>)?.[key] ?? item)).join(","))].join("\n");
}

export async function POST(request: NextRequest) {
  const guard = await requirePermission(request, "brain", "use");
  if (!guard.ok) return guard.response;

  let payload: ConvertPayload;

  try {
    payload = (await request.json()) as ConvertPayload;
  } catch {
    return jsonError("Payload inválido para conversão.");
  }

  const target = payload.targetFormat;
  if (!target) return jsonError("Informe o formato de saída.");

  const originalName = safeName(payload.filename || "brain-file.txt");
  const baseName = originalName.replace(/\.[^.]+$/, "") || "brain-file";
  const ext = extensionOf(originalName);

  let buffer: Buffer;
  try {
    buffer = decodePayload(payload);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Arquivo inválido.");
  }

  try {
    if (target === "base64") {
      return responseFile(`${baseName}.base64.txt`, "text/plain; charset=utf-8", textBuffer(buffer.toString("base64")));
    }

    if (target === "txt") {
      return responseFile(`${baseName}.txt`, "text/plain; charset=utf-8", textBuffer(bufferToText(buffer)));
    }

    if (target === "md") {
      return responseFile(`${baseName}.md`, "text/markdown; charset=utf-8", textBuffer(bufferToText(buffer)));
    }

    if (target === "json") {
      const text = bufferToText(buffer).trim();
      const parsed = JSON.parse(text);
      return responseFile(`${baseName}.json`, "application/json; charset=utf-8", textBuffer(JSON.stringify(parsed, null, 2)));
    }

    if (target === "csv") {
      if (ext === "xlsx") {
        const workbook = XLSX.read(buffer, { type: "buffer" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        return responseFile(`${baseName}.csv`, "text/csv; charset=utf-8", textBuffer(XLSX.utils.sheet_to_csv(sheet)));
      }
      const text = bufferToText(buffer).trim();
      const parsed = JSON.parse(text);
      return responseFile(`${baseName}.csv`, "text/csv; charset=utf-8", textBuffer(jsonToCsv(parsed)));
    }

    if (target === "xlsx") {
      const text = bufferToText(buffer).trim();
      const rows = ext === "json" ? JSON.parse(text) : XLSX.utils.sheet_to_json(XLSX.utils.aoa_to_sheet(text.split(/\r?\n/).map((line) => line.split(","))), { header: 1 });
      const worksheet = Array.isArray(rows) && rows.every((row) => Array.isArray(row))
        ? XLSX.utils.aoa_to_sheet(rows as unknown[][])
        : XLSX.utils.json_to_sheet(Array.isArray(rows) ? rows : [rows]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Brain");
      const output = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
      return responseFile(`${baseName}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", output);
    }

    if (target === "pdf") {
      return responseFile(`${baseName}.pdf`, "application/pdf", textToPdfBuffer(bufferToText(buffer), baseName));
    }

    return jsonError("Formato de saída não suportado.");
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Não foi possível converter o arquivo.");
  }
}
