"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { FiCopy, FiDownload, FiFile, FiPaperclip, FiRefreshCw, FiTool, FiUploadCloud } from "react-icons/fi";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const TARGET_FORMATS = [
  { value: "txt", label: "TXT" },
  { value: "md", label: "Markdown" },
  { value: "json", label: "JSON formatado" },
  { value: "html", label: "HTML simples" },
  { value: "pdf", label: "PDF" },
  { value: "xlsx", label: "XLSX" },
  { value: "csv", label: "CSV" },
  { value: "base64", label: "Base64" },
] as const;

type TargetFormat = (typeof TARGET_FORMATS)[number]["value"];

type ConversionResult = {
  fileName: string;
  mimeType: string;
  url: string;
  sizeLabel: string;
  generatedAt: string;
};

type AuditEntry = {
  id: string;
  label: string;
  createdAt: string;
};

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function normalizeFileBaseName(name: string) {
  return name
    .replace(/\.[^.]+$/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "brain-arquivo";
}

function mimeForFormat(format: TargetFormat) {
  if (format === "pdf") return "application/pdf";
  if (format === "xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (format === "csv") return "text/csv;charset=utf-8";
  if (format === "json") return "application/json;charset=utf-8";
  if (format === "html") return "text/html;charset=utf-8";
  if (format === "md") return "text/markdown;charset=utf-8";
  return "text/plain;charset=utf-8";
}

function extensionForFormat(format: TargetFormat) {
  return format === "base64" ? "txt" : format;
}

function getSourceLabel(file: File | null, text: string) {
  if (file) return `${file.name} (${file.type || "tipo não informado"})`;
  if (text.trim()) return "Texto digitado no Brain";
  return "Nenhuma origem selecionada";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function readFileAsText(file: File) {
  return await file.text();
}

async function readFileAsArrayBuffer(file: File) {
  return await file.arrayBuffer();
}

async function readFileAsDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

function textToBase64(value: string) {
  return btoa(unescape(encodeURIComponent(value)));
}

async function createPdfBlob(sourceText: string, file: File | null) {
  const brainModule = (await import("jspdf")) as unknown as { default?: new () => any; jsPDF?: new () => any };
  const JsPDF = brainModule.default ?? brainModule.jsPDF;
  if (!JsPDF) throw new Error("Biblioteca PDF indisponível no navegador.");

  const doc = new JsPDF();
  doc.setFontSize(14);
  doc.text("Brain — arquivo convertido", 12, 16);
  doc.setFontSize(10);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, 12, 24);

  if (file && file.type.startsWith("image/")) {
    const dataUrl = await readFileAsDataUrl(file);
    doc.addImage(dataUrl, file.type.includes("png") ? "PNG" : "JPEG", 12, 34, 180, 120, undefined, "FAST");
  } else {
    const lines = doc.splitTextToSize(sourceText || "Sem conteúdo textual informado.", 180);
    doc.text(lines, 12, 36);
  }

  return doc.output("blob") as Blob;
}

async function createXlsxBlob(file: File | null, sourceText: string) {
  const xlsx = await import("xlsx");
  const workbook = file
    ? xlsx.read(await readFileAsArrayBuffer(file), { type: "array" })
    : xlsx.utils.book_new();

  if (!file) {
    const rows = sourceText
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => [line]);
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.aoa_to_sheet(rows.length ? rows : [["Sem conteúdo"]]), "Brain");
  }

  const array = xlsx.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  return new Blob([array], { type: mimeForFormat("xlsx") });
}

async function createCsvBlob(file: File | null, sourceText: string) {
  if (file && file.name.toLowerCase().endsWith(".xlsx")) {
    const xlsx = await import("xlsx");
    const workbook = xlsx.read(await readFileAsArrayBuffer(file), { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const csv = sheetName ? xlsx.utils.sheet_to_csv(workbook.Sheets[sheetName]) : "";
    return new Blob([csv], { type: mimeForFormat("csv") });
  }

  return new Blob([sourceText], { type: mimeForFormat("csv") });
}

function buildTextOutput(format: TargetFormat, sourceText: string, file: File | null) {
  const normalizedText = sourceText || (file ? `Arquivo anexado: ${file.name}` : "");

  if (format === "json") {
    try {
      return JSON.stringify(JSON.parse(normalizedText), null, 2);
    } catch {
      return JSON.stringify(
        {
          source: getSourceLabel(file, sourceText),
          content: normalizedText,
          generatedAt: new Date().toISOString(),
        },
        null,
        2,
      );
    }
  }

  if (format === "html") {
    return `<!doctype html>\n<html lang="pt-BR">\n<head><meta charset="utf-8"><title>Brain</title></head>\n<body><pre>${escapeHtml(normalizedText)}</pre></body>\n</html>`;
  }

  if (format === "md") {
    return `# Conteúdo convertido pelo Brain\n\n${normalizedText}`;
  }

  if (format === "base64") {
    return file ? "" : textToBase64(normalizedText);
  }

  return normalizedText;
}

async function convertFile(options: { file: File | null; text: string; targetFormat: TargetFormat }) {
  const { file, text, targetFormat } = options;
  const sourceText = file && !file.type.startsWith("image/") ? await readFileAsText(file).catch(() => text) : text;
  const baseName = normalizeFileBaseName(file?.name ?? "brain-conversao");
  let blob: Blob;

  if (targetFormat === "pdf") {
    blob = await createPdfBlob(sourceText, file);
  } else if (targetFormat === "xlsx") {
    blob = await createXlsxBlob(file, sourceText);
  } else if (targetFormat === "csv") {
    blob = await createCsvBlob(file, sourceText);
  } else if (targetFormat === "base64" && file) {
    const dataUrl = await readFileAsDataUrl(file);
    blob = new Blob([dataUrl.split(",")[1] ?? dataUrl], { type: mimeForFormat("base64") });
  } else {
    blob = new Blob([buildTextOutput(targetFormat, sourceText, file)], { type: mimeForFormat(targetFormat) });
  }

  return {
    fileName: `${baseName}.${extensionForFormat(targetFormat)}`,
    mimeType: blob.type || mimeForFormat(targetFormat),
    url: URL.createObjectURL(blob),
    sizeLabel: formatFileSize(blob.size),
    generatedAt: new Date().toISOString(),
  } satisfies ConversionResult;
}

export function BrainUtilitiesPanel() {
  const [text, setText] = useState("");
  const [limit, setLimit] = useState(4000);
  const [file, setFile] = useState<File | null>(null);
  const [targetFormat, setTargetFormat] = useState<TargetFormat>("pdf");
  const [convertedFile, setConvertedFile] = useState<ConversionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [audit, setAudit] = useState<AuditEntry[]>([]);

  const metrics = useMemo(() => {
    const trimmed = text.trim();
    const words = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
    const lines = text.length ? text.split(/\r\n|\r|\n/).length : 0;
    const paragraphs = trimmed ? trimmed.split(/\n\s*\n/).filter((item) => item.trim()).length : 0;
    return {
      charsWithSpaces: text.length,
      charsWithoutSpaces: text.replace(/\s/g, "").length,
      words,
      lines,
      paragraphs,
      estimatedTokens: Math.max(0, Math.ceil(text.length / 4)),
      overLimit: limit > 0 && text.length > limit,
    };
  }, [limit, text]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setConvertedFile(null);
    setError(null);

    if (!selected) {
      setFile(null);
      return;
    }

    if (selected.size > MAX_FILE_SIZE_BYTES) {
      setFile(null);
      setError(`Arquivo acima do limite de ${formatFileSize(MAX_FILE_SIZE_BYTES)}.`);
      event.target.value = "";
      return;
    }

    setFile(selected);
  }

  async function handleConvert() {
    if (!file && !text.trim()) {
      setError("Informe um texto ou anexe um arquivo para converter.");
      return;
    }

    setBusy(true);
    setError(null);
    setConvertedFile(null);

    try {
      const result = await convertFile({ file, text, targetFormat });
      setConvertedFile(result);
      setAudit((current) => [
        {
          id: makeId("audit"),
          label: `${getSourceLabel(file, text)} → ${targetFormat.toUpperCase()} (${result.sizeLabel})`,
          createdAt: result.generatedAt,
        },
        ...current,
      ].slice(0, 5));
    } catch (conversionError) {
      setError(conversionError instanceof Error ? conversionError.message : "Formato não suportado para conversão.");
    } finally {
      setBusy(false);
    }
  }

  async function copyMetrics() {
    const summary = [
      `Caracteres com espaço: ${metrics.charsWithSpaces}`,
      `Caracteres sem espaço: ${metrics.charsWithoutSpaces}`,
      `Palavras: ${metrics.words}`,
      `Linhas: ${metrics.lines}`,
      `Parágrafos: ${metrics.paragraphs}`,
      `Tokens aproximados: ${metrics.estimatedTokens}`,
    ].join("\n");
    await navigator.clipboard.writeText(summary);
  }

  return (
    <section className="rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#fff) p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">
            <FiTool className="h-4 w-4" /> Brain utilitário
          </span>
          <h2 className="mt-3 text-xl font-extrabold text-(--tc-text,#0b1a3c)">Contador e conversor no fluxo do Brain</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-(--tc-text-secondary,#4b5563)">
            Cole texto, anexe evidência e gere arquivo de saída sem sair do contexto do Brain. Conversões locais respeitam limite de tamanho, erro claro e trilha de auditoria visual.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setText("");
            setFile(null);
            setConvertedFile(null);
            setError(null);
          }}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-(--tc-border,#d7deea) px-4 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)"
        >
          <FiRefreshCw className="h-4 w-4" /> Limpar
        </button>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <div className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="text-sm font-bold text-(--tc-text,#0b1a3c)">Texto do Brain / ticket / nota executiva</label>
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-(--tc-text-muted,#6b7280)">
              Limite
              <input
                type="number"
                min={0}
                value={limit}
                onChange={(event) => setLimit(Number(event.target.value || 0))}
                className="h-8 w-24 rounded-lg border border-(--tc-border,#d7deea) bg-white px-2 text-sm outline-none"
              />
            </label>
          </div>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Cole aqui o texto que você quer medir, transformar em PDF, Markdown, JSON ou Base64."
            className="mt-2 min-h-52 w-full resize-y rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-3 text-sm leading-6 outline-none"
          />

          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Com espaço", metrics.charsWithSpaces],
              ["Sem espaço", metrics.charsWithoutSpaces],
              ["Palavras", metrics.words],
              ["Linhas", metrics.lines],
              ["Parágrafos", metrics.paragraphs],
              ["Tokens aprox.", metrics.estimatedTokens],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-(--tc-border,#d7deea) bg-white px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-(--tc-text-muted,#6b7280)">{label}</p>
                <p className="mt-1 text-lg font-extrabold text-(--tc-text,#0b1a3c)">{value}</p>
              </div>
            ))}
          </div>

          {metrics.overLimit ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
              Texto acima do limite configurado em {metrics.charsWithSpaces - limit} caracteres.
            </div>
          ) : null}

          <button
            type="button"
            onClick={copyMetrics}
            className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-(--tc-border,#d7deea) bg-white px-4 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)"
          >
            <FiCopy className="h-4 w-4" /> Copiar contagem
          </button>
        </div>

        <div className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-3">
          <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-(--tc-border,#d7deea) bg-white px-4 py-5 text-center">
            <FiUploadCloud className="h-8 w-8 text-(--tc-accent,#ef0001)" />
            <span className="mt-2 text-sm font-bold text-(--tc-text,#0b1a3c)">Anexar arquivo para o Brain converter</span>
            <span className="mt-1 text-xs text-(--tc-text-muted,#6b7280)">TXT, MD, JSON, CSV, XLSX e imagens até {formatFileSize(MAX_FILE_SIZE_BYTES)}</span>
            <input type="file" className="sr-only" onChange={handleFileChange} />
          </label>

          <div className="mt-3 rounded-xl border border-(--tc-border,#d7deea) bg-white px-3 py-2 text-sm text-(--tc-text,#0b1a3c)">
            <div className="flex items-start gap-2">
              <FiPaperclip className="mt-0.5 h-4 w-4 shrink-0 text-(--tc-text-muted,#6b7280)" />
              <div className="min-w-0">
                <p className="truncate font-bold">{getSourceLabel(file, text)}</p>
                <p className="text-xs text-(--tc-text-muted,#6b7280)">{file ? formatFileSize(file.size) : "Use texto digitado quando não houver anexo."}</p>
              </div>
            </div>
          </div>

          <label className="mt-3 grid gap-2 text-sm font-bold text-(--tc-text,#0b1a3c)">
            Formato de saída
            <select
              value={targetFormat}
              onChange={(event) => setTargetFormat(event.target.value as TargetFormat)}
              className="min-h-11 rounded-xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm outline-none"
            >
              {TARGET_FORMATS.map((format) => (
                <option key={format.value} value={format.value}>{format.label}</option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={handleConvert}
            disabled={busy}
            className="mt-3 inline-flex w-full min-h-11 items-center justify-center gap-2 rounded-xl bg-(--tc-primary,#011848) px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            <FiFile className="h-4 w-4" /> {busy ? "Convertendo..." : "Converter no Brain"}
          </button>

          {error ? (
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</div>
          ) : null}

          {convertedFile ? (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
              <p className="font-extrabold">Arquivo convertido pronto</p>
              <p className="mt-1 text-xs">{convertedFile.fileName} • {convertedFile.mimeType} • {convertedFile.sizeLabel}</p>
              <a
                href={convertedFile.url}
                download={convertedFile.fileName}
                className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white"
              >
                <FiDownload className="h-4 w-4" /> Baixar arquivo convertido
              </a>
            </div>
          ) : null}

          {audit.length > 0 ? (
            <div className="mt-3 rounded-xl border border-(--tc-border,#d7deea) bg-white px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">Auditoria local</p>
              <ul className="mt-2 space-y-1 text-xs text-(--tc-text-secondary,#4b5563)">
                {audit.map((item) => (
                  <li key={item.id}>• {item.label}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
