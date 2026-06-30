"use client";

import { useMemo, useRef, useState } from "react";
import { FiDownload, FiFilePlus, FiRefreshCw, FiUploadCloud } from "react-icons/fi";

type TargetFormat = "txt" | "md" | "json" | "pdf" | "csv" | "xlsx" | "base64";

type ConvertedFile = {
  filename: string;
  mimeType: string;
  contentBase64: string;
  sizeBytes: number;
};

type Props = {
  text: string;
  onUseText?: (value: string) => void;
};

function countText(value: string) {
  const charsWithSpaces = value.length;
  const charsWithoutSpaces = value.replace(/\s/g, "").length;
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;
  const lines = value ? value.split(/\r?\n/).length : 0;
  const paragraphs = value.trim() ? value.trim().split(/\n\s*\n/).filter(Boolean).length : 0;
  const approxTokens = Math.ceil(charsWithSpaces / 4);
  return { charsWithSpaces, charsWithoutSpaces, words, lines, paragraphs, approxTokens };
}

function dataUrlToBase64(dataUrl: string) {
  return dataUrl.includes(",") ? dataUrl.split(",").pop() ?? "" : dataUrl;
}

function downloadConverted(file: ConvertedFile) {
  const byteCharacters = atob(file.contentBase64);
  const byteNumbers = Array.from(byteCharacters, (char) => char.charCodeAt(0));
  const blob = new Blob([new Uint8Array(byteNumbers)], { type: file.mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function BrainChatUtilities({ text, onUseText }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const metrics = useMemo(() => countText(text), [text]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [targetFormat, setTargetFormat] = useState<TargetFormat>("pdf");
  const [converted, setConverted] = useState<ConvertedFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConvert() {
    if (!selectedFile && !text.trim()) {
      setError("Anexe um arquivo ou digite um texto para converter.");
      return;
    }

    setBusy(true);
    setError(null);
    setConverted(null);

    try {
      let payload: Record<string, unknown> = { targetFormat };

      if (selectedFile) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result ?? ""));
          reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
          reader.readAsDataURL(selectedFile);
        });
        payload = {
          ...payload,
          filename: selectedFile.name,
          mimeType: selectedFile.type || "application/octet-stream",
          contentBase64: dataUrlToBase64(dataUrl),
        };
      } else {
        payload = {
          ...payload,
          filename: "brain-text.txt",
          mimeType: "text/plain",
          text,
        };
      }

      const response = await fetch("/api/brain/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok || !body?.success) {
        throw new Error(body?.message || "Falha ao converter arquivo.");
      }
      setConverted(body as ConvertedFile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao converter arquivo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-testid="brain-chat-utilities" className="border-t border-(--border-clr) px-3.5 py-2 text-[11px] text-(--muted-clr)">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-(--border-clr) px-2 py-1">{metrics.charsWithSpaces} caracteres</span>
        <span className="rounded-full border border-(--border-clr) px-2 py-1">{metrics.charsWithoutSpaces} sem espaços</span>
        <span className="rounded-full border border-(--border-clr) px-2 py-1">{metrics.words} palavras</span>
        <span className="rounded-full border border-(--border-clr) px-2 py-1">{metrics.lines} linhas</span>
        <span className="rounded-full border border-(--border-clr) px-2 py-1">~{metrics.approxTokens} tokens</span>
        {metrics.charsWithSpaces > 4000 ? (
          <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-1 text-amber-300">texto longo</span>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(event) => {
            setSelectedFile(event.target.files?.[0] ?? null);
            setConverted(null);
            setError(null);
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-(--border-clr) px-2.5 py-1.5 font-semibold text-(--prompt-clr)"
        >
          <FiUploadCloud className="h-3.5 w-3.5" />
          Anexar
        </button>
        {selectedFile ? (
          <span className="max-w-56 truncate rounded-xl border border-(--border-clr) px-2.5 py-1.5">
            {selectedFile.name} · {(selectedFile.size / 1024).toFixed(1)} KB
          </span>
        ) : null}
        <select
          value={targetFormat}
          onChange={(event) => setTargetFormat(event.target.value as TargetFormat)}
          className="rounded-xl border border-(--border-clr) bg-(--input-bg) px-2.5 py-1.5 text-(--text-clr) outline-none"
        >
          <option value="pdf">PDF</option>
          <option value="txt">TXT</option>
          <option value="md">Markdown</option>
          <option value="json">JSON formatado</option>
          <option value="csv">CSV</option>
          <option value="xlsx">XLSX</option>
          <option value="base64">Base64</option>
        </select>
        <button
          type="button"
          onClick={handleConvert}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-xl bg-(--agent-color) px-3 py-1.5 font-semibold text-white disabled:opacity-60"
        >
          {busy ? <FiRefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FiFilePlus className="h-3.5 w-3.5" />}
          Converter
        </button>
        {converted ? (
          <button
            type="button"
            onClick={() => downloadConverted(converted)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-3 py-1.5 font-semibold text-emerald-300"
          >
            <FiDownload className="h-3.5 w-3.5" />
            Baixar {converted.filename}
          </button>
        ) : null}
        {onUseText && converted?.mimeType.startsWith("text/") ? (
          <button
            type="button"
            onClick={() => onUseText(atob(converted.contentBase64))}
            className="rounded-xl border border-(--border-clr) px-3 py-1.5 font-semibold text-(--prompt-clr)"
          >
            Usar no chat
          </button>
        ) : null}
      </div>
      {error ? <div className="mt-2 rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-red-300">{error}</div> : null}
    </div>
  );
}
