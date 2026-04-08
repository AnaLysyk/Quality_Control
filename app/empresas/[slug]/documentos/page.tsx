"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiCopy,
  FiExternalLink,
  FiFileText,
  FiFolder,
  FiLink2,
  FiPaperclip,
  FiPlus,
  FiTrash2,
  FiUploadCloud,
} from "react-icons/fi";

import Breadcrumb from "@/components/Breadcrumb";
import { useClientContext } from "@/context/ClientContext";
import { fetchApi } from "@/lib/api";

type DocumentItem = {
  id: string;
  kind: "file" | "link";
  title: string;
  description?: string | null;
  url?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  createdAt: string;
  createdBy?: string | null;
  createdByName?: string | null;
};

type DocumentsResponse = {
  items?: DocumentItem[];
  canManage?: boolean;
  error?: string;
};

function formatBytes(bytes?: number | null) {
  if (!bytes || bytes <= 0) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(size >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDate(value: string) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function isLinkDocument(item: DocumentItem) {
  return item.kind === "link" && typeof item.url === "string" && item.url.trim().length > 0;
}

export default function CompanyDocumentsPage() {
  const params = useParams();
  const slugParam = params?.slug;
  const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam || "";
  const { clients, loading: clientsLoading } = useClientContext();

  const hasAccess = useMemo(() => {
    if (!slug) return false;
    if (clientsLoading) return true;
    return clients.some((client) => client.slug === slug);
  }, [clients, clientsLoading, slug]);

  const company = useMemo(() => clients.find((client) => client.slug === slug) ?? null, [clients, slug]);
  const companyName = company?.name || slug || "Empresa";

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [composer, setComposer] = useState<"file" | "link" | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [fileTitle, setFileTitle] = useState("");
  const [fileDescription, setFileDescription] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [linkTitle, setLinkTitle] = useState("");
  const [linkDescription, setLinkDescription] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const fileCount = useMemo(() => documents.filter((item) => item.kind === "file").length, [documents]);
  const linkCount = useMemo(() => documents.filter((item) => item.kind === "link").length, [documents]);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetchApi(`/api/company-documents?slug=${encodeURIComponent(slug)}`);
      const json = (await res.json().catch(() => ({}))) as DocumentsResponse;
      if (!res.ok) {
        setDocuments([]);
        setCanManage(false);
        if (res.status === 401 || res.status === 403) {
          setForbidden(true);
        }
        setError(json.error || "Nao foi possivel carregar os documentos desta empresa.");
        return;
      }

      setForbidden(false);
      setDocuments(Array.isArray(json.items) ? json.items : []);
      setCanManage(json.canManage === true);
    } catch (err) {
      setDocuments([]);
      setCanManage(false);
      setError(err instanceof Error ? err.message : "Nao foi possivel carregar os documentos desta empresa.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (clientsLoading) return;
    if (!hasAccess) {
      setDocuments([]);
      setCanManage(false);
      setForbidden(true);
      setLoading(false);
      setError("Acesso negado");
      return;
    }
    load();
  }, [clientsLoading, hasAccess, load]);

  async function handleCopyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Link copiado.");
      setError(null);
    } catch {
      setError("Nao foi possivel copiar o link.");
    }
  }

  async function submitFile() {
    if (!slug) return;
    setError(null);
    setMessage(null);

    let file = uploadFile;
    if (!file && typeof document !== "undefined") {
      const input = document.querySelector('[data-testid="doc-file-input"]') as HTMLInputElement | null;
      file = input?.files?.[0] ?? null;
    }

    if (!file) {
      setError("Selecione um arquivo para continuar.");
      return;
    }

    setSubmitting(true);
    try {
      const form = new FormData();
      form.set("slug", slug);
      form.set("title", (fileTitle.trim() || file.name).slice(0, 120));
      form.set("description", fileDescription.trim());
      form.set("file", file);

      const res = await fetchApi("/api/company-documents", {
        method: "POST",
        body: form,
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error || "Nao foi possivel enviar o arquivo.");
        return;
      }

      setFileTitle("");
      setFileDescription("");
      setUploadFile(null);
      try {
        const input = document.querySelector('[data-testid="doc-file-input"]') as HTMLInputElement | null;
        if (input) input.value = "";
      } catch {
        /* ignore */
      }
      setComposer(null);
      setMessage("Arquivo adicionado com sucesso.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel enviar o arquivo.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitLink() {
    if (!slug) return;
    setError(null);
    setMessage(null);

    if (!linkUrl.trim()) {
      setError("Informe a URL do link.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetchApi("/api/company-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          kind: "link",
          title: (linkTitle.trim() || "Link da empresa").slice(0, 120),
          description: linkDescription.trim(),
          url: linkUrl.trim(),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error || "Nao foi possivel salvar o link.");
        return;
      }

      setLinkTitle("");
      setLinkDescription("");
      setLinkUrl("");
      setComposer(null);
      setMessage("Link adicionado com sucesso.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel salvar o link.");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteDocument(id: string) {
    if (!slug) return;
    const confirmed = window.confirm("Deseja excluir este documento da empresa?");
    if (!confirmed) return;

    setError(null);
    setMessage(null);
    try {
      const res = await fetchApi(`/api/company-documents?slug=${encodeURIComponent(slug)}&id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error || "Nao foi possivel excluir o documento.");
        return;
      }
      setMessage("Documento excluido.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel excluir o documento.");
    }
  }

  if (forbidden || (!clientsLoading && !hasAccess)) {
    return (
      <div className="min-h-screen bg-(--page-bg,#ffffff) px-6 py-10 text-(--page-text,#0b1a3c)">
        <div className="mx-auto flex min-h-[60vh] max-w-md items-center justify-center">
          <div className="w-full rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-8 text-center shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-(--tc-text-muted,#6b7280)">Documentos</p>
            <h1 className="mt-3 text-2xl font-extrabold text-(--tc-text-primary,#0b1a3c)">Acesso negado</h1>
            <p className="mt-3 text-sm leading-6 text-(--tc-text-secondary,#4b5563)">
              Voce nao tem permissao para consultar os documentos desta empresa.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-(--page-bg,#ffffff) text-(--page-text,#0b1a3c)">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10">
        <Breadcrumb
          items={[
            { label: companyName, href: currentCompanyHref(company?.slug ?? slug) },
            { label: "Documentos" },
          ]}
        />

        <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,#031843_0%,#082457_38%,#3a174f_72%,#9f1025_100%)] px-6 py-6 text-white shadow-[0_30px_80px_rgba(15,23,42,0.18)] sm:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-xl font-bold shadow-inner">
                  {getInitials(companyName)}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/70">Documentacao da empresa</p>
                  <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-white">{companyName}</h1>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-white/82">
                    Repositorio de arquivos, links e materiais de apoio da operacao desta empresa.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 text-sm">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-white/92">
                  <FiFolder className="h-4 w-4" /> {documents.length} itens cadastrados
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-white/92">
                  <FiPaperclip className="h-4 w-4" /> {fileCount} arquivos
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-white/92">
                  <FiLink2 className="h-4 w-4" /> {linkCount} links
                </span>
              </div>
            </div>

            {canManage ? (
              <div className="flex flex-wrap gap-3 lg:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setComposer((current) => (current === "file" ? null : "file"));
                    setMessage(null);
                    setError(null);
                  }}
                  className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                    composer === "file"
                      ? "border-white/30 bg-white text-(--tc-text-primary,#0b1a3c)"
                      : "border-white/20 bg-white/8 text-white hover:bg-white/14"
                  }`}
                >
                  <FiUploadCloud className="h-4 w-4" /> Adicionar arquivo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setComposer((current) => (current === "link" ? null : "link"));
                    setMessage(null);
                    setError(null);
                  }}
                  className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                    composer === "link"
                      ? "border-white/30 bg-white text-(--tc-text-primary,#0b1a3c)"
                      : "border-white/20 bg-white/8 text-white hover:bg-white/14"
                  }`}
                >
                  <FiPlus className="h-4 w-4" /> Adicionar link
                </button>
              </div>
            ) : null}
          </div>
        </section>

        {message ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>
        ) : null}

        {composer === "file" ? (
          <section className="rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-(--tc-text-muted,#6b7280)">Arquivo da empresa</p>
                <h2 className="mt-2 text-2xl font-bold text-(--tc-text-primary,#0b1a3c)">Adicionar arquivo</h2>
                <p className="mt-2 max-w-2xl text-sm text-(--tc-text-secondary,#4b5563)">
                  Envie um arquivo para manter materiais de apoio e referencias desta empresa em um unico lugar.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setComposer(null)}
                className="inline-flex items-center rounded-xl border border-(--tc-border,#d7deea) px-3 py-2 text-sm font-semibold text-(--tc-text-secondary,#4b5563) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)"
              >
                Fechar
              </button>
            </div>
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">Titulo</span>
                <input
                  data-testid="doc-file-title"
                  value={fileTitle}
                  onChange={(event) => setFileTitle(event.target.value)}
                  placeholder="Ex.: Plano de testes da empresa"
                  className="w-full rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-3 text-sm text-(--tc-text-primary,#0b1a3c) outline-none transition focus:border-(--tc-accent,#ef0001)"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">Arquivo</span>
                <input
                  data-testid="doc-file-input"
                  type="file"
                  onChange={(event) => setUploadFile(event.currentTarget.files?.[0] ?? null)}
                  className="w-full rounded-2xl border border-dashed border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) px-4 py-[0.9rem] text-sm text-(--tc-text-secondary,#4b5563) outline-none transition file:mr-3 file:rounded-xl file:border-0 file:bg-(--tc-accent,#ef0001) file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white focus:border-(--tc-accent,#ef0001)"
                />
              </label>
              <label className="space-y-2 lg:col-span-2">
                <span className="text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">Descricao</span>
                <textarea
                  data-testid="doc-file-description"
                  value={fileDescription}
                  onChange={(event) => setFileDescription(event.target.value)}
                  rows={4}
                  placeholder="Descreva o conteudo ou a finalidade deste documento."
                  className="w-full rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-3 text-sm text-(--tc-text-primary,#0b1a3c) outline-none transition focus:border-(--tc-accent,#ef0001)"
                />
              </label>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setComposer(null)}
                className="rounded-2xl border border-(--tc-border,#d7deea) px-4 py-3 text-sm font-semibold text-(--tc-text-secondary,#4b5563) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)"
              >
                Cancelar
              </button>
              <button
                data-testid="doc-file-submit"
                type="button"
                disabled={submitting}
                onClick={() => void submitFile()}
                className="inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(90deg,#071e53_0%,#ef0001_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(239,0,1,0.18)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiUploadCloud className="h-4 w-4" /> {submitting ? "Enviando..." : "Salvar arquivo"}
              </button>
            </div>
          </section>
        ) : null}

        {composer === "link" ? (
          <section className="rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-(--tc-text-muted,#6b7280)">Link da empresa</p>
                <h2 className="mt-2 text-2xl font-bold text-(--tc-text-primary,#0b1a3c)">Adicionar link</h2>
                <p className="mt-2 max-w-2xl text-sm text-(--tc-text-secondary,#4b5563)">
                  Cadastre links de referencia, paginas internas, materiais de apoio e documentacao util para esta empresa.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setComposer(null)}
                className="inline-flex items-center rounded-xl border border-(--tc-border,#d7deea) px-3 py-2 text-sm font-semibold text-(--tc-text-secondary,#4b5563) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)"
              >
                Fechar
              </button>
            </div>
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">Titulo</span>
                <input
                  data-testid="doc-link-title"
                  value={linkTitle}
                  onChange={(event) => setLinkTitle(event.target.value)}
                  placeholder="Ex.: Guia de operacao no Qase"
                  className="w-full rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-3 text-sm text-(--tc-text-primary,#0b1a3c) outline-none transition focus:border-(--tc-accent,#ef0001)"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">URL</span>
                <input
                  data-testid="doc-link-url"
                  value={linkUrl}
                  onChange={(event) => setLinkUrl(event.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-3 text-sm text-(--tc-text-primary,#0b1a3c) outline-none transition focus:border-(--tc-accent,#ef0001)"
                />
              </label>
              <label className="space-y-2 lg:col-span-2">
                <span className="text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">Descricao</span>
                <textarea
                  data-testid="doc-link-description"
                  value={linkDescription}
                  onChange={(event) => setLinkDescription(event.target.value)}
                  rows={4}
                  placeholder="Explique o contexto deste link e quando ele deve ser utilizado."
                  className="w-full rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-3 text-sm text-(--tc-text-primary,#0b1a3c) outline-none transition focus:border-(--tc-accent,#ef0001)"
                />
              </label>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setComposer(null)}
                className="rounded-2xl border border-(--tc-border,#d7deea) px-4 py-3 text-sm font-semibold text-(--tc-text-secondary,#4b5563) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)"
              >
                Cancelar
              </button>
              <button
                data-testid="doc-link-submit"
                type="button"
                disabled={submitting}
                onClick={() => void submitLink()}
                className="inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(90deg,#071e53_0%,#ef0001_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(239,0,1,0.18)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiLink2 className="h-4 w-4" /> {submitting ? "Salvando..." : "Salvar link"}
              </button>
            </div>
          </section>
        ) : null}

        <section className="rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:p-6">
          <div className="flex flex-col gap-4 border-b border-(--tc-border,#d7deea) pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-(--tc-text-muted,#6b7280)">Repositorio da empresa</p>
              <h2 className="mt-2 text-2xl font-bold text-(--tc-text-primary,#0b1a3c)">Documentos cadastrados</h2>
              <p className="mt-2 text-sm text-(--tc-text-secondary,#4b5563)">
                Arquivos, links e referencias disponiveis para os usuarios vinculados a esta empresa.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) px-3 py-2 font-semibold text-(--tc-text-secondary,#4b5563)">
                {documents.length} itens
              </span>
              <span className="rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) px-3 py-2 font-semibold text-(--tc-text-secondary,#4b5563)">
                {fileCount} arquivos
              </span>
              <span className="rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) px-3 py-2 font-semibold text-(--tc-text-secondary,#4b5563)">
                {linkCount} links
              </span>
            </div>
          </div>

          {loading ? (
            <div className="grid gap-4 pt-6 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="rounded-[24px] border border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) p-5">
                  <div className="h-4 w-24 animate-pulse rounded-full bg-slate-200" />
                  <div className="mt-4 h-6 w-2/3 animate-pulse rounded-full bg-slate-200" />
                  <div className="mt-3 h-4 w-full animate-pulse rounded-full bg-slate-200" />
                  <div className="mt-2 h-4 w-4/5 animate-pulse rounded-full bg-slate-200" />
                </div>
              ))}
            </div>
          ) : documents.length === 0 ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center gap-4 py-10 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) text-(--tc-text-muted,#6b7280)">
                <FiFileText className="h-7 w-7" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-(--tc-text-primary,#0b1a3c)">Nenhum documento cadastrado</h3>
                <p className="max-w-xl text-sm leading-6 text-(--tc-text-secondary,#4b5563)">
                  {canManage
                    ? "Adicione arquivos ou links para montar a base de referencia desta empresa."
                    : "Ainda nao existem documentos disponiveis para esta empresa."}
                </p>
              </div>
            </div>
          ) : (
            <div data-testid="document-list" className="grid gap-4 pt-6 md:grid-cols-2 xl:grid-cols-3">
              {documents.map((item) => {
                const external = isLinkDocument(item);
                const href = item.url || "#";
                return (
                  <article
                    key={item.id}
                    className="flex h-full flex-col rounded-[24px] border border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-3">
                        <span
                          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] ${
                            item.kind === "file"
                              ? "border border-slate-200 bg-white text-slate-600"
                              : "border border-rose-100 bg-rose-50 text-rose-600"
                          }`}
                        >
                          {item.kind === "file" ? <FiPaperclip className="h-3.5 w-3.5" /> : <FiLink2 className="h-3.5 w-3.5" />}
                          {item.kind === "file" ? "Arquivo" : "Link"}
                        </span>
                        <div>
                          <h3 className="text-lg font-bold leading-6 text-(--tc-text-primary,#0b1a3c)">{item.title}</h3>
                          {item.description ? (
                            <p className="mt-2 text-sm leading-6 text-(--tc-text-secondary,#4b5563)">{item.description}</p>
                          ) : (
                            <p className="mt-2 text-sm leading-6 text-(--tc-text-muted,#6b7280)">Sem descricao complementar.</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 rounded-2xl border border-(--tc-border,#d7deea) bg-white p-4 text-sm text-(--tc-text-secondary,#4b5563)">
                      <div className="flex items-start justify-between gap-3">
                        <span className="font-semibold text-(--tc-text-primary,#0b1a3c)">Adicionado em</span>
                        <span className="text-right">{formatDate(item.createdAt)}</span>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <span className="font-semibold text-(--tc-text-primary,#0b1a3c)">Adicionado por</span>
                        <span className="text-right">{item.createdByName || "Sistema"}</span>
                      </div>
                      {item.kind === "file" ? (
                        <>
                          <div className="flex items-start justify-between gap-3">
                            <span className="font-semibold text-(--tc-text-primary,#0b1a3c)">Arquivo</span>
                            <span className="text-right break-all">{item.fileName || "Arquivo"}</span>
                          </div>
                          <div className="flex items-start justify-between gap-3">
                            <span className="font-semibold text-(--tc-text-primary,#0b1a3c)">Tamanho</span>
                            <span>{formatBytes(item.sizeBytes)}</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-start justify-between gap-3">
                          <span className="font-semibold text-(--tc-text-primary,#0b1a3c)">Destino</span>
                          <span className="text-right break-all">{item.url}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl border border-(--tc-border,#d7deea) bg-white px-3 py-2 text-sm font-semibold text-(--tc-text-primary,#0b1a3c) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)"
                      >
                        <FiExternalLink className="h-4 w-4" /> {external ? "Abrir link" : "Abrir arquivo"}
                      </a>
                      {external ? (
                        <button
                          type="button"
                          onClick={() => void handleCopyLink(item.url || "")}
                          className="inline-flex items-center gap-2 rounded-xl border border-(--tc-border,#d7deea) bg-white px-3 py-2 text-sm font-semibold text-(--tc-text-primary,#0b1a3c) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)"
                        >
                          <FiCopy className="h-4 w-4" /> Copiar link
                        </button>
                      ) : null}
                      {canManage ? (
                        <button
                          type="button"
                          onClick={() => void deleteDocument(item.id)}
                          className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-100"
                        >
                          <FiTrash2 className="h-4 w-4" /> Excluir
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function currentCompanyHref(slug: string) {
  const normalized = slug.trim();
  return normalized ? `/empresas/${encodeURIComponent(normalized)}/home` : "/admin/clients";
}

function getInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "EM";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[parts.length - 1].slice(0, 1)}`.toUpperCase();
}
