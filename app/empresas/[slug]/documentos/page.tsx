"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";


type CompanyDocumentItem = {
  id: string;
  companySlug: string;
  kind: "file" | "link";
  title: string;
  description?: string | null;
  url?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  createdAt: string;
};

function formatBytes(size: number | null | undefined) {
  if (!size || size <= 0) return "";
  const kb = size / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

export default function DocumentosPage() {
  const { slug } = useParams<{ slug: string }>();
  const companySlug = String(slug || "").toLowerCase();

  const [items, setItems] = useState<CompanyDocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkDescription, setLinkDescription] = useState("");
  const [savingLink, setSavingLink] = useState(false);

  const [fileTitle, setFileTitle] = useState("");
  const [fileDescription, setFileDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const linkFormRef = useRef<HTMLDivElement | null>(null);

  const canSubmitLink = useMemo(
    () => linkTitle.trim().length > 0 && linkUrl.trim().length > 0,
    [linkTitle, linkUrl]
  );
  const canSubmitFile = useMemo(() => !!file, [file]);

  const load = useCallback(async () => {
    if (!companySlug) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/company-documents?slug=${encodeURIComponent(companySlug)}`, {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        setItems([]);
        setError(json?.error || `Erro ao carregar (${res.status})`);
        return;
      }
      const next = Array.isArray(json?.items) ? (json.items as CompanyDocumentItem[]) : [];
      setItems(next);
    } catch (e: any) {
      setItems([]);
      setError(e?.message || "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, [companySlug]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addLink() {
    if (!canSubmitLink) return;
    setSavingLink(true);
    setError(null);
    try {
      const res = await fetch("/api/company-documents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: companySlug,
          kind: "link",
          title: linkTitle.trim(),
          url: linkUrl.trim(),
          description: linkDescription.trim() || undefined,
        }),
      });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        setError(json?.error || `Erro ao salvar (${res.status})`);
        return;
      }
      setLinkTitle("");
      setLinkUrl("");
      setLinkDescription("");
      await load();
    } finally {
      setSavingLink(false);
    }
  }

  async function uploadFile() {
    if (!file || !companySlug) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("slug", companySlug);
      form.set("title", (fileTitle.trim() || file.name).slice(0, 120));
      if (fileDescription.trim()) form.set("description", fileDescription.trim());
      form.set("file", file);

      const res = await fetch("/api/company-documents", { method: "POST", body: form });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        setError(json?.error || `Erro ao anexar (${res.status})`);
        return;
      }
      setFileTitle("");
      setFileDescription("");
      setFile(null);
      await load();
    } finally {
      setUploading(false);
    }
  }

  async function removeItem(item: CompanyDocumentItem) {
    if (!confirm(`Remover "${item.title}"?`)) return;
    setError(null);
    const res = await fetch(
      `/api/company-documents?slug=${encodeURIComponent(companySlug)}&id=${encodeURIComponent(item.id)}`,
      { method: "DELETE" }
    );
    const json = (await res.json().catch(() => null)) as any;
    if (!res.ok) {
      setError(json?.error || `Erro ao remover (${res.status})`);
      return;
    }
    await load();
  }

  return (
    <main className="min-h-screen bg-(--page-bg,#ffffff) text-(--page-text,#0b1a3c)">
      <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-(--tc-text-muted)">Documentos</p>
          <h1 className="text-2xl font-bold text-(--tc-text)">Empresa: {slug}</h1>
          <p className="mt-1 text-sm text-(--tc-text-muted)">
            Links e anexos privados desta empresa (admin global também acessa).
          </p>
        </div>
        <Link
          href="/docs"
          className="rounded-lg border border-(--tc-border) bg-(--tc-surface) px-3 py-2 text-sm text-(--tc-text) hover:bg-(--tc-surface-2)"
        >
          Documentações
        </Link>
      </div>
      <div className="mb-6 flex flex-col gap-2 text-sm text-(--tc-text-muted)">
        <p>Quer anexar um arquivo sem ocupar storage próprio? Utilize o botão abaixo para registrar apenas o link.</p>
        <button
          type="button"
          onClick={() => linkFormRef.current?.scrollIntoView({ behavior: "smooth" })}
          className="inline-flex items-center justify-center rounded-lg border border-(--tc-border) bg-(--tc-surface) px-4 py-2 text-sm font-semibold text-(--tc-text) hover:bg-(--tc-surface-2)"
        >
          Anexar como link (sem consumir armazenamento)
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-(--tc-border) bg-(--tc-surface) p-5">
          <h2 className="text-base font-semibold text-(--tc-text)">Anexar arquivo</h2>
          <div className="mt-4 space-y-3">
            <div>
              <label htmlFor="doc-file-title" className="block text-sm text-(--tc-text-muted)">
                Título (opcional)
              </label>
              <input
                id="doc-file-title"
                value={fileTitle}
                onChange={(e) => setFileTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg) px-3 py-2 text-sm text-(--tc-text) placeholder:text-(--tc-text-muted) focus:outline-none focus:ring-2 focus:ring-(--tc-accent)/30"
                placeholder="Ex.: Contrato, SLA, Requisitos"
              />
            </div>
            <div>
              <label htmlFor="doc-file-description" className="block text-sm text-(--tc-text-muted)">
                Descrição (opcional)
              </label>
              <input
                id="doc-file-description"
                value={fileDescription}
                onChange={(e) => setFileDescription(e.target.value)}
                className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg) px-3 py-2 text-sm text-(--tc-text) placeholder:text-(--tc-text-muted) focus:outline-none focus:ring-2 focus:ring-(--tc-accent)/30"
                placeholder="Notas rápidas…"
              />
            </div>
            <div>
              <label htmlFor="doc-file-input" className="block text-sm text-(--tc-text-muted)">
                Arquivo
              </label>
              <input
                id="doc-file-input"
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="mt-1 block w-full text-sm text-(--tc-text) file:mr-3 file:rounded-lg file:border-0 file:bg-(--tc-surface-2) file:px-3 file:py-2 file:text-sm file:font-semibold file:text-(--tc-text) hover:file:bg-(--tc-input-bg)"
              />
              <p className="mt-1 text-xs text-(--tc-text-muted)">PDF recomendado.</p>
            </div>
            <button
              disabled={!canSubmitFile || uploading}
              onClick={() => void uploadFile()}
              className="rounded-lg bg-(--tc-accent,#ef0001) px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {uploading ? "Anexando…" : "Anexar"}
            </button>
          </div>
        </div>

        <div
          ref={linkFormRef}
          className="rounded-2xl border border-(--tc-border) bg-(--tc-surface) p-5"
        >
          <h2 className="text-base font-semibold text-(--tc-text)">Adicionar link</h2>
          <div className="mt-4 space-y-3">
            <div>
              <label htmlFor="doc-link-title" className="block text-sm text-(--tc-text-muted)">
                Título
              </label>
              <input
                id="doc-link-title"
                value={linkTitle}
                onChange={(e) => setLinkTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg) px-3 py-2 text-sm text-(--tc-text) placeholder:text-(--tc-text-muted) focus:outline-none focus:ring-2 focus:ring-(--tc-accent)/30"
                placeholder="Ex.: Confluence, Drive, Jira"
              />
            </div>
            <div>
              <label htmlFor="doc-link-url" className="block text-sm text-(--tc-text-muted)">
                URL
              </label>
              <input
                id="doc-link-url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg) px-3 py-2 text-sm text-(--tc-text) placeholder:text-(--tc-text-muted) focus:outline-none focus:ring-2 focus:ring-(--tc-accent)/30"
                placeholder="https://…"
              />
            </div>
            <div>
              <label htmlFor="doc-link-description" className="block text-sm text-(--tc-text-muted)">
                Descrição (opcional)
              </label>
              <input
                id="doc-link-description"
                value={linkDescription}
                onChange={(e) => setLinkDescription(e.target.value)}
                className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg) px-3 py-2 text-sm text-(--tc-text) placeholder:text-(--tc-text-muted) focus:outline-none focus:ring-2 focus:ring-(--tc-accent)/30"
                placeholder="Notas rápidas…"
              />
            </div>
            <button
              disabled={!canSubmitLink || savingLink}
              onClick={() => void addLink()}
              className="rounded-lg bg-(--tc-accent,#ef0001) px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {savingLink ? "Salvando…" : "Salvar link"}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h2 className="text-base font-semibold text-(--tc-text)">Arquivos e links</h2>
        {loading ? (
          <p className="mt-2 text-sm text-(--tc-text-muted)">Carregando…</p>
        ) : items.length === 0 ? (
          <p className="mt-2 text-sm text-(--tc-text-muted)">Nenhum documento ainda.</p>
        ) : (
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => {
              const href = item.url || "";
              const isPdf =
                (item.mimeType || "").toLowerCase().includes("pdf") ||
                (item.fileName || "").toLowerCase().endsWith(".pdf");
              return (
                <div key={item.id} className="rounded-2xl border border-(--tc-border) bg-(--tc-surface) p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full border border-(--tc-border) bg-(--tc-surface-2) px-2.5 py-1 text-[11px] font-semibold text-(--tc-text)">
                          {item.kind === "file" ? (isPdf ? "PDF" : "ARQUIVO") : "LINK"}
                        </span>
                        <h3 className="text-sm font-semibold text-(--tc-text)">{item.title}</h3>
                      </div>
                      {item.description ? (
                        <p className="mt-2 text-xs text-(--tc-text-muted)">{item.description}</p>
                      ) : null}
                      <p className="mt-2 text-xs text-(--tc-text-muted)">
                        {item.kind === "file"
                          ? `${item.fileName || "arquivo"}${
                              item.sizeBytes ? ` • ${formatBytes(item.sizeBytes)}` : ""
                            }`
                          : item.url}
                      </p>
                    </div>
                    <button
                      onClick={() => void removeItem(item)}
                      className="rounded-lg border border-(--tc-border) bg-(--tc-surface) px-3 py-2 text-xs text-(--tc-text) hover:bg-(--tc-surface-2)"
                      title="Remover"
                      aria-label="Remover"
                    >
                      Remover
                    </button>
                  </div>

                  {href ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg bg-(--tc-accent,#ef0001) px-3 py-2 text-sm font-semibold text-white"
                      >
                        Abrir
                      </a>
                      {item.kind === "file" ? (
                        <a
                          href={href}
                          className="rounded-lg border border-(--tc-border) bg-(--tc-surface) px-3 py-2 text-sm text-(--tc-text) hover:bg-(--tc-surface-2)"
                          download
                        >
                          Baixar
                        </a>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-4 text-xs text-(--tc-text-muted)">
                      Link indisponível (storage não configurado).
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      </div>
    </main>
  );
}
