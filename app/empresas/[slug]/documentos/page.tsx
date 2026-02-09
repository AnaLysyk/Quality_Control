"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FiExternalLink, FiFileText, FiLink2, FiUpload } from "react-icons/fi";
import Breadcrumb from "@/components/Breadcrumb";
import { useClientContext } from "@/context/ClientContext";

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
};

type DocumentHistoryEvent = {
  id: string;
  documentId: string;
  action: "created" | "deleted";
  kind: "file" | "link";
  title: string;
  description?: string | null;
  url?: string | null;
  fileName?: string | null;
  createdAt: string;
  actorId?: string | null;
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

  const companyName = useMemo(() => {
    const found = clients.find((client) => client.slug === slug);
    return found?.name || slug || "Empresa";
  }, [clients, slug]);

  const [items, setItems] = useState<DocumentItem[]>([]);
  const [historyItems, setHistoryItems] = useState<DocumentHistoryEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<"file" | "link">("file");
  const [submitting, setSubmitting] = useState(false);

  const [fileTitle, setFileTitle] = useState("");
  const [fileDescription, setFileDescription] = useState("");
  const [fileUpload, setFileUpload] = useState<File | null>(null);

  const [linkTitle, setLinkTitle] = useState("");
  const [linkDescription, setLinkDescription] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const res = await fetch(`/api/company-documents?slug=${encodeURIComponent(slug)}`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json().catch(() => ({}))) as { items?: DocumentItem[]; error?: string };
      if (!res.ok) {
        setItems([]);
        if (res.status === 401 || res.status === 403) {
          setForbidden(true);
        }
        setError(json?.error || "Erro ao carregar documentos");
        return;
      }
      setItems(Array.isArray(json.items) ? json.items : []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar documentos";
      setItems([]);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  const loadHistory = useCallback(async () => {
    if (!slug) return;
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await fetch(`/api/company-documents?slug=${encodeURIComponent(slug)}&history=1`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json().catch(() => ({}))) as { history?: DocumentHistoryEvent[]; error?: string };
      if (!res.ok) {
        setHistoryItems([]);
        if (res.status === 401 || res.status === 403) {
          setForbidden(true);
        }
        setHistoryError(json?.error || "Erro ao carregar historico");
        return;
      }
      setHistoryItems(Array.isArray(json.history) ? json.history : []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar historico";
      setHistoryItems([]);
      setHistoryError(msg);
    } finally {
      setHistoryLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (!clientsLoading && !hasAccess) {
      setItems([]);
      setHistoryItems([]);
      setLoading(false);
      setHistoryLoading(false);
      setError("Acesso negado");
      setHistoryError(null);
      setForbidden(true);
      return;
    }
    load();
    loadHistory();
  }, [load, loadHistory, clientsLoading, hasAccess]);

  async function submitFile() {
    if (!slug) return;
    setError(null);
    setMessage(null);

    if (!fileUpload) {
      setError("Selecione um arquivo");
      return;
    }

    setSubmitting(true);
    try {
      const form = new FormData();
      form.set("slug", slug);
      form.set("title", (fileTitle.trim() || fileUpload.name).slice(0, 120));
      form.set("description", fileDescription.trim());
      form.set("file", fileUpload);

      const res = await fetch("/api/company-documents", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || "Erro ao anexar documento");
        return;
      }
      setFileTitle("");
      setFileDescription("");
      setFileUpload(null);
      setMessage("Documento anexado com sucesso.");
      await load();
      await loadHistory();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao anexar documento";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitLink() {
    if (!slug) return;
    setError(null);
    setMessage(null);

    const url = linkUrl.trim();
    if (!url) {
      setError("Informe o link");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/company-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          slug,
          kind: "link",
          title: (linkTitle.trim() || "Link").slice(0, 120),
          description: linkDescription.trim(),
          url,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || "Erro ao salvar link");
        return;
      }
      setLinkTitle("");
      setLinkDescription("");
      setLinkUrl("");
      setMessage("Link salvo com sucesso.");
      await load();
      await loadHistory();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar link";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteDocument(id: string) {
    if (!slug) return;
    const confirmed = window.confirm("Deseja realmente excluir este documento?");
    if (!confirmed) return;
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/company-documents?slug=${encodeURIComponent(slug)}&id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || "Erro ao excluir documento");
        return;
      }
      setMessage("Documento excluido.");
      await load();
      await loadHistory();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao excluir documento";
      setError(msg);
    }
  }

  if (forbidden || (!clientsLoading && !hasAccess)) {
    return (
      <div className="min-h-screen bg-(--page-bg,#ffffff) text-(--page-text,#0b1a3c) flex items-center justify-center px-6">
        <div className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) p-6 text-center shadow-sm max-w-md">
          <p className="text-xs uppercase tracking-[0.3em] text-(--tc-text-muted,#6b7280)">Documentos</p>
          <h1 className="mt-2 text-xl font-semibold text-(--tc-text-primary,#0b1a3c)">Acesso negado</h1>
          <p className="mt-2 text-sm text-(--tc-text-secondary,#4b5563)">
            Voce nao tem permissao para visualizar documentos desta empresa.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-(--page-bg,#ffffff) text-(--page-text,#0b1a3c)">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10 space-y-6">
        <Breadcrumb items={[{ label: "Documentacoes", href: "/documentos" }, { label: companyName }]} />

        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-(--tc-text-muted,#6b7280)">Empresa</p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-(--tc-text-primary,#0b1a3c)">
            Documentos de {companyName}
          </h1>
          <p className="text-sm text-(--tc-text-secondary,#4b5563)">
            Anexe arquivos ou salve links com titulo e descricao.
          </p>
        </header>

        <section className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-(--tc-text-primary,#0b1a3c)">Novo documento</h2>
              <p className="text-sm text-(--tc-text-muted,#6b7280)">
                Voce pode anexar um arquivo ou salvar um link.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTab("file")}
                data-testid="doc-tab-file"
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  tab === "file"
                    ? "bg-(--tc-accent,#ef0001) text-(--tc-text-inverse,#ffffff)"
                    : "border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) text-(--tc-text-primary,#0b1a3c)"
                }`}
              >
                Anexar arquivo
              </button>
              <button
                type="button"
                onClick={() => setTab("link")}
                data-testid="doc-tab-link"
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  tab === "link"
                    ? "bg-(--tc-accent,#ef0001) text-(--tc-text-inverse,#ffffff)"
                    : "border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) text-(--tc-text-primary,#0b1a3c)"
                }`}
              >
                Salvar link
              </button>
            </div>
          </div>

          {tab === "file" ? (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm text-(--tc-text) flex flex-col gap-1">
                Titulo
                <input
                  className="rounded-lg border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--tc-accent,#ef0001)/30"
                  value={fileTitle}
                  onChange={(e) => setFileTitle(e.target.value)}
                  placeholder="Ex.: Manual de integracao"
                  data-testid="doc-file-title"
                />
              </label>
              <label className="text-sm text-(--tc-text) flex flex-col gap-1">
                Descricao
                <input
                  className="rounded-lg border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--tc-accent,#ef0001)/30"
                  value={fileDescription}
                  onChange={(e) => setFileDescription(e.target.value)}
                  placeholder="Resumo rapido do documento"
                  data-testid="doc-file-description"
                />
              </label>
              <label className="text-sm text-(--tc-text) flex flex-col gap-1 md:col-span-2">
                Arquivo
                <input
                  type="file"
                  className="rounded-lg border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) px-3 py-2 text-sm"
                  onChange={(e) => setFileUpload(e.target.files?.[0] ?? null)}
                  data-testid="doc-file-input"
                />
              </label>
              <div className="md:col-span-2 flex justify-end">
                <button
                  type="button"
                  onClick={submitFile}
                  disabled={submitting}
                  data-testid="doc-file-submit"
                  className="inline-flex items-center gap-2 rounded-lg bg-(--tc-accent,#ef0001) px-4 py-2 text-sm font-semibold text-(--tc-text-inverse,#ffffff) disabled:opacity-60"
                >
                  <FiUpload aria-hidden />
                  {submitting ? "Enviando..." : "Anexar"}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm text-(--tc-text) flex flex-col gap-1">
                Titulo
                <input
                  className="rounded-lg border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--tc-accent,#ef0001)/30"
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                  placeholder="Ex.: Checklist de deploy"
                  data-testid="doc-link-title"
                />
              </label>
              <label className="text-sm text-(--tc-text) flex flex-col gap-1">
                Descricao
                <input
                  className="rounded-lg border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--tc-accent,#ef0001)/30"
                  value={linkDescription}
                  onChange={(e) => setLinkDescription(e.target.value)}
                  placeholder="Resumo do link"
                  data-testid="doc-link-description"
                />
              </label>
              <label className="text-sm text-(--tc-text) flex flex-col gap-1 md:col-span-2">
                URL
                <input
                  className="rounded-lg border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--tc-accent,#ef0001)/30"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://..."
                  data-testid="doc-link-url"
                />
              </label>
              <div className="md:col-span-2 flex justify-end">
                <button
                  type="button"
                  onClick={submitLink}
                  disabled={submitting}
                  data-testid="doc-link-submit"
                  className="inline-flex items-center gap-2 rounded-lg bg-(--tc-accent,#ef0001) px-4 py-2 text-sm font-semibold text-(--tc-text-inverse,#ffffff) disabled:opacity-60"
                >
                  <FiLink2 aria-hidden />
                  {submitting ? "Salvando..." : "Salvar link"}
                </button>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && <p className="text-sm text-green-600">{message}</p>}
        </section>

        <section className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-(--tc-text-primary,#0b1a3c)">Documentos anexados</h2>
              <p className="text-sm text-(--tc-text-muted,#6b7280)">
                Arquivos e links salvos pela empresa.
              </p>
            </div>
            <Link
              href="/docs"
              className="text-sm font-semibold text-(--tc-accent,#ef0001) hover:underline"
            >
              Ver docs da plataforma
            </Link>
          </div>

          {loading && <p className="text-sm text-(--tc-text-muted,#6b7280)">Carregando documentos...</p>}
          {!loading && items.length === 0 && (
            <p className="text-sm text-(--tc-text-muted,#6b7280)">Nenhum documento anexado ainda.</p>
          )}

          <div className="grid gap-3 md:grid-cols-2" data-testid="document-list">
            {items.map((item) => {
              const isFile = item.kind === "file";
              const icon = isFile ? <FiFileText aria-hidden /> : <FiLink2 aria-hidden />;
              const meta = isFile ? `${item.fileName || "Arquivo"} · ${formatBytes(item.sizeBytes)}` : item.url || "";

              return (
                <article
                  key={item.id}
                  className="rounded-xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) p-4 space-y-2"
                  data-testid="document-item"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) text-(--tc-text-primary,#0b1a3c)">
                        {icon}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">{item.title}</p>
                        {meta && <p className="text-xs text-(--tc-text-muted,#6b7280) break-all">{meta}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-semibold text-(--tc-accent,#ef0001) hover:underline"
                        >
                          Abrir <FiExternalLink size={14} />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteDocument(item.id)}
                        className="text-xs font-semibold uppercase tracking-[0.2em] text-(--tc-text-muted,#6b7280) hover:text-(--tc-accent,#ef0001)"
                        data-testid="document-delete"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>

                  {item.description && (
                    <p className="text-sm text-(--tc-text-secondary,#4b5563)">{item.description}</p>
                  )}
                  <p className="text-xs text-(--tc-text-muted,#6b7280)">
                    Criado em {new Date(item.createdAt).toLocaleString("pt-BR")}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) p-5 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-(--tc-text-primary,#0b1a3c)">Historico</h2>
            <p className="text-sm text-(--tc-text-muted,#6b7280)">
              Registro de criacoes e exclusoes.
            </p>
          </div>

          {historyLoading && (
            <p className="text-sm text-(--tc-text-muted,#6b7280)">Carregando historico...</p>
          )}
          {!historyLoading && historyItems.length === 0 && (
            <p className="text-sm text-(--tc-text-muted,#6b7280)">Nenhuma atividade registrada.</p>
          )}

          <div className="grid gap-3" data-testid="document-history">
            {historyItems.map((event) => {
              const label = event.action === "deleted" ? "Excluido" : "Criado";
              const kindLabel = event.kind === "file" ? "Arquivo" : "Link";
              return (
                <div
                  key={event.id}
                  className="rounded-xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">
                        {label}: {event.title}
                      </p>
                      <p className="text-xs text-(--tc-text-muted,#6b7280)">
                        {kindLabel} • {new Date(event.createdAt).toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <span className="text-[10px] uppercase tracking-[0.35em] text-(--tc-text-muted,#6b7280)">
                      {event.action}
                    </span>
                  </div>
                  {event.description && (
                    <p className="mt-2 text-sm text-(--tc-text-secondary,#4b5563)">{event.description}</p>
                  )}
                  {event.actorId && (
                    <p className="mt-1 text-xs text-(--tc-text-muted,#6b7280)">Usuario: {event.actorId}</p>
                  )}
                </div>
              );
            })}
          </div>

          {historyError && <p className="text-sm text-red-600">{historyError}</p>}
        </section>
      </div>
    </div>
  );
}
