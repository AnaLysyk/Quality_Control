"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FiDownload,
  FiFile,
  FiFileText,
  FiFilm,
  FiImage,
  FiMaximize2,
  FiRefreshCw,
  FiSearch,
  FiTrash2,
  FiUploadCloud,
  FiX,
  FiCopy,
  FiCheck,
  FiCrosshair,
} from "react-icons/fi";

import { useAutomationModuleContext } from "../_components/AutomationModuleContext";
import AssetAnnotator from "./AssetAnnotator";

// ── Types ─────────────────────────────────────────────────────────────────────

type AssetKind = "image" | "video" | "document" | "other";

type Asset = {
  id: string;
  name: string;
  kind: AssetKind;
  size: number;
  url: string;
  uploadedAt: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function KindIcon({ kind }: { kind: AssetKind }) {
  if (kind === "image") return <FiImage className="h-5 w-5 text-blue-500" />;
  if (kind === "video") return <FiFilm className="h-5 w-5 text-purple-500" />;
  if (kind === "document") return <FiFileText className="h-5 w-5 text-emerald-500" />;
  return <FiFile className="h-5 w-5 text-slate-400 dark:text-slate-500" />;
}

const KIND_LABELS: Record<AssetKind, string> = {
  image: "Imagem",
  video: "Vídeo",
  document: "Documento",
  other: "Arquivo",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function AutomacoesArquivosPage() {
  const { activeClient } = useAutomationModuleContext();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterKind, setFilterKind] = useState<AssetKind | "all">("all");
  const [isDragging, setIsDragging] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [annotatingAsset, setAnnotatingAsset] = useState<Asset | null>(null);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const companySlug = activeClient?.slug ?? "";
  const companyLabel = activeClient?.name ?? "Selecione uma empresa";

  // ── Load from DB ───────────────────────────────────────────────────────────

  const loadAssets = useCallback(() => {
    if (!companySlug) {
      setAssets([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/automations/assets?companySlug=${encodeURIComponent(companySlug)}`)
      .then((r) => r.json())
      .then((data: { assets?: Array<{ id: string; name: string; kind: string; size_bytes: number; url: string; created_at: string }> }) => {
        if (!Array.isArray(data.assets)) { setAssets([]); return; }
        setAssets(
          data.assets.map((a) => ({
            id: a.id,
            name: a.name,
            kind: a.kind as AssetKind,
            size: a.size_bytes,
            url: a.url,
            uploadedAt: a.created_at,
          })),
        );
      })
      .catch(() => setAssets([]))
      .finally(() => setLoading(false));
  }, [companySlug]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadAssets(); }, [loadAssets]);

  // ── Upload (store as object URL + register metadata in DB) ─────────────────

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!companySlug) return;
      if (!files || files.length === 0) return;
      setUploading(true);
      const promises = Array.from(files).map((file) => {
        const url = URL.createObjectURL(file);
        return fetch("/api/automations/assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companySlug,
            name: file.name,
            kind: detectKind(file.name),
            sizeBytes: file.size,
            url,
          }),
        })
          .then((r) => r.json())
          .then((data: { asset?: { id: string; created_at: string } }) => {
            if (!data.asset?.id) return;
            const newAsset: Asset = {
              id: data.asset.id,
              name: file.name,
              kind: detectKind(file.name),
              size: file.size,
              url,
              uploadedAt: data.asset.created_at,
            };
            setAssets((prev) => [newAsset, ...prev]);
          });
      });
      Promise.allSettled(promises).finally(() => setUploading(false));
    },
    [companySlug],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const handleCopyRef = useCallback((asset: Asset) => {
    navigator.clipboard.writeText(asset.url);
    setCopiedId(asset.id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      if (!companySlug) return;
      setAssets((prev) => prev.filter((a) => a.id !== id));
      setSelectedAsset((prev) => (prev?.id === id ? null : prev));
      setDetailsExpanded(false);
      void fetch("/api/automations/assets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, companySlug }),
      });
    },
    [companySlug],
  );

  const filtered = assets.filter((a) => {
    const matchSearch = search.trim() === "" || a.name.toLowerCase().includes(search.toLowerCase());
    const matchKind = filterKind === "all" || a.kind === filterKind;
    return matchSearch && matchKind;
  });

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white text-slate-900 dark:bg-[#060b16] dark:text-slate-100">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur dark:border-slate-800 dark:bg-[#0b1020]/90">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
            Biblioteca · {companyLabel}
          </p>
          <h1 className="mt-0.5 text-xl font-black tracking-tight text-slate-900 dark:text-slate-50">
            Documentos &amp; Assets
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Atualizar lista de arquivos"
            onClick={loadAssets}
            disabled={loading}
            className="flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-600 transition-colors hover:border-red-500 hover:text-red-600 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-red-500 dark:hover:text-red-400"
          >
            <FiRefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-2xl bg-(--tc-accent,#ef0001) px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(239,0,1,0.25)] hover:opacity-90 disabled:opacity-60 transition-opacity"
          >
            <FiUploadCloud className="h-4 w-4" />
            {uploading ? "Enviando..." : "Upload"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            aria-label="Selecionar arquivos para upload"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-6 py-3 dark:border-slate-800 dark:bg-[#0b1020]">
        <div className="relative flex-1 min-w-48 max-w-72">
          <FiSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome..."
            className="w-full rounded-2xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-red-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </div>
        <div className="flex items-center gap-2">
          {(["all", "image", "video", "document", "other"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => setFilterKind(kind)}
              className={`rounded-2xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                filterKind === kind
                  ? "border-red-500 bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300"
                  : "border-slate-200 bg-slate-50 text-slate-600 hover:border-red-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-red-500"
              }`}
            >
              {kind === "all" ? "Todos" : KIND_LABELS[kind]}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">
          {filtered.length} arquivo{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Asset grid / drag zone */}
        <div
          className={`relative flex-1 overflow-auto p-6 transition-colors ${isDragging ? "bg-sky-50 ring-2 ring-inset ring-sky-300 dark:bg-sky-950/30 dark:ring-sky-700" : "bg-slate-50/60 dark:bg-[#060b16]"}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          {isDragging && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
              <div className="rounded-3xl border-2 border-dashed border-sky-400 bg-white/90 px-12 py-8 text-center shadow-xl backdrop-blur dark:border-sky-500 dark:bg-slate-950/90">
                <FiUploadCloud className="mx-auto h-10 w-10 text-sky-500 dark:text-sky-400" />
                <p className="mt-3 text-sm font-semibold text-sky-700 dark:text-sky-300">Solte os arquivos para fazer upload</p>
              </div>
            </div>
          )}

          {loading && assets.length === 0 && (
              <div className="flex h-full min-h-48 flex-col items-center justify-center gap-3">
              <FiRefreshCw className="h-8 w-8 animate-spin text-slate-400 opacity-40 dark:text-slate-500" />
              <p className="text-sm text-slate-500 dark:text-slate-400">Carregando arquivos...</p>
              </div>
            )}

          {!loading && filtered.length === 0 && (
              <div className="flex h-full min-h-48 flex-col items-center justify-center text-center">
              <FiFile className="mx-auto mb-4 h-12 w-12 text-slate-400 opacity-30 dark:text-slate-500" />
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-300">
                {search || filterKind !== "all" ? "Nenhum arquivo encontrado" : "Nenhum arquivo ainda"}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {search || filterKind !== "all"
                  ? "Ajuste os filtros ou faça upload de novos arquivos"
                  : "Arraste arquivos aqui ou clique em Upload"}
              </p>
            </div>
          )}

          {filtered.length > 0 && (
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filtered.map((asset) => (
                <div
                  key={asset.id}
                  onClick={() => {
                    setSelectedAsset(asset);
                    setDetailsExpanded(false);
                  }}
                  className={`group relative cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition-all hover:border-red-400 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-red-500`}
                >
                  {/* Preview / icon */}
                  <div className="relative aspect-4/3 w-full overflow-hidden bg-slate-50 dark:bg-slate-950/60">
                    {asset.kind === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={asset.url}
                        alt={asset.name}
                        className="h-full w-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <KindIcon kind={asset.kind} />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 border-t border-slate-200 px-4 py-3 dark:border-slate-700">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{asset.name}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      {KIND_LABELS[asset.kind]} · {formatBytes(asset.size)}
                    </p>
                  </div>

                  {/* Quick actions on hover */}
                  <div className="absolute right-2 top-2 z-10 hidden items-center gap-1 group-hover:flex">
                    {asset.kind === "image" && (
                      <button
                        type="button"
                        title="Anotar regiões"
                        onClick={(e) => { e.stopPropagation(); setAnnotatingAsset(asset); }}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm hover:text-red-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-red-400"
                      >
                        <FiCrosshair className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      title="Copiar referência"
                      onClick={(e) => { e.stopPropagation(); handleCopyRef(asset); }}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm hover:text-red-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-red-400"
                    >
                      {copiedId === asset.id ? (
                        <FiCheck className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <FiCopy className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      title="Excluir"
                      onClick={(e) => { e.stopPropagation(); handleDelete(asset.id); }}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-500 shadow-sm hover:bg-rose-50 dark:border-rose-900 dark:bg-slate-900 dark:text-rose-400 dark:hover:bg-rose-950/30"
                    >
                      <FiTrash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selectedAsset && (
          <aside
            className={`relative flex shrink-0 flex-col border-l border-slate-200 bg-white transition-[width] duration-200 dark:border-slate-800 dark:bg-[#0b1020] ${
              detailsExpanded
                ? "w-[min(32rem,calc(100vw-1rem))]"
                : "w-72 md:w-80"
            }`}
          >
            <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-[#0b1020]/95">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Detalhes
                </p>
                <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                  {detailsExpanded ? "Visão expandida" : "Visão compacta"}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label={detailsExpanded ? "Reduzir painel de detalhes" : "Expandir painel de detalhes"}
                  title={detailsExpanded ? "Reduzir painel" : "Expandir painel"}
                  onClick={() => setDetailsExpanded((current) => !current)}
                  className="inline-flex h-8 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 shadow-sm hover:border-red-500 hover:text-red-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-red-500 dark:hover:text-red-300"
                >
                  <FiMaximize2 className="h-4 w-4" />
                  <span className="hidden lg:inline">{detailsExpanded ? "Reduzir" : "Expandir"}</span>
                </button>
                <button
                  type="button"
                  aria-label="Fechar painel de detalhes"
                  onClick={() => setSelectedAsset(null)}
                  className="inline-flex h-8 items-center gap-2 rounded-lg border border-rose-200 bg-rose-600 px-3 text-xs font-semibold text-white shadow-sm hover:bg-rose-700"
                >
                  <FiX className="h-4 w-4" />
                  <span className="hidden lg:inline">Fechar</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-5">
              {/* Preview */}
              <div className={`flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 shadow-sm dark:border-slate-700 dark:bg-slate-950/60 ${
                detailsExpanded ? "h-48" : "h-36"
              }`}>
                {selectedAsset.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedAsset.url}
                    alt={selectedAsset.name}
                    className="h-full w-full rounded-2xl object-contain"
                  />
                ) : (
                  <KindIcon kind={selectedAsset.kind} />
                )}
              </div>

              {/* Info */}
              <div className={`grid gap-3 text-sm ${detailsExpanded ? "sm:grid-cols-2" : ""}`}>
                <div className="sm:col-span-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Nome</p>
                  <p className="mt-1 break-all font-semibold text-slate-900 dark:text-slate-100">{selectedAsset.name}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Tipo</p>
                  <p className="mt-1 text-slate-700 dark:text-slate-300">{KIND_LABELS[selectedAsset.kind]}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Tamanho</p>
                  <p className="mt-1 text-slate-700 dark:text-slate-300">{formatBytes(selectedAsset.size)}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Upload</p>
                  <p className="mt-1 text-slate-700 dark:text-slate-300">
                    {new Date(selectedAsset.uploadedAt).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">ID do arquivo</p>
                  <p className="mt-1 break-all text-slate-700 dark:text-slate-300">{selectedAsset.id}</p>
                </div>
              </div>

              {/* Reference box */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Referência para script
                </p>
                <div className="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-950/60">
                  <code className="flex-1 truncate text-[11px] text-slate-900 dark:text-slate-200">{selectedAsset.url}</code>
                  <button
                    type="button"
                    onClick={() => handleCopyRef(selectedAsset)}
                    className="shrink-0 text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-300"
                  >
                    {copiedId === selectedAsset.id ? (
                      <FiCheck className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <FiCopy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Footer actions */}
            <div className={`border-t border-slate-200 p-4 dark:border-slate-800 ${detailsExpanded ? "space-y-3" : ""}`}>
              <div className={`grid gap-2 ${detailsExpanded ? "grid-cols-2" : "grid-cols-1"}`}>
                {selectedAsset.kind === "image" && (
                  <button
                    type="button"
                    onClick={() => setAnnotatingAsset(selectedAsset)}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 transition-colors hover:border-red-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    title="Anotar regiões da imagem"
                  >
                    <FiCrosshair className="h-4 w-4" />
                    Anotar
                  </button>
                )}
                <a
                  href={selectedAsset.url}
                  download={selectedAsset.name}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 transition-colors hover:border-red-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <FiDownload className="h-4 w-4" />
                  Download
                </a>
                <button
                  type="button"
                  onClick={() => handleCopyRef(selectedAsset)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 transition-colors hover:border-red-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  {copiedId === selectedAsset.id ? (
                    <FiCheck className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <FiCopy className="h-4 w-4" />
                  )}
                  Copiar ref
                </button>
                <button
                  type="button"
                  aria-label="Excluir arquivo"
                  onClick={() => handleDelete(selectedAsset.id)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-100 transition-colors dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/50"
                >
                  <FiTrash2 className="h-4 w-4" />
                  Excluir
                </button>
              </div>
              {!detailsExpanded ? (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Expanda o painel para ver todas as ações e metadados do arquivo.
                </p>
              ) : null}
            </div>
          </aside>
        )}
      </div>
      {annotatingAsset && (
        <AssetAnnotator
          assetId={annotatingAsset.id}
          assetName={annotatingAsset.name}
          assetUrl={annotatingAsset.url}
          companySlug={companySlug}
          onClose={() => setAnnotatingAsset(null)}
        />
      )}
    </div>
  );
}
