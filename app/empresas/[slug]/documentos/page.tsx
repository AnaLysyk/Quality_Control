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
  const { clients } = useClientContext();

  const companyName = useMemo(() => {
    const found = clients.find((client) => client.slug === slug);
    return found?.name || slug || "Empresa";
  }, [clients, slug]);

  const [items, setItems] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    try {
      const res = await fetch(`/api/company-documents?slug=${encodeURIComponent(slug)}`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json().catch(() => ({}))) as { items?: DocumentItem[]; error?: string };
      if (!res.ok) {
        setItems([]);
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

  useEffect(() => {
    load();
  }, [load]);

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
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar link";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
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
                />
              </label>
              <label className="text-sm text-(--tc-text) flex flex-col gap-1">
                Descricao
                <input
                  className="rounded-lg border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--tc-accent,#ef0001)/30"
                  value={fileDescription}
                  onChange={(e) => setFileDescription(e.target.value)}
                  placeholder="Resumo rapido do documento"
                />
              </label>
              <label className="text-sm text-(--tc-text) flex flex-col gap-1 md:col-span-2">
                Arquivo
                <input
                  type="file"
                  className="rounded-lg border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) px-3 py-2 text-sm"
                  onChange={(e) => setFileUpload(e.target.files?.[0] ?? null)}
                />
              </label>
              <div className="md:col-span-2 flex justify-end">
                <button
                  type="button"
                  onClick={submitFile}
                  disabled={submitting}
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
                />
              </label>
              <label className="text-sm text-(--tc-text) flex flex-col gap-1">
                Descricao
                <input
                  className="rounded-lg border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--tc-accent,#ef0001)/30"
                  value={linkDescription}
                  onChange={(e) => setLinkDescription(e.target.value)}
                  placeholder="Resumo do link"
                />
              </label>
              <label className="text-sm text-(--tc-text) flex flex-col gap-1 md:col-span-2">
                URL
                <input
                  className="rounded-lg border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--tc-accent,#ef0001)/30"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://..."
                />
              </label>
              <div className="md:col-span-2 flex justify-end">
                <button
                  type="button"
                  onClick={submitLink}
                  disabled={submitting}
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

          <div className="grid gap-3 md:grid-cols-2">
            {items.map((item) => {
              const isFile = item.kind === "file";
              const icon = isFile ? <FiFileText aria-hidden /> : <FiLink2 aria-hidden />;
              const meta = isFile ? `${item.fileName || "Arquivo"} · ${formatBytes(item.sizeBytes)}` : item.url || "";

              return (
                <article
                  key={item.id}
                  className="rounded-xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) p-4 space-y-2"
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
      </div>
    </div>
  );
}
