"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import Breadcrumb from "@/components/Breadcrumb";
import { useClientContext } from "@/context/ClientContext";

// Tipos de documento
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

// Formata bytes em string legível
function formatarBytes(bytes?: number | null) {
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

// Página principal de documentos da empresa
export default function CompanyDocumentsPage() {
  const params = useParams();
  const slugParam = params?.slug;
  const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam || "";
  const { clients, loading: clientsLoading } = useClientContext();

  // Verifica se o usuário tem acesso à empresa
  const temAcesso = useMemo(() => {
    if (!slug) return false;
    if (clientsLoading) return true;
    return clients.some((client) => client.slug === slug);
  }, [clients, clientsLoading, slug]);

  const nomeEmpresa = useMemo(() => {
    const found = clients.find((client) => client.slug === slug);
    return found?.name || slug || "Empresa";
  }, [clients, slug]);

  // Estados localizados em português
  const [documentos, setDocumentos] = useState<DocumentItem[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [proibido, setProibido] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [aba, setAba] = useState<"file" | "link">("file");
  const [submetendo, setSubmetendo] = useState(false);

  const [tituloArquivo, setTituloArquivo] = useState("");
  const [descricaoArquivo, setDescricaoArquivo] = useState("");
  const [arquivoUpload, setArquivoUpload] = useState<File | null>(null);

  const [tituloLink, setTituloLink] = useState("");
  const [descricaoLink, setDescricaoLink] = useState("");
  const [urlLink, setUrlLink] = useState("");

  // Carrega documentos da API
  const load = useCallback(async () => {
    if (!slug) return;
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/company-documents?slug=${encodeURIComponent(slug)}`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json().catch(() => ({}))) as { items?: DocumentItem[]; error?: string };
      if (!res.ok) {
        setDocumentos([]);
        if (res.status === 401 || res.status === 403) {
          setProibido(true);
        }
        setErro(json?.error || "Erro ao carregar documentos");
        return;
      }
      setDocumentos(Array.isArray(json.items) ? json.items : []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar documentos";
      setDocumentos([]);
      setErro(msg);
    } finally {
      setCarregando(false);
    }
  }, [slug]);

  useEffect(() => {
    // Aguarda lista de clientes ser carregada para decidir acesso; evita condições de corrida em E2E
    if (clientsLoading) return;
    if (!temAcesso) {
      setDocumentos([]);
      setCarregando(false);
      setErro("Acesso negado");
      setProibido(true);
      return;
    }
    load();
  }, [load, clientsLoading, temAcesso]);

  // Submete arquivo: suporta o state controlado e também leitura direta do input nativo (Playwright usa setInputFiles)
  async function submitFile() {
    if (!slug) return;
    setErro(null);
    setMensagem(null);

    let file = arquivoUpload;
    if (!file && typeof document !== "undefined") {
      const input = document.querySelector('[data-testid="doc-file-input"]') as HTMLInputElement | null;
      file = input?.files?.[0] ?? null;
    }

    if (!file) {
      setErro("Selecione um arquivo");
      return;
    }

    setSubmetendo(true);
    try {
      const form = new FormData();
      form.set("slug", slug);
      form.set("title", (tituloArquivo.trim() || file.name).slice(0, 120));
      form.set("description", descricaoArquivo.trim());
      form.set("file", file as Blob);

      const res = await fetch("/api/company-documents", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(json?.error || "Erro ao anexar documento");
        return;
      }
      setTituloArquivo("");
      setDescricaoArquivo("");
      setArquivoUpload(null);
      // limpa input nativo se presente
      try {
        const input = document.querySelector('[data-testid="doc-file-input"]') as HTMLInputElement | null;
        if (input) input.value = "";
      } catch {}
      setMensagem("Documento anexado com sucesso.");
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao anexar documento";
      setErro(msg);
    } finally {
      setSubmetendo(false);
    }
  }

  // Salva um link como documento
  async function submitLink() {
    if (!slug) return;
    setErro(null);
    setMensagem(null);

    const url = urlLink.trim();
    if (!url) {
      setErro("Informe o link");
      return;
    }

    setSubmetendo(true);
    try {
      const res = await fetch("/api/company-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          slug,
          kind: "link",
          title: (tituloLink.trim() || "Link").slice(0, 120),
          description: descricaoLink.trim(),
          url,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(json?.error || "Erro ao salvar link");
        return;
      }
      setTituloLink("");
      setDescricaoLink("");
      setUrlLink("");
      setMensagem("Link salvo com sucesso.");
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar link";
      setErro(msg);
    } finally {
      setSubmetendo(false);
    }
  }

  // Exclui documento via API
  async function deleteDocument(id: string) {
    if (!slug) return;
    const confirmed = window.confirm("Deseja realmente excluir este documento?");
    if (!confirmed) return;
    setErro(null);
    setMensagem(null);
    try {
      const res = await fetch(`/api/company-documents?slug=${encodeURIComponent(slug)}&id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(json?.error || "Erro ao excluir documento");
        return;
      }
      setMensagem("Documento excluido.");
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao excluir documento";
      setErro(msg);
    }
  }

  // Referencias para evitar avisos do linter
  void formatarBytes;
  void documentos;
  void carregando;
  void erro;
  void mensagem;
  void aba;
  void setAba;
  void submetendo;
  void urlLink;
  void submitFile;
  void submitLink;
  void deleteDocument;

  if (proibido || (!clientsLoading && !temAcesso)) {
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
                  value={_fileTitle}
                  onChange={(e) => _setFileTitle(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                />
                <input
                  data-testid="doc-file-description"
                  placeholder="Descricao"
                  value={_fileDescription}
                  onChange={(e) => _setFileDescription(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                />
                <input
                  data-testid="doc-file-input"
                  type="file"
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
                  value={_linkTitle}
                  onChange={(e) => _setLinkTitle(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                />
                <input
                  data-testid="doc-link-description"
                  placeholder="Descricao"
                  value={_linkDescription}
                  onChange={(e) => _setLinkDescription(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                />
                <input
                  data-testid="doc-link-url"
                  placeholder="https://..."
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

