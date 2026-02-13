"use client";
// eslint rules kept normal; use real state names

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
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

function _formatBytes(bytes?: number | null) {
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

  const [_items, _setItems] = useState<DocumentItem[]>([]);
  const [_loading, _setLoading] = useState(false);
  const [_error, _setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [_message, _setMessage] = useState<string | null>(null);
  const [_tab, _setTab] = useState<"file" | "link">("file");
  const [_submitting, _setSubmitting] = useState(false);

  const [_fileTitle, _setFileTitle] = useState("");
  const [_fileDescription, _setFileDescription] = useState("");
  const [_fileUpload, _setFileUpload] = useState<File | null>(null);

  const [_linkTitle, _setLinkTitle] = useState("");
  const [_linkDescription, _setLinkDescription] = useState("");
  const [_linkUrl, _setLinkUrl] = useState("");

  const load = useCallback(async () => {
    if (!slug) return;
    _setLoading(true);
    _setError(null);
    try {
      const res = await fetch(`/api/company-documents?slug=${encodeURIComponent(slug)}`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json().catch(() => ({}))) as { items?: DocumentItem[]; error?: string };
      if (!res.ok) {
        _setItems([]);
        if (res.status === 401 || res.status === 403) {
          setForbidden(true);
        }
        _setError(json?.error || "Erro ao carregar documentos");
        return;
      }
      _setItems(Array.isArray(json.items) ? json.items : []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar documentos";
      _setItems([]);
      _setError(msg);
    } finally {
      _setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    // Wait until client list is resolved to decide access. Avoid calling load() while clients are still loading,
    // otherwise we may render documents for a company before access is determined (flaky in E2E).
    if (clientsLoading) return;
    if (!hasAccess) {
      _setItems([]);
      _setLoading(false);
      _setError("Acesso negado");
      setForbidden(true);
      return;
    }
    load();
  }, [load, clientsLoading, hasAccess]);

  async function submitFile() {
    if (!slug) return;
    _setError(null);
    _setMessage(null);

    // Try to read file from controlled state first, otherwise from the input element (ensures Playwright setInputFiles is respected)
    let file = _fileUpload;
    if (!file && typeof document !== "undefined") {
      const input = document.querySelector('[data-testid="doc-file-input"]') as HTMLInputElement | null;
      file = input?.files?.[0] ?? null;
    }

    if (!file) {
      _setError("Selecione um arquivo");
      return;
    }

    _setSubmitting(true);
    try {
      const form = new FormData();
      form.set("slug", slug);
      form.set("title", (_fileTitle.trim() || file.name).slice(0, 120));
      form.set("description", _fileDescription.trim());
      form.set("file", file as Blob);

      const res = await fetch("/api/company-documents", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        _setError(json?.error || "Erro ao anexar documento");
        return;
      }
      _setFileTitle("");
      _setFileDescription("");
      _setFileUpload(null);
      // also clear native input if present
      try {
        const input = document.querySelector('[data-testid="doc-file-input"]') as HTMLInputElement | null;
        if (input) input.value = "";
      } catch {}
      _setMessage("Documento anexado com sucesso.");
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao anexar documento";
      _setError(msg);
    } finally {
      _setSubmitting(false);
    }
  }

  async function submitLink() {
    if (!slug) return;
    _setError(null);
    _setMessage(null);

    const url = _linkUrl.trim();
    if (!url) {
      _setError("Informe o link");
      return;
    }

    _setSubmitting(true);
    try {
      const res = await fetch("/api/company-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          slug,
          kind: "link",
          title: (_linkTitle.trim() || "Link").slice(0, 120),
          description: _linkDescription.trim(),
          url,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        _setError(json?.error || "Erro ao salvar link");
        return;
      }
      _setLinkTitle("");
      _setLinkDescription("");
      _setLinkUrl("");
      _setMessage("Link salvo com sucesso.");
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar link";
      _setError(msg);
    } finally {
      _setSubmitting(false);
    }
  }

  async function deleteDocument(id: string) {
    if (!slug) return;
    const confirmed = window.confirm("Deseja realmente excluir este documento?");
    if (!confirmed) return;
    _setError(null);
    _setMessage(null);
    try {
      const res = await fetch(`/api/company-documents?slug=${encodeURIComponent(slug)}&id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        _setError(json?.error || "Erro ao excluir documento");
        return;
      }
      _setMessage("Documento excluido.");
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao excluir documento";
      _setError(msg);
    }
  }

  // mark intentionally-unused symbols as referenced so linters don't warn
  void _formatBytes;
  void _items;
  void _loading;
  void _error;
  void _message;
  void _tab;
  void _setTab;
  void _submitting;
  void _linkUrl;
  void submitFile;
  void submitLink;
  void deleteDocument;

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
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10">
          <div className="space-y-4">
            <div className="flex gap-3">
              <button
                data-testid="doc-tab-file"
                className={`px-3 py-1 rounded ${_tab === "file" ? "bg-slate-100" : "bg-white"}`}
                onClick={() => _setTab("file")}
              >
                Arquivo
              </button>
              <button
                data-testid="doc-tab-link"
                className={`px-3 py-1 rounded ${_tab === "link" ? "bg-slate-100" : "bg-white"}`}
                onClick={() => _setTab("link")}
              >
                Link
              </button>
            </div>

            {_tab === "file" ? (
              <div className="space-y-2">
                {_message && <div className="text-sm text-green-600">{_message}</div>}
                {_error && <div className="text-sm text-red-600">{_error}</div>}
                <input
                  data-testid="doc-file-title"
                  placeholder="Titulo"
                  aria-label="Titulo do documento"
                  title="Titulo do documento"
                  value={_fileTitle}
                  onChange={(e) => _setFileTitle(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                />
                <input
                  data-testid="doc-file-description"
                  placeholder="Descricao"
                  aria-label="Descricao do documento"
                  title="Descricao do documento"
                  value={_fileDescription}
                  onChange={(e) => _setFileDescription(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                />
                <input
                  data-testid="doc-file-input"
                  type="file"
                  aria-label="Selecionar arquivo para upload"
                  title="Selecionar arquivo para upload"
                  onChange={(e) => {
                    const f = e.currentTarget.files?.[0] ?? null;
                    _setFileUpload(f);
                  }}
                />
                <button data-testid="doc-file-submit" onClick={() => submitFile()} className="px-4 py-2 bg-(--tc-accent,#ef0001) text-white rounded">
                  Enviar
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {_message && <div className="text-sm text-green-600">{_message}</div>}
                {_error && <div className="text-sm text-red-600">{_error}</div>}
                <input
                  data-testid="doc-link-title"
                  placeholder="Titulo do link"
                  aria-label="Titulo do link"
                  title="Titulo do link"
                  value={_linkTitle}
                  onChange={(e) => _setLinkTitle(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                />
                <input
                  data-testid="doc-link-description"
                  placeholder="Descricao"
                  aria-label="Descricao do link"
                  title="Descricao do link"
                  value={_linkDescription}
                  onChange={(e) => _setLinkDescription(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                />
                <input
                  data-testid="doc-link-url"
                  placeholder="https://..."
                  aria-label="URL do link"
                  title="URL do link"
                  value={_linkUrl}
                  onChange={(e) => _setLinkUrl(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                />
                <button data-testid="doc-link-submit" onClick={() => submitLink()} className="px-4 py-2 bg-(--tc-accent,#ef0001) text-white rounded">
                  Salvar Link
                </button>
              </div>
            )}

            <div data-testid="document-list" className="space-y-2 mt-6">
              {_items.map((it) => (
                <div key={it.id} className="p-2 border rounded">
                  <div className="font-semibold">{it.title}</div>
                  <div className="text-sm text-slate-500">{it.description}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

