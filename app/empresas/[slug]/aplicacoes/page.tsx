"use client";

import { ChangeEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  FiEdit2,
  FiExternalLink,
  FiImage,
  FiLink2,
  FiPackage,
  FiPaperclip,
  FiPlus,
  FiSave,
  FiSearch,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import { fetchApi } from "@/lib/api";

type AppItem = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  qaseProjectCode?: string | null;
  source?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type BlockedAppItem = AppItem & {
  accessReason?: string | null;
  accessMessage?: string | null;
  unavailable?: boolean;
};

type AppDraft = {
  name: string;
  description: string;
  imageUrl: string;
};

type ApplicationModalProps = {
  title: string;
  eyebrow: string;
  open: boolean;
  busy: boolean;
  draft: AppDraft;
  previewUrl: string | null;
  fileName: string | null;
  error?: string | null;
  submitLabel: string;
  onClose: () => void;
  onSubmit: () => void;
  onDraftChange: (field: keyof AppDraft, value: string) => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onClearFile: () => void;
  footer?: ReactNode;
};

const EMPTY_DRAFT: AppDraft = {
  name: "",
  description: "",
  imageUrl: "",
};

function resolveSourceMeta(app: AppItem) {
  const source = String(app.source ?? "").trim().toLowerCase();
  if (source === "qase" && app.qaseProjectCode) {
    return {
      label: `Qase: ${app.qaseProjectCode}`,
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }
  if (source === "jira") {
    return {
      label: "Jira",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }
  return {
    label: "Manual",
    className: "border-slate-200 bg-slate-100 text-slate-700",
  };
}

function formatAppDate(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(parsed);
}

function sanitizeUploadFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/(^-|-$)/g, "") || `imagem-${Date.now()}`;
}

function matchesSearch(app: AppItem, term: string) {
  const normalized = term.trim().toLowerCase();
  if (!normalized) return true;
  const haystack = [app.name, app.slug, app.description ?? "", app.qaseProjectCode ?? "", app.source ?? ""]
    .join(" ")
    .toLowerCase();
  return haystack.includes(normalized);
}

function useObjectUrl(file: File | null) {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [url]);

  return url;
}

async function uploadApplicationImage(file: File, companySlug: string) {
  const key = `applications/${companySlug}/${Date.now()}-${sanitizeUploadFileName(file.name || "app-image")}`;
  const form = new FormData();
  form.set("file", file);
  form.set("key", key);
  const response = await fetch("/api/s3/upload", {
    method: "POST",
    credentials: "include",
    body: form,
  });
  const payload = (await response.json().catch(() => null)) as { ok?: boolean; key?: string; error?: string } | null;
  if (!response.ok || !payload?.ok || !payload.key) {
    throw new Error(payload?.error || "Erro ao enviar imagem");
  }
  return `/api/s3/object?key=${encodeURIComponent(payload.key)}`;
}

function ApplicationModal({
  title,
  eyebrow,
  open,
  busy,
  draft,
  previewUrl,
  fileName,
  error,
  submitLabel,
  onClose,
  onSubmit,
  onDraftChange,
  onFileChange,
  onClearFile,
  footer,
}: ApplicationModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/72 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[calc(100dvh-1.5rem)] w-full max-w-[min(78rem,calc(100vw-1rem))] overflow-y-auto rounded-4xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#fff) shadow-[0_32px_90px_rgba(15,23,42,0.42)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-(--tc-border,#e5e7eb) bg-[linear-gradient(135deg,#0f2350_0%,#274a99_48%,#b30f2d_100%)] px-5 py-4 text-white sm:px-6 sm:py-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-white/72">{eyebrow}</p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-white [text-shadow:0_2px_10px_rgba(15,23,42,0.3)] sm:text-3xl">
              {title}
            </h2>
            <p className="mt-2 text-sm text-white/82">Use link ou anexo para definir a imagem da aplicação.</p>
          </div>
          <button
            type="button"
            aria-label="Fechar modal"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-slate-950/24 text-white shadow-sm transition hover:bg-slate-950/40"
          >
            <FiX size={20} />
          </button>
        </div>

        <div className="grid gap-5 px-5 py-5 sm:px-6 sm:py-6 xl:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)]">
          <div className="space-y-4 xl:sticky xl:top-0">
            <div className="overflow-hidden rounded-3xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc)">
              {previewUrl ? (
                <img src={previewUrl} alt={draft.name || "Preview da aplicação"} className="h-48 w-full object-cover sm:h-56" />
              ) : (
                <div className="flex h-48 w-full items-center justify-center bg-[radial-gradient(circle_at_top,#274a99_0%,#17253f_55%,#0f172a_100%)] text-white sm:h-56">
                  <div className="text-center">
                    <FiImage size={28} className="mx-auto opacity-80" />
                    <p className="mt-3 text-sm font-medium text-white/78">Preview da imagem</p>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) p-4">
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#fff) px-4 py-2.5 text-sm font-semibold text-(--tc-text,#0b1a3c) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)">
                  <FiPaperclip size={15} />
                  Anexar foto
                  <input type="file" accept="image/*" className="hidden" onChange={onFileChange} />
                </label>
                {fileName ? (
                  <button
                    type="button"
                    onClick={onClearFile}
                    className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                  >
                    <FiTrash2 size={14} />
                    {fileName}
                  </button>
                ) : null}
              </div>
              <p className="mt-3 text-xs text-(--tc-text-muted,#6b7280)">Se houver anexo, ele prevalece sobre o link informado.</p>
            </div>
          </div>

          <div className="min-w-0 space-y-4">
            <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">
              Nome
              <input
                className="mt-1.5 w-full rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-input-bg,#eef4ff) px-4 py-3 text-sm text-(--tc-text,#0b1a3c) outline-none focus:ring-2 focus:ring-(--tc-accent,#ef0001)"
                value={draft.name}
                onChange={(event) => onDraftChange("name", event.target.value)}
                placeholder="Nome da aplicação"
              />
            </label>

            <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">
              Link da imagem
              <div className="relative mt-1.5">
                <FiLink2 className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-(--tc-text-muted,#6b7280)" size={15} />
                <input
                  className="w-full rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-input-bg,#eef4ff) py-3 pl-11 pr-4 text-sm text-(--tc-text,#0b1a3c) outline-none focus:ring-2 focus:ring-(--tc-accent,#ef0001)"
                  value={draft.imageUrl}
                  onChange={(event) => onDraftChange("imageUrl", event.target.value)}
                  placeholder="https://cdn.../app-logo.png"
                />
              </div>
            </label>

            <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">
              Descricao
              <textarea
                className="mt-1.5 w-full rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-input-bg,#eef4ff) px-4 py-3 text-sm text-(--tc-text,#0b1a3c) outline-none focus:ring-2 focus:ring-(--tc-accent,#ef0001)"
                value={draft.description}
                onChange={(event) => onDraftChange("description", event.target.value)}
                rows={6}
                placeholder="Resumo operacional da aplicação"
              />
            </label>

            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
            ) : null}

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              {footer}
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-2 rounded-2xl border border-(--tc-border,#e5e7eb) px-4 py-2.5 text-sm font-semibold text-(--tc-text,#0b1a3c) transition hover:bg-(--tc-surface-2,#f3f4f6)"
              >
                <FiX size={14} />
                Cancelar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onSubmit}
                className="inline-flex items-center gap-2 rounded-2xl bg-(--tc-accent,#ef0001) px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
              >
                <FiSave size={14} />
                {busy ? "Salvando..." : submitLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CompanyAppsPage() {
  const { slug } = useParams<{ slug: string }>();
  const [apps, setApps] = useState<AppItem[]>([]);
  const [blockedApps, setBlockedApps] = useState<BlockedAppItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingApp, setEditingApp] = useState<AppItem | null>(null);
  const [editDraft, setEditDraft] = useState<AppDraft>(EMPTY_DRAFT);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<AppDraft>(EMPTY_DRAFT);
  const [createImageFile, setCreateImageFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);

  const createPreviewUrl = useObjectUrl(createImageFile);
  const editPreviewUrl = useObjectUrl(editImageFile);

  useEffect(() => {
    if (!slug) return;
    let canceled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchApi(`/api/applications?companySlug=${encodeURIComponent(slug)}`);
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error("Erro ao carregar aplicações");
        if (!canceled) {
          setApps(Array.isArray(data?.items) ? data.items : []);
          setBlockedApps(Array.isArray(data?.blockedItems) ? data.blockedItems : []);
        }
      } catch {
        if (!canceled) {
          setApps([]);
          setBlockedApps([]);
          setError("Erro ao carregar aplicações da empresa.");
        }
      } finally {
        if (!canceled) setLoading(false);
      }
    }

    void load();
    return () => {
      canceled = true;
    };
  }, [slug]);

  function resetCreateForm() {
    setCreateDraft(EMPTY_DRAFT);
    setCreateImageFile(null);
  }

  function openCreateModal() {
    resetCreateForm();
    setError(null);
    setCreateOpen(true);
  }

  function closeCreateModal() {
    if (creating) return;
    setCreateOpen(false);
    resetCreateForm();
  }

  function startEdit(app: AppItem) {
    setEditingApp(app);
    setEditDraft({
      name: app.name,
      description: app.description ?? "",
      imageUrl: app.imageUrl ?? "",
    });
    setEditImageFile(null);
    setError(null);
  }

  function closeEditModal() {
    if (saving) return;
    setEditingApp(null);
    setEditDraft(EMPTY_DRAFT);
    setEditImageFile(null);
  }

  function updateCreateDraft(field: keyof AppDraft, value: string) {
    setCreateDraft((current) => ({ ...current, [field]: value }));
  }

  function updateEditDraft(field: keyof AppDraft, value: string) {
    setEditDraft((current) => ({ ...current, [field]: value }));
  }

  function handleCreateFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setCreateImageFile(file);
    event.target.value = "";
  }

  function handleEditFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setEditImageFile(file);
    event.target.value = "";
  }

  async function saveEdit() {
    if (!editingApp) return;
    setSaving(true);
    setError(null);
    try {
      const imageUrl = editImageFile
        ? await uploadApplicationImage(editImageFile, String(slug ?? "empresa"))
        : editDraft.imageUrl.trim() || null;
      const res = await fetchApi(`/api/applications/${encodeURIComponent(editingApp.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editDraft.name.trim() || undefined,
          description: editDraft.description.trim() || null,
          imageUrl,
        }),
      });
      if (!res.ok) throw new Error("Erro ao salvar");
      const data = await res.json().catch(() => null);
      if (data?.item) {
        setApps((prev) => prev.map((item) => (item.id === editingApp.id ? { ...item, ...data.item } : item)));
      }
      closeEditModal();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Erro ao atualizar a aplicação.");
    } finally {
      setSaving(false);
    }
  }

  async function createManualApplication() {
    if (!slug) return;
    if (!createDraft.name.trim()) {
      setError("Informe o nome da aplicação manual.");
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const imageUrl = createImageFile
        ? await uploadApplicationImage(createImageFile, String(slug))
        : createDraft.imageUrl.trim() || null;

      const response = await fetchApi("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companySlug: slug,
          name: createDraft.name.trim(),
          description: createDraft.description.trim() || null,
          imageUrl,
          source: "manual",
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.item) {
        throw new Error("Erro ao criar aplicação");
      }

      setApps((prev) => [payload.item as AppItem, ...prev]);
      closeCreateModal();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Erro ao criar a aplicação manual.");
    } finally {
      setCreating(false);
    }
  }

  const manualAppsCount = useMemo(
    () => apps.filter((app) => !["qase", "jira"].includes(String(app.source ?? "").trim().toLowerCase())).length,
    [apps],
  );
  const integratedAppsCount = useMemo(
    () => apps.filter((app) => ["qase", "jira"].includes(String(app.source ?? "").trim().toLowerCase())).length,
    [apps],
  );
  const filteredApps = useMemo(() => apps.filter((app) => matchesSearch(app, searchQuery)), [apps, searchQuery]);

  return (
    <div className="min-h-screen bg-(--page-bg,#f5f6fa) px-3 py-6 text-(--page-text,#0b1a3c) sm:px-4 sm:py-8 lg:px-5 xl:px-6">
      <div className="w-full space-y-6">
        <header className="overflow-hidden rounded-4xl border border-(--tc-border,#e5e7eb) bg-[linear-gradient(135deg,#0f2350_0%,#213f88_48%,#b30f2d_100%)] px-5 py-5 text-white shadow-[0_24px_60px_rgba(15,23,42,0.24)] sm:px-6 sm:py-6">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Aplicações</h1>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
            <div className="rounded-3xl border border-white/12 bg-white/10 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/72">Total visível</p>
              <p className="mt-2 text-3xl font-extrabold text-white sm:text-4xl">{apps.length}</p>
              <p className="mt-2 text-sm text-white/78">Aplicações disponíveis no painel.</p>
            </div>
            <div className="rounded-3xl border border-white/12 bg-white/10 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/72">Manuais</p>
              <p className="mt-2 text-3xl font-extrabold text-white sm:text-4xl">{manualAppsCount}</p>
              <p className="mt-2 text-sm text-white/78">Cadastros locais mantidos pela empresa.</p>
            </div>
            <div className="rounded-3xl border border-white/12 bg-white/10 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/72">Integradas</p>
              <p className="mt-2 text-3xl font-extrabold text-white sm:text-4xl">{integratedAppsCount}</p>
              <p className="mt-2 text-sm text-white/78">Projetos sincronizados por integração.</p>
            </div>
            <div className="rounded-3xl border border-white/12 bg-white/10 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/72">Bloqueadas</p>
              <p className="mt-2 text-3xl font-extrabold text-white sm:text-4xl">{blockedApps.length}</p>
              <p className="mt-2 text-sm text-white/78">Projetos sem acesso liberado no provedor.</p>
            </div>
          </div>
        </header>

        {error ? (
          <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
            <button type="button" className="ml-2 font-semibold underline" onClick={() => setError(null)}>
              Fechar
            </button>
          </div>
        ) : null}

        {blockedApps.length > 0 ? (
          <section className="rounded-4xl border border-amber-200 bg-amber-50/90 p-6 shadow-sm">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-amber-700">Projetos indisponíveis</p>
                <h2 className="mt-2 text-2xl font-extrabold text-amber-950">Integrações bloqueadas</h2>
                <p className="mt-2 text-sm text-amber-800">
                  Estes projetos não entram nos seletores da plataforma porque o acesso no Qase falhou ou não está autorizado.
                </p>
              </div>
              <div className="rounded-full border border-amber-200 bg-white/70 px-4 py-2 text-sm font-semibold text-amber-900">
                {blockedApps.length} projeto(s) fora de uso
              </div>
            </div>
            <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(18rem,1fr))] gap-3">
              {blockedApps.map((app) => (
                <div key={app.id} className="rounded-3xl border border-amber-200 bg-white/70 px-4 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-amber-950">{app.name}</span>
                    {app.qaseProjectCode ? (
                      <span className="rounded-full border border-amber-200 bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-800">
                        Qase: {app.qaseProjectCode}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-amber-900">{app.accessMessage || "Projeto indisponível no Qase."}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-4xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#fff) p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex w-full flex-col gap-3 xl:max-w-3xl xl:flex-row">
              <label className="relative block flex-1">
                <FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-(--tc-text-muted,#6b7280)" size={16} />
                <input
                  className="w-full rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-input-bg,#eef4ff) py-3 pl-11 pr-4 text-sm text-(--tc-text,#0b1a3c) outline-none focus:ring-2 focus:ring-(--tc-accent,#ef0001)"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Buscar aplicação por nome, slug, descrição ou integração"
                />
              </label>
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-(--tc-accent,#ef0001) px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 sm:w-auto"
              >
                <FiPlus size={15} />
                Nova aplicação
              </button>
            </div>
            <div className="w-fit max-w-full rounded-full border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f3f4f6) px-4 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
              {filteredApps.length} item(ns) exibido(s)
            </div>
          </div>

          {loading ? (
            <div className="mt-6 rounded-3xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) p-8 text-center text-sm text-(--tc-text-muted,#6b7280)">
              Carregando aplicações...
            </div>
          ) : filteredApps.length === 0 && apps.length === 0 && blockedApps.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) p-8 text-center">
              <FiPackage size={32} className="mx-auto text-(--tc-text-muted,#6b7280)" />
              <p className="mt-3 text-sm text-(--tc-text-muted,#6b7280)">
                Nenhuma aplicação encontrada para esta empresa. Cadastre projetos da Qase no perfil da empresa ou registre uma aplicação manual.
              </p>
            </div>
          ) : filteredApps.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) p-8 text-center text-sm text-(--tc-text-muted,#6b7280)">
              Nenhuma aplicação corresponde ao filtro informado.
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(21rem,1fr))] gap-4">
              {filteredApps.map((app) => {
                const sourceMeta = resolveSourceMeta(app);
                return (
                  <article
                    key={app.id}
                    className="rounded-3xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) p-5 shadow-sm transition hover:border-(--tc-accent,#ef0001)/30 hover:shadow-md"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                      {app.imageUrl ? (
                        <img
                          src={app.imageUrl}
                          alt={app.name}
                          className="h-16 w-16 shrink-0 rounded-2xl border border-(--tc-border,#e5e7eb) object-cover"
                        />
                      ) : (
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-(--tc-surface,#fff) text-(--tc-text-muted,#6b7280)">
                          <FiPackage size={22} />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-bold text-(--tc-text,#0b1a3c)">{app.name}</h3>
                          <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] ${sourceMeta.className}`}>
                            {sourceMeta.label}
                          </span>
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                              app.active
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-slate-200 bg-slate-100 text-slate-500"
                            }`}
                          >
                            {app.active ? "Ativo" : "Inativo"}
                          </span>
                        </div>

                        {app.description ? (
                          <p className="mt-2 line-clamp-3 text-sm text-(--tc-text-secondary,#4b5563)">{app.description}</p>
                        ) : (
                          <p className="mt-2 text-sm text-(--tc-text-muted,#6b7280)">Sem descrição operacional cadastrada.</p>
                        )}

                        <div className="mt-4 flex flex-wrap gap-2">
                          <span className="rounded-full border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#fff) px-3 py-1.5 text-xs font-medium text-(--tc-text-secondary,#4b5563)">
                            Slug: {app.slug}
                          </span>
                          <span className="rounded-full border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#fff) px-3 py-1.5 text-xs font-medium text-(--tc-text-secondary,#4b5563)">
                            Criada em {formatAppDate(app.createdAt)}
                          </span>
                          {app.imageUrl ? (
                            <a
                              href={app.imageUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-full border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#fff) px-3 py-1.5 text-xs font-medium text-(--tc-text-secondary,#4b5563) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)"
                            >
                              <FiExternalLink size={12} />
                              Abrir imagem
                            </a>
                          ) : null}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => startEdit(app)}
                        className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#fff) px-3 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001) sm:w-auto"
                      >
                        <FiEdit2 size={14} />
                        Editar
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <ApplicationModal
        open={createOpen}
        title="Nova aplicação"
        eyebrow="Cadastro manual"
        busy={creating}
        draft={createDraft}
        previewUrl={createPreviewUrl || createDraft.imageUrl.trim() || null}
        fileName={createImageFile?.name ?? null}
        error={error}
        submitLabel="Salvar aplicação"
        onClose={closeCreateModal}
        onSubmit={() => void createManualApplication()}
        onDraftChange={updateCreateDraft}
        onFileChange={handleCreateFileChange}
        onClearFile={() => setCreateImageFile(null)}
      />

      <ApplicationModal
        open={Boolean(editingApp)}
        title="Editar aplicação"
        eyebrow={editingApp ? `Aplicação ${editingApp.name}` : "Aplicação"}
        busy={saving}
        draft={editDraft}
        previewUrl={editPreviewUrl || editDraft.imageUrl.trim() || null}
        fileName={editImageFile?.name ?? null}
        error={error}
        submitLabel="Salvar alterações"
        onClose={closeEditModal}
        onSubmit={() => void saveEdit()}
        onDraftChange={updateEditDraft}
        onFileChange={handleEditFileChange}
        onClearFile={() => setEditImageFile(null)}
        footer={
          editingApp?.imageUrl ? (
            <a
              href={editingApp.imageUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl border border-(--tc-border,#e5e7eb) px-4 py-2.5 text-sm font-semibold text-(--tc-text,#0b1a3c) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)"
            >
              <FiExternalLink size={14} />
              Abrir atual
            </a>
          ) : null
        }
      />
    </div>
  );
}
