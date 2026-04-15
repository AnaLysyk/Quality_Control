"use client";

export const dynamic = "force-dynamic";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiCopy,
  FiEdit2,
  FiExternalLink,
  FiFileText,
  FiFolder,
  FiLink2,
  FiPaperclip,
  FiPlus,
  FiTrash2,
  FiUploadCloud,
} from "react-icons/fi";

import { useAppShellCoverSlot } from "@/components/AppShellCoverSlotContext";
import DocumentViewer from "@/components/DocumentViewer";
import { useClientContext } from "@/context/ClientContext";
import { fetchApi } from "@/lib/api";
import { useI18n } from "@/hooks/useI18n";

const COPY = {
  "pt-BR": {
    forbiddenKicker: "Documentos",
    forbiddenTitle: "Acesso negado",
    forbiddenDesc: "Você não tem permissão para consultar os documentos desta empresa.",
    breadcrumbDocs: "Documentos",
    headerKicker: "Documentação da empresa",
    headerDesc: "Repositório de arquivos, links e materiais de apoio da operação desta empresa.",
    itemsRegistered: (n: number) => `${n} itens cadastrados`,
    filesCount: (n: number) => `${n} arquivos`,
    linksCount: (n: number) => `${n} links`,
    addFile: "Adicionar arquivo",
    addLink: "Adicionar link",
    linkCopied: "Link copiado.",
    copyFailed: "Não foi possível copiar o link.",
    fileKicker: "Arquivo da empresa",
    fileTitle: "Adicionar arquivo",
    fileDesc: "Envie um arquivo para manter materiais de apoio e referencias desta empresa em um único lugar.",
    close: "Fechar",
    labelTitle: "Título",
    labelFile: "Arquivo",
    labelDescription: "Descrição",
    placeholderFileTitle: "Ex.: Plano de testes da empresa",
    placeholderFileDesc: "Descreva o conteúdo ou a finalidade deste documento.",
    cancel: "Cancelar",
    submittingFile: "Enviando...",
    saveFile: "Salvar arquivo",
    linkKicker: "Link da empresa",
    linkTitle: "Adicionar link",
    linkDesc: "Cadastre links de referencia, páginas internas, materiais de apoio e documentação util para esta empresa.",
    labelUrl: "URL",
    placeholderLinkTitle: "Ex.: Guia de operação no Qase",
    placeholderLinkDesc: "Explique o contexto deste link e quando ele deve ser utilizado.",
    submittingLink: "Salvando...",
    saveLink: "Salvar link",
    repoKicker: "Repositório da empresa",
    repoTitle: "Documentos cadastrados",
    repoDesc: "Arquivos, links e referencias disponíveis para os usuários vinculados a esta empresa.",
    itemsLabel: (n: number) => `${n} itens`,
    fileLabel: "Arquivo",
    linkLabel: "Link",
    noDescDoc: "Sem descrição complementar.",
    addedAt: "Adicionado em",
    addedBy: "Adicionado por",
    systemUser: "Sistema",
    fileField: "Arquivo",
    sizeField: "Tamanho",
    destinationField: "Destino",
    openLink: "Abrir link",
    openFile: "Abrir arquivo",
    copyLink: "Copiar link",
    deleteBtn: "Excluir",
    emptyTitle: "Nenhum documento cadastrado",
    emptyDescManage: "Adicione arquivos ou links para montar a base de referencia desta empresa.",
    emptyDescView: "Ainda não existem documentos disponíveis para esta empresa.",
    confirmDelete: "Deseja excluir este documento da empresa?",
    deletedMsg: "Documento excluido.",
    fileAdded: "Arquivo adicionado com sucesso.",
    linkAdded: "Link adicionado com sucesso.",
    errAccessDenied: "Acesso negado",
    errLoadDocs: "Não foi possível carregar os documentos desta empresa.",
    errSelectFile: "Selecione um arquivo para continuar.",
    errSendFile: "Não foi possível enviar o arquivo.",
    errLinkUrl: "Informe a URL do link.",
    errSaveLink: "Não foi possível salvar o link.",
    errDeleteDoc: "Não foi possível excluir o documento.",
    deleteModalTitle: "Excluir documento",
    deleteModalDesc: "Esta ação é permanente e não pode ser desfeita. Deseja continuar?",
    deleteModalConfirm: "Excluir permanentemente",
    deleteModalCancel: "Cancelar",
    defaultCompany: "Empresa",
    defaultLinkTitle: "Link da empresa",
    editBtn: "Editar",
    editKicker: "Editar documento",
    editTitle: "Editar",
    saveEdit: "Salvar alterações",
    savingEdit: "Salvando...",
    editSuccess: "Documento atualizado.",
    errEditDoc: "Não foi possível atualizar o documento.",
    previewLink: "Testar link",
  },
  "en-US": {
    forbiddenKicker: "Documents",
    forbiddenTitle: "Access denied",
    forbiddenDesc: "You do not have permission to view documents for this company.",
    breadcrumbDocs: "Documents",
    headerKicker: "Company documentation",
    headerDesc: "Repository of files, links and support materials for this company's operations.",
    itemsRegistered: (n: number) => `${n} items registered`,
    filesCount: (n: number) => `${n} files`,
    linksCount: (n: number) => `${n} links`,
    addFile: "Add file",
    addLink: "Add link",
    linkCopied: "Link copied.",
    copyFailed: "Could not copy the link.",
    fileKicker: "Company file",
    fileTitle: "Add file",
    fileDesc: "Upload a file to keep support materials and references for this company in one place.",
    close: "Close",
    labelTitle: "Title",
    labelFile: "File",
    labelDescription: "Description",
    placeholderFileTitle: "E.g.: Company test plan",
    placeholderFileDesc: "Describe the content or purpose of this document.",
    cancel: "Cancel",
    submittingFile: "Uploading...",
    saveFile: "Save file",
    linkKicker: "Company link",
    linkTitle: "Add link",
    linkDesc: "Register reference links, internal pages, support materials and useful documentation for this company.",
    labelUrl: "URL",
    placeholderLinkTitle: "E.g.: Qase operation guide",
    placeholderLinkDesc: "Explain the context of this link and when it should be used.",
    submittingLink: "Saving...",
    saveLink: "Save link",
    repoKicker: "Company repository",
    repoTitle: "Registered documents",
    repoDesc: "Files, links and references available to users linked to this company.",
    itemsLabel: (n: number) => `${n} items`,
    fileLabel: "File",
    linkLabel: "Link",
    noDescDoc: "No additional description.",
    addedAt: "Added on",
    addedBy: "Added by",
    systemUser: "System",
    fileField: "File",
    sizeField: "Size",
    destinationField: "Destination",
    openLink: "Open link",
    openFile: "Open file",
    copyLink: "Copy link",
    deleteBtn: "Delete",
    emptyTitle: "No documents registered",
    emptyDescManage: "Add files or links to build the reference base for this company.",
    emptyDescView: "There are no documents available for this company yet.",
    confirmDelete: "Do you want to delete this company document?",
    deletedMsg: "Document deleted.",
    fileAdded: "File added successfully.",
    linkAdded: "Link added successfully.",
    errAccessDenied: "Access denied",
    errLoadDocs: "Could not load documents for this company.",
    errSelectFile: "Select a file to continue.",
    errSendFile: "Could not upload the file.",
    errLinkUrl: "Please enter the link URL.",
    errSaveLink: "Could not save the link.",
    errDeleteDoc: "Could not delete the document.",
    deleteModalTitle: "Delete document",
    deleteModalDesc: "This action is permanent and cannot be undone. Do you want to continue?",
    deleteModalConfirm: "Delete permanently",
    deleteModalCancel: "Cancel",
    defaultCompany: "Company",
    defaultLinkTitle: "Company link",
    editBtn: "Edit",
    editKicker: "Edit document",
    editTitle: "Edit",
    saveEdit: "Save changes",
    savingEdit: "Saving...",
    editSuccess: "Document updated.",
    errEditDoc: "Could not update the document.",
    previewLink: "Test link",
    viewerTitle: "Document viewer",
    viewerClose: "Close viewer",
    viewerPage: "Page",
    viewerOf: "of",
    viewerZoom: "Zoom",
    viewerDownload: "Download",
  },
} as const;

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

function safeHref(url: string) {
  if (!url || url === "#") return "#";
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export default function CompanyDocumentsPage() {
  const params = useParams();
  const slugParam = params?.slug;
  const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam || "";
  const { clients, loading: clientsLoading } = useClientContext();
  const { language } = useI18n();
  const copy = COPY[language] ?? COPY["pt-BR"];

  const hasAccess = useMemo(() => {
    if (!slug) return false;
    if (clientsLoading) return true;
    return clients.some((client) => client.slug === slug);
  }, [clients, clientsLoading, slug]);

  const company = useMemo(() => clients.find((client) => client.slug === slug) ?? null, [clients, slug]);
  const companyName = company?.name || slug || copy.defaultCompany;

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
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerItem, setViewerItem] = useState<DocumentItem | null>(null);

  const [editing, setEditing] = useState<DocumentItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);


  const fileCount = useMemo(() => documents.filter((item) => item.kind === "file").length, [documents]);
  const linkCount = useMemo(() => documents.filter((item) => item.kind === "link").length, [documents]);

  useAppShellCoverSlot(null);

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
        setError(json.error || copy.errLoadDocs);
        return;
      }

      setForbidden(false);
      setDocuments(Array.isArray(json.items) ? json.items : []);
      setCanManage(json.canManage === true);
    } catch (err) {
      setDocuments([]);
      setCanManage(false);
      setError(err instanceof Error ? err.message : copy.errLoadDocs);
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
      setError(copy.errAccessDenied);
      return;
    }
    load();
  }, [clientsLoading, hasAccess, load]);

  async function handleCopyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setMessage(copy.linkCopied);
      setError(null);
    } catch {
      setError(copy.copyFailed);
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
      setError(copy.errSelectFile);
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
        setError(json.error || copy.errSendFile);
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
      setMessage(copy.fileAdded);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.errSendFile);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitLink() {
    if (!slug) return;
    setError(null);
    setMessage(null);

    if (!linkUrl.trim()) {
      setError(copy.errLinkUrl);
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
          title: (linkTitle.trim() || copy.defaultLinkTitle).slice(0, 120),
          description: linkDescription.trim(),
          url: linkUrl.trim(),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error || copy.errSaveLink);
        return;
      }

      setLinkTitle("");
      setLinkDescription("");
      setLinkUrl("");
      setComposer(null);
      setMessage(copy.linkAdded);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.errSaveLink);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitEdit() {
    if (!slug || !editing) return;
    setError(null);
    setMessage(null);
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        slug,
        id: editing.id,
        title: editTitle.trim() || editing.title,
        description: editDesc.trim(),
      };
      if (editing.kind === "link") {
        body.url = editUrl.trim() || editing.url;
      }
      const res = await fetchApi("/api/company-documents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error || copy.errEditDoc);
        return;
      }
      setEditing(null);
      setMessage(copy.editSuccess);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.errEditDoc);
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteDocument(id: string) {
    if (!slug) return;
    setDeletingId(null);
    setError(null);
    setMessage(null);
    try {
      const res = await fetchApi(`/api/company-documents?slug=${encodeURIComponent(slug)}&id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error || copy.errDeleteDoc);
        return;
      }
      setMessage(copy.deletedMsg);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.errDeleteDoc);
    }
  }

  if (forbidden || (!clientsLoading && !hasAccess)) {
    return (
      <div className="min-h-screen bg-(--page-bg,#ffffff) px-6 py-10 text-(--page-text,#0b1a3c)">
        <div className="mx-auto flex min-h-[60vh] max-w-md items-center justify-center">
          <div className="w-full rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-8 text-center shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-(--tc-text-muted,#6b7280)">{copy.forbiddenKicker}</p>
            <h1 className="mt-3 text-2xl font-extrabold text-(--tc-text-primary,#0b1a3c)">{copy.forbiddenTitle}</h1>
            <p className="mt-3 text-sm leading-6 text-(--tc-text-secondary,#4b5563)">
              {copy.forbiddenDesc}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-(--page-bg,#ffffff) text-(--page-text,#0b1a3c)">
      <div className="flex w-full flex-col gap-6 py-6">
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
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-(--tc-text-muted,#6b7280)">{copy.fileKicker}</p>
                <h2 className="mt-2 text-2xl font-bold text-(--tc-text-primary,#0b1a3c)">{copy.fileTitle}</h2>
                <p className="mt-2 max-w-2xl text-sm text-(--tc-text-secondary,#4b5563)">
                  {copy.fileDesc}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setComposer(null)}
                className="inline-flex items-center rounded-xl border border-(--tc-border,#d7deea) px-3 py-2 text-sm font-semibold text-(--tc-text-secondary,#4b5563) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)"
              >
                {copy.close}
              </button>
            </div>
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">{copy.labelTitle}</span>
                <input
                  data-testid="doc-file-title"
                  value={fileTitle}
                  onChange={(event) => setFileTitle(event.target.value)}
                  placeholder={copy.placeholderFileTitle}
                  className="w-full rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-3 text-sm text-(--tc-text-primary,#0b1a3c) outline-none transition focus:border-(--tc-accent,#ef0001)"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">{copy.labelFile}</span>
                <input
                  data-testid="doc-file-input"
                  type="file"
                  onChange={(event) => setUploadFile(event.currentTarget.files?.[0] ?? null)}
                  className="w-full rounded-2xl border border-dashed border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) px-4 py-[0.9rem] text-sm text-(--tc-text-secondary,#4b5563) outline-none transition file:mr-3 file:rounded-xl file:border-0 file:bg-(--tc-accent,#ef0001) file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white focus:border-(--tc-accent,#ef0001)"
                />
              </label>
              <label className="space-y-2 lg:col-span-2">
                <span className="text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">{copy.labelDescription}</span>
                <textarea
                  data-testid="doc-file-description"
                  value={fileDescription}
                  onChange={(event) => setFileDescription(event.target.value)}
                  rows={4}
                  placeholder={copy.placeholderFileDesc}
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
                {copy.cancel}
              </button>
              <button
                data-testid="doc-file-submit"
                type="button"
                disabled={submitting}
                onClick={() => void submitFile()}
                className="inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(90deg,#071e53_0%,#ef0001_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(239,0,1,0.18)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiUploadCloud className="h-4 w-4" /> {submitting ? copy.submittingFile : copy.saveFile}
              </button>
            </div>
          </section>
        ) : null}

        {composer === "link" ? (
          <section className="rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-(--tc-text-muted,#6b7280)">{copy.linkKicker}</p>
                <h2 className="mt-2 text-2xl font-bold text-(--tc-text-primary,#0b1a3c)">{copy.linkTitle}</h2>
                <p className="mt-2 max-w-2xl text-sm text-(--tc-text-secondary,#4b5563)">
                  {copy.linkDesc}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setComposer(null)}
                className="inline-flex items-center rounded-xl border border-(--tc-border,#d7deea) px-3 py-2 text-sm font-semibold text-(--tc-text-secondary,#4b5563) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)"
              >
                {copy.close}
              </button>
            </div>
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">{copy.labelTitle}</span>
                <input
                  data-testid="doc-link-title"
                  value={linkTitle}
                  onChange={(event) => setLinkTitle(event.target.value)}
                  placeholder={copy.placeholderLinkTitle}
                  className="w-full rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-3 text-sm text-(--tc-text-primary,#0b1a3c) outline-none transition focus:border-(--tc-accent,#ef0001)"
                />
              </label>
              <div className="space-y-2">
                <span className="text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">{copy.labelUrl}</span>
                <input
                  data-testid="doc-link-url"
                  value={linkUrl}
                  onChange={(event) => setLinkUrl(event.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-3 text-sm text-(--tc-text-primary,#0b1a3c) outline-none transition focus:border-(--tc-accent,#ef0001)"
                />
                {linkUrl.trim() ? (
                  <a
                    href={safeHref(linkUrl.trim())}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-(--tc-accent,#ef0001) hover:underline"
                  >
                    <FiExternalLink className="h-3 w-3" /> {copy.previewLink}
                  </a>
                ) : null}
              </div>
              <label className="space-y-2 lg:col-span-2">
                <span className="text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">{copy.labelDescription}</span>
                <textarea
                  data-testid="doc-link-description"
                  value={linkDescription}
                  onChange={(event) => setLinkDescription(event.target.value)}
                  rows={4}
                  placeholder={copy.placeholderLinkDesc}
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
                {copy.cancel}
              </button>
              <button
                data-testid="doc-link-submit"
                type="button"
                disabled={submitting}
                onClick={() => void submitLink()}
                className="inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(90deg,#071e53_0%,#ef0001_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(239,0,1,0.18)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiLink2 className="h-4 w-4" /> {submitting ? copy.submittingLink : copy.saveLink}
              </button>
            </div>
          </section>
        ) : null}

        {editing !== null ? (
          <section className="rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-(--tc-text-muted,#6b7280)">{copy.editKicker}</p>
                <h2 className="mt-2 text-2xl font-bold text-(--tc-text-primary,#0b1a3c)">{copy.editTitle} — {editing.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="inline-flex items-center rounded-xl border border-(--tc-border,#d7deea) px-3 py-2 text-sm font-semibold text-(--tc-text-secondary,#4b5563) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)"
              >
                {copy.close}
              </button>
            </div>
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <label className={`space-y-2${editing.kind === "file" ? " lg:col-span-2" : ""}`}>
                <span className="text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">{copy.labelTitle}</span>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-3 text-sm text-(--tc-text-primary,#0b1a3c) outline-none transition focus:border-(--tc-accent,#ef0001)"
                />
              </label>
              {editing.kind === "link" ? (
                <div className="space-y-2">
                  <span className="text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">{copy.labelUrl}</span>
                  <input
                    aria-label={copy.labelUrl}
                    value={editUrl}
                    onChange={(e) => setEditUrl(e.target.value)}
                    className="w-full rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-3 text-sm text-(--tc-text-primary,#0b1a3c) outline-none transition focus:border-(--tc-accent,#ef0001)"
                  />
                  {editUrl.trim() ? (
                    <a
                      href={safeHref(editUrl.trim())}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-(--tc-accent,#ef0001) hover:underline"
                    >
                      <FiExternalLink className="h-3 w-3" /> {copy.previewLink}
                    </a>
                  ) : null}
                </div>
              ) : null}
              <label className="space-y-2 lg:col-span-2">
                <span className="text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">{copy.labelDescription}</span>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={4}
                  className="w-full rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-3 text-sm text-(--tc-text-primary,#0b1a3c) outline-none transition focus:border-(--tc-accent,#ef0001)"
                />
              </label>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-2xl border border-(--tc-border,#d7deea) px-4 py-3 text-sm font-semibold text-(--tc-text-secondary,#4b5563) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)"
              >
                {copy.cancel}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void submitEdit()}
                className="inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(90deg,#071e53_0%,#ef0001_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(239,0,1,0.18)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiEdit2 className="h-4 w-4" /> {submitting ? copy.savingEdit : copy.saveEdit}
              </button>
            </div>
          </section>
        ) : null}

        <section className="rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:p-6">
          <div className="flex flex-col gap-4 border-b border-(--tc-border,#d7deea) pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-(--tc-text-muted,#6b7280)">{copy.repoKicker}</p>
              <h2 className="mt-2 text-2xl font-bold text-(--tc-text-primary,#0b1a3c)">{copy.repoTitle}</h2>
              <p className="mt-2 text-sm text-(--tc-text-secondary,#4b5563)">
                {copy.repoDesc}
              </p>
              {canManage ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(null);
                      setComposer((current) => (current === "file" ? null : "file"));
                      setMessage(null);
                      setError(null);
                    }}
                    className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                      composer === "file"
                        ? "border-(--tc-accent,#ef0001) bg-(--tc-accent,#ef0001) text-white"
                        : "border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) text-(--tc-text-primary,#0b1a3c) hover:border-(--tc-accent,#ef0001)"
                    }`}
                  >
                    <FiUploadCloud className="h-4 w-4" /> {copy.addFile}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(null);
                      setComposer((current) => (current === "link" ? null : "link"));
                      setMessage(null);
                      setError(null);
                    }}
                    className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                      composer === "link"
                        ? "border-(--tc-accent,#ef0001) bg-(--tc-accent,#ef0001) text-white"
                        : "border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) text-(--tc-text-primary,#0b1a3c) hover:border-(--tc-accent,#ef0001)"
                    }`}
                  >
                    <FiPlus className="h-4 w-4" /> {copy.addLink}
                  </button>
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) px-3 py-2 font-semibold text-(--tc-text-secondary,#4b5563)">
                {copy.itemsLabel(documents.length)}
              </span>
              <span className="rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) px-3 py-2 font-semibold text-(--tc-text-secondary,#4b5563)">
                {copy.filesCount(fileCount)}
              </span>
              <span className="rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) px-3 py-2 font-semibold text-(--tc-text-secondary,#4b5563)">
                {copy.linksCount(linkCount)}
              </span>
            </div>
          </div>

          {loading ? (
            <div className="grid gap-4 pt-6 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="rounded-3xl border border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) p-5">
                  <div className="h-4 w-24 animate-pulse rounded-full bg-slate-200" />
                  <div className="mt-4 h-6 w-2/3 animate-pulse rounded-full bg-slate-200" />
                  <div className="mt-3 h-4 w-full animate-pulse rounded-full bg-slate-200" />
                  <div className="mt-2 h-4 w-4/5 animate-pulse rounded-full bg-slate-200" />
                </div>
              ))}
            </div>
          ) : documents.length === 0 ? (
            <div className="flex min-h-65 flex-col items-center justify-center gap-4 py-10 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) text-(--tc-text-muted,#6b7280)">
                <FiFileText className="h-7 w-7" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-(--tc-text-primary,#0b1a3c)">{copy.emptyTitle}</h3>
                <p className="max-w-xl text-sm leading-6 text-(--tc-text-secondary,#4b5563)">
                  {canManage
                    ? copy.emptyDescManage
                    : copy.emptyDescView}
                </p>
              </div>
            </div>
          ) : (
            <div data-testid="document-list" className="grid gap-4 pt-6 md:grid-cols-2 xl:grid-cols-3">
              {documents.map((item) => {
                const external = isLinkDocument(item);
                const href = safeHref(item.url || "");
                return (
                  <article
                    key={item.id}
                    className="flex h-full flex-col rounded-3xl border border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]"
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
                          {item.kind === "file" ? copy.fileLabel : copy.linkLabel}
                        </span>
                        <div>
                          <h3 className="text-lg font-bold leading-6 text-(--tc-text-primary,#0b1a3c)">{item.title}</h3>
                          {item.description ? (
                            <p className="mt-2 text-sm leading-6 text-(--tc-text-secondary,#4b5563)">{item.description}</p>
                          ) : (
                            <p className="mt-2 text-sm leading-6 text-(--tc-text-muted,#6b7280)">{copy.noDescDoc}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 rounded-2xl border border-(--tc-border,#d7deea) bg-white p-4 text-sm text-(--tc-text-secondary,#4b5563)">
                      <span className="whitespace-nowrap font-semibold text-(--tc-text-primary,#0b1a3c)">{copy.addedAt}</span>
                      <span className="text-right">{formatDate(item.createdAt)}</span>

                      <span className="whitespace-nowrap font-semibold text-(--tc-text-primary,#0b1a3c)">{copy.addedBy}</span>
                      <span className="text-right">{item.createdByName || copy.systemUser}</span>

                      {item.kind === "file" ? (
                        <>
                          <span className="whitespace-nowrap font-semibold text-(--tc-text-primary,#0b1a3c)">{copy.fileField}</span>
                          <span className="min-w-0 wrap-break-word text-right">{item.fileName || copy.fileLabel}</span>

                          <span className="whitespace-nowrap font-semibold text-(--tc-text-primary,#0b1a3c)">{copy.sizeField}</span>
                          <span className="text-right">{formatBytes(item.sizeBytes)}</span>
                        </>
                      ) : (
                        <>
                          <span className="whitespace-nowrap font-semibold text-(--tc-text-primary,#0b1a3c)">{copy.destinationField}</span>
                          <span className="min-w-0 wrap-break-word text-right">{item.url}</span>
                        </>
                      )}
                    </div>

                    <div className="mt-5 flex flex-wrap items-center gap-2">
                      {external ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-xl border border-(--tc-border,#d7deea) bg-white px-3 py-2 text-sm font-semibold text-(--tc-text-primary,#0b1a3c) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)"
                        >
                          <FiExternalLink className="h-4 w-4" /> {copy.openLink}
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setViewerItem(item);
                            setViewerOpen(true);
                          }}
                          className="inline-flex items-center gap-2 rounded-xl border border-(--tc-border,#d7deea) bg-white px-3 py-2 text-sm font-semibold text-(--tc-text-primary,#0b1a3c) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)"
                        >
                          <FiExternalLink className="h-4 w-4" /> {copy.openFile}
                        </button>
                      )}
                      {external ? (
                        <button
                          type="button"
                          onClick={() => void handleCopyLink(item.url || "")}
                          className="inline-flex items-center gap-2 rounded-xl border border-(--tc-border,#d7deea) bg-white px-3 py-2 text-sm font-semibold text-(--tc-text-primary,#0b1a3c) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)"
                        >
                          <FiCopy className="h-4 w-4" /> {copy.copyLink}
                        </button>
                      ) : null}
                      {canManage ? (
                        <button
                          type="button"
                          onClick={() => {
                            setComposer(null);
                            setEditing(item);
                            setEditTitle(item.title);
                            setEditDesc(item.description ?? "");
                            setEditUrl(item.url ?? "");
                          }}
                          className="inline-flex items-center gap-2 rounded-xl border border-(--tc-border,#d7deea) bg-white px-3 py-2 text-sm font-semibold text-(--tc-text-primary,#0b1a3c) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)"
                        >
                          <FiEdit2 className="h-4 w-4" /> {copy.editBtn}
                        </button>
                      ) : null}
                      {canManage ? (
                        <button
                          type="button"
                          title={copy.deleteBtn}
                          aria-label={copy.deleteBtn}
                          onClick={() => setDeletingId(item.id)}
                          className="inline-flex items-center justify-center rounded-xl border border-red-200 bg-red-50 p-2 text-red-600 transition hover:border-red-300 hover:bg-red-100"
                        >
                          <FiTrash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <DocumentViewer
          open={viewerOpen}
          item={viewerItem}
          slug={slug}
          onClose={() => setViewerOpen(false)}
          copy={copy}
        />

        {deletingId !== null ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setDeletingId(null); }}
          >
            <div className="w-full max-w-sm rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-6 shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-100 bg-red-50 text-red-600">
                <FiTrash2 className="h-5 w-5" />
              </div>
              <h2 id="delete-modal-title" className="mt-4 text-xl font-bold text-(--tc-text-primary,#0b1a3c)">{copy.deleteModalTitle}</h2>
              <p className="mt-2 text-sm leading-6 text-(--tc-text-secondary,#4b5563)">{copy.deleteModalDesc}</p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeletingId(null)}
                  className="rounded-2xl border border-(--tc-border,#d7deea) px-4 py-2.5 text-sm font-semibold text-(--tc-text-secondary,#4b5563) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)"
                >
                  {copy.deleteModalCancel}
                </button>
                <button
                  type="button"
                  onClick={() => void deleteDocument(deletingId)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-red-300 bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
                >
                  <FiTrash2 className="h-4 w-4" /> {copy.deleteModalConfirm}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function currentCompanyHref(slug: string) {
  const normalized = slug.trim();
  return normalized ? "../home" : "/admin/clients";
}

function getInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "EM";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[parts.length - 1].slice(0, 1)}`.toUpperCase();
}
