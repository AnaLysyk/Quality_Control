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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  useEffect(() => {
    if (!clientsLoading && !hasAccess) {
      setItems([]);
      setLoading(false);
      setError("Acesso negado");
      setForbidden(true);
      return;
    }
    load();
  }, [load, clientsLoading, hasAccess]);

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
      </div>
    </div>
  );
}

