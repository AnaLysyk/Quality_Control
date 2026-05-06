"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  FiCheck,
  FiChevronDown,
  FiChevronRight,
  FiCopy,
  FiFile,
  FiFileText,
  FiFilm,
  FiFolder,
  FiImage,
  FiLoader,
  FiSave,
  FiRefreshCw,
  FiTrash2,
  FiUploadCloud,
  FiX,
} from "react-icons/fi";

import { useAutomationModuleContext } from "../_components/AutomationModuleContext";

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type AssetKind = "image" | "video" | "document" | "other";

type LibraryAsset = {
  id: string;
  name: string;
  kind: string;
  size_bytes: number;
  url: string;
  created_at: string;
};

type ConversionResult = {
  name: string;
  kind: AssetKind;
  sizeBytes: number;
  base64: string;       // full data URL: data:image/png;base64,...
  previewUrl: string;   // blob URL or data URL for img preview
  source: "upload" | "library";
  sourceAssetId?: string;
};

type HistoryEntry = {
  id: string;
  name: string;
  kind: string;
  size_bytes: number;
  source: string;
  source_asset_id: string | null;
  created_at: string;
  // Loaded on demand:
  base64_data?: string;
};

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function detectKind(name: string): AssetKind {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "avif"].includes(ext)) return "image";
  if (["mp4", "webm", "mov", "avi"].includes(ext)) return "video";
  if (["pdf", "doc", "docx", "xls", "xlsx", "csv", "txt", "md"].includes(ext)) return "document";
  return "other";
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function KindIcon({ kind, className }: { kind: string; className?: string }) {
  const cls = className ?? "h-5 w-5";
  if (kind === "image") return <FiImage className={`${cls} text-blue-400`} />;
  if (kind === "video") return <FiFilm className={`${cls} text-purple-400`} />;
  if (kind === "document") return <FiFileText className={`${cls} text-emerald-400`} />;
  return <FiFile className={`${cls} text-zinc-400`} />;
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function urlToDataURL(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// â”€â”€ TruncatedCode: expandable base64 block â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function TruncatedCode({ code, copiedId, id, onCopy }: {
  code: string;
  id: string;
  copiedId: string | null;
  onCopy: (id: string, code: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const displayCode = expanded ? code : `${code.slice(0, 120)}â€¦`;

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Base64 · {formatBytes(Math.round(code.length * 0.75))}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {expanded ? "Recolher" : "Expandir"}
          </button>
          <button
            type="button"
            aria-label="Copiar código base64"
            onClick={() => onCopy(id, code)}
            className="flex h-6 w-6 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
          >
            {copiedId === id ? <FiCheck className="h-3.5 w-3.5 text-emerald-400" /> : <FiCopy className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
      <pre className={`overflow-x-auto px-3 py-2.5 font-mono text-[10px] leading-5 text-zinc-300 whitespace-pre-wrap break-all ${expanded ? "max-h-64" : "max-h-16"} overflow-y-auto transition-all`}>
        {displayCode}
      </pre>
    </div>
  );
}

// â”€â”€ HistoryRow â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function HistoryRow({
  entry,
  companySlug,
  copiedId,
  onCopy,
  onDelete,
}: {
  entry: HistoryEntry;
  companySlug: string;
  copiedId: string | null;
  onCopy: (id: string, code: string) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [loadingCode, setLoadingCode] = useState(false);
  const [fullEntry, setFullEntry] = useState<HistoryEntry | null>(null);

  const handleExpand = async () => {
    if (!expanded && !fullEntry && !entry.base64_data) {
      setLoadingCode(true);
      try {
        const res = await fetch(`/api/automations/base64?companySlug=${encodeURIComponent(companySlug)}&id=${entry.id}`);
        const data = (await res.json()) as { entry?: HistoryEntry };
        if (data.entry) setFullEntry(data.entry);
      } finally {
        setLoadingCode(false);
      }
    }
    setExpanded((v) => !v);
  };

  const code = fullEntry?.base64_data ?? entry.base64_data ?? "";
  const isImage = entry.kind === "image";

  return (
    <div className="border-b border-zinc-800 last:border-0">
      <div
        onClick={() => void handleExpand()}
        className="group flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-800/50"
      >
        {expanded ? (
          <FiChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
        ) : (
          <FiChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
        )}
        <KindIcon kind={entry.kind} className="h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-semibold text-zinc-200">{entry.name}</p>
          <p className="text-[10px] text-zinc-500">
            {formatBytes(entry.size_bytes)} ? {formatDate(entry.created_at)} ? {entry.source === "library" ? "Biblioteca" : "Upload"}
          </p>
        </div>
        <button
          type="button"
          aria-label={`Excluir ${entry.name} do hist?rico`}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(entry.id);
          }}
          className="shrink-0 flex h-6 w-6 items-center justify-center rounded-lg text-zinc-600 hover:bg-rose-900/40 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all"
        >
          <FiTrash2 className="h-3 w-3" />
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {loadingCode ? (
            <div className="flex items-center gap-2 text-[11px] text-zinc-500">
              <FiLoader className="h-3.5 w-3.5 animate-spin" />
              Carregando c?digo...
            </div>
          ) : code ? (
            <>
              {isImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={code}
                  alt={entry.name}
                  className="max-h-32 rounded-lg object-contain border border-zinc-700"
                />
              )}
              <TruncatedCode code={code} id={entry.id} copiedId={copiedId} onCopy={onCopy} />
            </>
          ) : (
            <p className="text-[11px] text-zinc-500">C?digo n?o dispon?vel.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function Base64Studio() {
  const { activeClient } = useAutomationModuleContext();
  const companySlug = activeClient?.slug ?? "";
  const companyLabel = activeClient?.name ?? "Selecione uma empresa";

  // Source tab
  const [tab, setTab] = useState<"upload" | "library">("upload");

  // Library
  const [libraryAssets, setLibraryAssets] = useState<LibraryAsset[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [librarySearch, setLibrarySearch] = useState("");

  // Conversion state
  const [converting, setConverting] = useState(false);
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [savingCurrent, setSavingCurrent] = useState(false);

  // History
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Copy
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Drag-drop
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Output textarea ref (for auto-select on copy)
  const outputRef = useRef<HTMLTextAreaElement>(null);

  // â”€â”€ Load library assets â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const loadLibrary = useCallback(() => {
    if (!companySlug) {
      setLibraryAssets([]);
      setLibraryLoading(false);
      return;
    }
    setLibraryLoading(true);
    fetch(`/api/automations/assets?companySlug=${encodeURIComponent(companySlug)}`)
      .then((r) => r.json())
      .then((data: { assets?: LibraryAsset[] }) => {
        setLibraryAssets(Array.isArray(data.assets) ? data.assets : []);
      })
      .catch(() => setLibraryAssets([]))
      .finally(() => setLibraryLoading(false));
  }, [companySlug]);

  // â”€â”€ Load history â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const loadHistory = useCallback(() => {
    if (!companySlug) {
      setHistory([]);
      setHistoryLoading(false);
      return;
    }
    setHistoryLoading(true);
    fetch(`/api/automations/base64?companySlug=${encodeURIComponent(companySlug)}`)
      .then((r) => r.json())
      .then((data: { entries?: HistoryEntry[] }) => {
        setHistory(Array.isArray(data.entries) ? data.entries : []);
      })
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  }, [companySlug]);

  useEffect(() => { loadHistory(); }, [loadHistory]);
  useEffect(() => { if (tab === "library") loadLibrary(); }, [tab, loadLibrary]);

  // -- Convert and allow manual save to history -------------------------------

  const saveToHistory = useCallback(async (conv: ConversionResult, slug: string) => {
    try {
      const res = await fetch("/api/automations/base64", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companySlug: slug,
          name: conv.name,
          kind: conv.kind,
          sizeBytes: conv.sizeBytes,
          base64Data: conv.base64,
          source: conv.source,
          sourceAssetId: conv.sourceAssetId,
        }),
      });
      const data = (await res.json()) as { entry?: { id: string; created_at: string } };
      if (data.entry?.id) {
        const newEntry: HistoryEntry = {
          id: data.entry.id,
          name: conv.name,
          kind: conv.kind,
          size_bytes: conv.sizeBytes,
          source: conv.source,
          source_asset_id: conv.sourceAssetId ?? null,
          created_at: data.entry.created_at,
        };
        setHistory((prev) => [newEntry, ...prev]);
        return newEntry;
      }
    } catch {
      // History save failure is non-blocking
    }
    return null;
  }, []);

  const convertFile = useCallback(async (file: File, source: "upload" | "library", assetId?: string) => {
    setConverting(true);
    setResult(null);
    try {
      const base64 = await readFileAsDataURL(file);
      const kind = detectKind(file.name);
      const conv: ConversionResult = {
        name: file.name,
        kind,
        sizeBytes: file.size,
        base64,
        previewUrl: kind === "image" ? base64 : "",
        source,
        sourceAssetId: assetId,
      };
      setResult(conv);
    } finally {
      setConverting(false);
    }
  }, []);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    void convertFile(files[0], "upload");
  }, [convertFile]);

  const handleLibrarySelect = useCallback(async (asset: LibraryAsset) => {
    setConverting(true);
    setResult(null);
    try {
      const base64 = await urlToDataURL(asset.url);
      const kind = detectKind(asset.name);
      const conv: ConversionResult = {
        name: asset.name,
        kind,
        sizeBytes: asset.size_bytes,
        base64,
        previewUrl: kind === "image" ? base64 : "",
        source: "library",
        sourceAssetId: asset.id,
      };
      setResult(conv);
    } catch {
      setConverting(false);
    } finally {
      setConverting(false);
    }
  }, []);

  const handleSaveCurrent = useCallback(async () => {
    if (!result || savingCurrent) return;
    if (!companySlug) return;
    setSavingCurrent(true);
    try {
      await saveToHistory(result, companySlug);
    } finally {
      setSavingCurrent(false);
    }
  }, [companySlug, result, saveToHistory, savingCurrent]);

  const handleCopy = useCallback((id: string, code: string) => {
    void navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleDeleteHistory = useCallback((id: string) => {
    setHistory((prev) => prev.filter((e) => e.id !== id));
    void fetch("/api/automations/base64", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, companySlug }),
    });
  }, [companySlug]);

  const filteredLibrary = libraryAssets.filter((a) =>
    librarySearch.trim() === "" || a.name.toLowerCase().includes(librarySearch.toLowerCase())
  );

  // â”€â”€ Progress bar for large base64 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const statsRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!statsRef.current || !result) return;
    const pct = Math.min(100, (result.sizeBytes / (5 * 1024 * 1024)) * 100);
    statsRef.current.style.setProperty("--size-pct", `${pct}%`);
  }, [result]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-(--page-bg,#f3f6fb) overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-6 py-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">
            Base64 · {companyLabel}
          </p>
          <h1 className="mt-0.5 text-xl font-black tracking-tight text-(--tc-text,#0b1a3c)">
            Conversor Base64
          </h1>
        </div>
        <button
          type="button"
          aria-label="Atualizar histórico"
          onClick={loadHistory}
          disabled={historyLoading}
          className="flex h-9 w-9 items-center justify-center rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) text-(--tc-text-muted,#6b7280) hover:border-(--tc-accent,#ef0001) disabled:opacity-40 transition-colors"
        >
          <FiRefreshCw className={`h-4 w-4 ${historyLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* â”€â”€ Left: Source picker â”€â”€ */}
        <div className="flex w-80 shrink-0 flex-col border-r border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff)">

          {/* Tabs */}
          <div className="flex shrink-0 border-b border-(--tc-border,#d7deea)">
            {(["upload", "library"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`flex flex-1 items-center justify-center gap-2 py-3 text-xs font-semibold transition-colors ${
                  tab === t
                    ? "border-b-2 border-(--tc-accent,#ef0001) text-(--tc-accent,#ef0001)"
                    : "text-(--tc-text-muted,#6b7280) hover:text-(--tc-text,#0b1a3c)"
                }`}
              >
                {t === "upload" ? <FiUploadCloud className="h-3.5 w-3.5" /> : <FiFolder className="h-3.5 w-3.5" />}
                {t === "upload" ? "Upload" : "Biblioteca"}
              </button>
            ))}
          </div>

          {/* Upload tab */}
          {tab === "upload" && (
            <div className="flex flex-1 flex-col p-4 gap-4">
              <div
                className={`flex flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-colors cursor-pointer ${
                  isDragging
                    ? "border-(--tc-accent,#ef0001) bg-[#fff5f5]"
                    : "border-(--tc-border,#d7deea) hover:border-(--tc-accent,#ef0001)/50 hover:bg-(--tc-surface-2,#f8fafc)"
                }`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
                onClick={() => fileInputRef.current?.click()}
              >
                <FiUploadCloud className={`h-10 w-10 mb-3 transition-colors ${isDragging ? "text-(--tc-accent,#ef0001)" : "text-(--tc-text-muted,#6b7280) opacity-40"}`} />
                <p className="text-sm font-semibold text-(--tc-text-muted,#6b7280)">
                  {converting ? "Convertendo..." : "Arraste ou clique"}
                </p>
                <p className="mt-1 text-[11px] text-(--tc-text-muted,#6b7280) opacity-60">
                  Imagens, PDFs, v?deos e mais
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  aria-label="Selecionar arquivo para converter em Base64"
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />
              </div>

              {converting && (
                <div className="flex items-center justify-center gap-2 text-sm text-(--tc-text-muted,#6b7280)">
                  <FiLoader className="h-4 w-4 animate-spin" />
                  Convertendo...
                </div>
              )}
            </div>
          )}

          {/* Library tab */}
          {tab === "library" && (
            <div className="flex flex-1 flex-col min-h-0">
              <div className="shrink-0 px-3 pt-3 pb-2">
                <input
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  placeholder="Buscar arquivo..."
                  aria-label="Buscar arquivo na biblioteca"
                  className="w-full rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-3 py-2 text-sm text-(--tc-text,#0b1a3c) outline-none focus:border-(--tc-accent,#ef0001)"
                />
              </div>
              <div className="flex-1 overflow-auto">
                {libraryLoading ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-sm text-(--tc-text-muted,#6b7280)">
                    <FiLoader className="h-4 w-4 animate-spin" />
                    Carregando...
                  </div>
                ) : filteredLibrary.length === 0 ? (
                  <div className="py-8 text-center">
                    <FiFolder className="mx-auto h-8 w-8 text-(--tc-text-muted,#6b7280) opacity-30" />
                    <p className="mt-2 text-xs text-(--tc-text-muted,#6b7280)">
                      {librarySearch ? "Nenhum arquivo encontrado" : "Biblioteca vazia"}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-(--tc-border,#d7deea)">
                    {filteredLibrary.map((asset) => (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => void handleLibrarySelect(asset)}
                        disabled={converting}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-(--tc-surface-2,#f8fafc) disabled:opacity-50 transition-colors group"
                      >
                        {asset.kind === "image" ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={asset.url}
                            alt={asset.name}
                            className="h-8 w-8 rounded-lg object-cover border border-(--tc-border,#d7deea) shrink-0"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                        ) : (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-(--tc-surface-2,#f8fafc) border border-(--tc-border,#d7deea)">
                            <KindIcon kind={asset.kind} className="h-4 w-4" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-semibold text-(--tc-text,#0b1a3c)">{asset.name}</p>
                          <p className="text-[10px] text-(--tc-text-muted,#6b7280)">{formatBytes(asset.size_bytes)}</p>
                        </div>
                        {converting && <FiLoader className="h-3.5 w-3.5 shrink-0 animate-spin text-(--tc-text-muted,#6b7280)" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* â”€â”€ Center: Output â”€â”€ */}
        <div className="flex flex-1 min-w-0 flex-col min-h-0">

          {/* Current result */}
          <div className="flex shrink-0 flex-col border-b border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-5 gap-4">
            {!result && !converting && (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-3xl bg-(--tc-surface-2,#f8fafc) border border-(--tc-border,#d7deea)">
                  <span className="text-2xl font-black text-(--tc-text-muted,#6b7280) opacity-30">B64</span>
                </div>
                <p className="text-sm font-semibold text-(--tc-text-muted,#6b7280)">Nenhum arquivo convertido</p>
                <p className="mt-1 text-xs text-(--tc-text-muted,#6b7280) opacity-60">
                  Selecione um arquivo na esquerda para converter
                </p>
              </div>
            )}

            {converting && (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <FiLoader className="h-8 w-8 animate-spin text-(--tc-accent,#ef0001)" />
                <p className="text-sm font-semibold text-(--tc-text-muted,#6b7280)">Convertendo para Base64...</p>
              </div>
            )}

            {result && !converting && (
              <>
                {/* File info */}
                <div className="flex items-center gap-4">
                  {result.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={result.previewUrl}
                      alt={result.name}
                      className="h-14 w-14 rounded-2xl object-cover border border-(--tc-border,#d7deea) shrink-0"
                    />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-(--tc-surface-2,#f8fafc) border border-(--tc-border,#d7deea)">
                      <KindIcon kind={result.kind} className="h-6 w-6" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-(--tc-text,#0b1a3c)">{result.name}</p>
                    <p className="text-xs text-(--tc-text-muted,#6b7280)">
                      {formatBytes(result.sizeBytes)} · {result.kind} · {result.source === "library" ? "Biblioteca" : "Upload direto"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-emerald-600 font-semibold">
                      Base64: {formatBytes(Math.round(result.base64.length * 0.75))} · {result.base64.length.toLocaleString()} caracteres
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Salvar código base64 no histórico"
                    onClick={() => void handleSaveCurrent()}
                    disabled={savingCurrent}
                    className="shrink-0 flex items-center gap-1.5 rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-3 py-2 text-xs font-semibold text-(--tc-text,#0b1a3c) hover:border-(--tc-accent,#ef0001) transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingCurrent ? (
                      <><FiLoader className="h-3.5 w-3.5 animate-spin" /> Salvando...</>
                    ) : (
                      <><FiSave className="h-3.5 w-3.5" /> Salvar</>
                    )}
                  </button>
                  <button
                    type="button"
                    aria-label="Limpar resultado atual"
                    onClick={() => setResult(null)}
                    className="shrink-0 flex h-8 w-8 items-center justify-center rounded-xl border border-(--tc-border,#d7deea) text-(--tc-text-muted,#6b7280) hover:border-rose-300 hover:text-rose-500 transition-colors"
                  >
                    <FiX className="h-4 w-4" />
                  </button>
                </div>

                {/* Base64 output */}
                <div className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) overflow-hidden">
                  <div className="flex items-center justify-between border-b border-(--tc-border,#d7deea) px-4 py-2.5">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-(--tc-text-muted,#6b7280)">
                      Código Base64
                    </span>
                    <button
                      type="button"
                      aria-label="Copiar código base64"
                      onClick={() => handleCopy("current", result.base64)}
                      className="flex items-center gap-1.5 rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-3 py-1.5 text-xs font-semibold text-(--tc-text,#0b1a3c) hover:border-(--tc-accent,#ef0001) transition-colors"
                    >
                      {copiedId === "current" ? (
                        <><FiCheck className="h-3.5 w-3.5 text-emerald-500" /> Copiado!</>
                      ) : (
                        <><FiCopy className="h-3.5 w-3.5" /> Copiar</>
                      )}
                    </button>
                  </div>
                  <textarea
                    ref={outputRef}
                    readOnly
                    value={result.base64}
                    aria-label="Código base64 gerado"
                    rows={5}
                    className="w-full resize-none bg-transparent px-4 py-3 font-mono text-[11px] text-(--tc-text,#0b1a3c) leading-5 outline-none"
                    onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                  />
                </div>
              </>
            )}
          </div>

          {/* â”€â”€ History â”€â”€ */}
          <div className="flex flex-1 min-h-0 flex-col bg-(--page-bg,#f3f6fb)">
            <div className="flex shrink-0 items-center justify-between px-5 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">
                Histórico de conversões
              </p>
              <span className="text-[10px] text-(--tc-text-muted,#6b7280)">{history.length} registros</span>
            </div>

            <div className="flex-1 overflow-auto rounded-2xl mx-4 mb-4 border border-(--tc-border,#d7deea) bg-zinc-900 divide-y divide-zinc-800">
              {historyLoading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-zinc-500">
                  <FiLoader className="h-4 w-4 animate-spin" />
                  Carregando histórico...
                </div>
              ) : history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <span className="mb-2 text-3xl opacity-20">◻</span>
                  <p className="text-xs text-zinc-500">Nenhuma conversão ainda.</p>
                  <p className="mt-1 text-[10px] text-zinc-600">As conversões salvas aparecem aqui.</p>
                </div>
              ) : (
                history.map((entry) => (
                  <div key={entry.id} className="group">
                    <HistoryRow
                      entry={entry}
                      companySlug={companySlug}
                      copiedId={copiedId}
                      onCopy={handleCopy}
                      onDelete={handleDeleteHistory}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

