"use client";

export const dynamic = "force-dynamic";

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
import { useI18n } from "@/hooks/useI18n";

const COPY = {
  "pt-BR": {
    pageTitle: "Aplicações",
    totalVisible: "Total visível",
    totalVisibleDesc: "Aplicações disponíveis no painel.",
    manual: "Manuais",
    manualDesc: "Cadastros locais mantidos pela empresa.",
    integrated: "Integradas",
    integratedDesc: "Projetos sincronizados por integração.",
    blocked: "Bloqueadas",
    blockedDesc: "Projetos sem acesso liberado no provedor.",
    blockedTitle: "Integrações bloqueadas",
    blockedKicker: "Projetos indisponíveis",
    blockedExplanation: "Estes projetos não entram nos seletores da plataforma porque o acesso no Qase falhou ou não está autorizado.",
    blockedCount: (n: number) => `${n} projeto(s) fora de uso`,
    blockedDefaultMsg: "Projeto indisponível no Qase.",
    searchPlaceholder: "Buscar aplicação por nome, slug, descrição ou integração",
    newApp: "Nova aplicação",
    itemsShown: (n: number) => `${n} item(ns) exibido(s)`,
    loading: "Carregando aplicações...",
    emptyAll: "Nenhuma aplicação encontrada para esta empresa. Cadastre projetos da Qase no perfil da empresa ou registre uma aplicação manual.",
    emptyFilter: "Nenhuma aplicação corresponde ao filtro informado.",
    active: "Ativo",
    inactive: "Inativo",
    noDescription: "Sem descrição operacional cadastrada.",
    createdAt: "Criada em",
    openImage: "Abrir imagem",
    edit: "Editar",
    close: "Fechar",
    modalCreateTitle: "Nova aplicação",
    modalCreateEyebrow: "Cadastro manual",
    modalEditTitle: "Editar aplicação",
    modalEditEyebrow: (name: string) => `Aplicação ${name}`,
    saveApp: "Salvar aplicação",
    saveChanges: "Salvar alterações",
    openCurrent: "Abrir atual",
    modalSubtitle: "Use link ou anexo para definir a imagem da aplicação.",
    closeModalAria: "Fechar modal",
    previewAlt: (name: string) => name || "Preview da aplicação",
    previewLabel: "Preview da imagem",
    attachPhoto: "Anexar foto",
    attachNote: "Se houver anexo, ele prevalece sobre o link informado.",
    labelName: "Nome",
    placeholderName: "Nome da aplicação",
    labelImageLink: "Link da imagem",
    labelDescription: "Descrição",
    placeholderDescription: "Resumo operacional da aplicação",
    cancel: "Cancelar",
    saving: "Salvando...",
    noDate: "Sem data",
    errLoad: "Erro ao carregar aplicações da empresa.",
    errSave: "Erro ao salvar",
    errSaveApp: "Erro ao atualizar a aplicação.",
    errCreateName: "Informe o nome da aplicação manual.",
    errCreate: "Erro ao criar aplicação",
    errCreateApp: "Erro ao criar a aplicação manual.",
    errUpload: "Erro ao enviar imagem",
    errLoadShort: "Erro ao carregar aplicações",
    sourceQase: (code: string) => `Qase: ${code}`,
    sourceJira: "Jira",
    sourceManual: "Manual",
  },
  "en-US": {
    pageTitle: "Applications",
    totalVisible: "Total visible",
    totalVisibleDesc: "Applications available in the panel.",
    manual: "Manual",
    manualDesc: "Local records maintained by the company.",
    integrated: "Integrated",
    integratedDesc: "Projects synchronized via integration.",
    blocked: "Blocked",
    blockedDesc: "Projects without access in the provider.",
    blockedTitle: "Blocked integrations",
    blockedKicker: "Unavailable projects",
    blockedExplanation: "These projects are not available in the platform selectors because Qase access failed or is not authorized.",
    blockedCount: (n: number) => `${n} project(s) out of use`,
    blockedDefaultMsg: "Project unavailable in Qase.",
    searchPlaceholder: "Search application by name, slug, description or integration",
    newApp: "New application",
    itemsShown: (n: number) => `${n} item(s) shown`,
    loading: "Loading applications...",
    emptyAll: "No applications found for this company. Register Qase projects in the company profile or create a manual application.",
    emptyFilter: "No application matches the current filter.",
    active: "Active",
    inactive: "Inactive",
    noDescription: "No operational description registered.",
    createdAt: "Created on",
    openImage: "Open image",
    edit: "Edit",
    close: "Close",
    modalCreateTitle: "New application",
    modalCreateEyebrow: "Manual registration",
    modalEditTitle: "Edit application",
    modalEditEyebrow: (name: string) => `Application ${name}`,
    saveApp: "Save application",
    saveChanges: "Save changes",
    openCurrent: "Open current",
    modalSubtitle: "Use a link or attachment to set the application image.",
    closeModalAria: "Close modal",
    previewAlt: (name: string) => name || "Application preview",
    previewLabel: "Image preview",
    attachPhoto: "Attach photo",
    attachNote: "If there is an attachment, it takes priority over the link.",
    labelName: "Name",
    placeholderName: "Application name",
    labelImageLink: "Image link",
    labelDescription: "Description",
    placeholderDescription: "Operational summary of the application",
    cancel: "Cancel",
    saving: "Saving...",
    noDate: "No date",
    errLoad: "Failed to load company applications.",
    errSave: "Failed to save",
    errSaveApp: "Failed to update the application.",
    errCreateName: "Please enter the manual application name.",
    errCreate: "Failed to create application",
    errCreateApp: "Failed to create the manual application.",
    errUpload: "Failed to upload image",
    errLoadShort: "Failed to load applications",
    sourceQase: (code: string) => `Qase: ${code}`,
    sourceJira: "Jira",
    sourceManual: "Manual",
  },
} as const;

type CopyType = (typeof COPY)["pt-BR"];

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
  copy: CopyType;
};

const EMPTY_DRAFT: AppDraft = {
  name: "",
  description: "",
  imageUrl: "",
};

function resolveSourceMeta(app: AppItem, copy: CopyType) {
  const source = String(app.source ?? "").trim().toLowerCase();
  if (source === "qase" && app.qaseProjectCode) {
    return {
      label: copy.sourceQase(app.qaseProjectCode),
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }
  if (source === "jira") {
    return {
      label: copy.sourceJira,
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }
  return {
    label: copy.sourceManual,
    className: "border-slate-200 bg-slate-100 text-slate-700",
  };
}

function formatAppDate(value: string, noDateLabel: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return noDateLabel;
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

async function uploadApplicationImage(file: File, companySlug: string, errMsg: string) {
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
    throw new Error(payload?.error || errMsg);
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
  copy,
}: ApplicationModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/72 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[calc(100dvh-1.5rem)] w-full max-w-[min(78rem,calc(100vw-1rem))] overflow-y-auto rounded-4xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#fff) shadow-[0_32px_90px_rgba(15,23,42,0.42)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-(--tc-border,#e5e7eb) bg-[linear-gradient(135deg,#011848_0%,#082457_38%,#4b0f2f_72%,#ef0001_100%)] px-5 py-4 text-white sm:px-6 sm:py-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-white/72">{eyebrow}</p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-white [text-shadow:0_2px_10px_rgba(15,23,42,0.3)] sm:text-3xl">
              {title}
            </h2>
            <p className="mt-2 text-sm text-white/82">{copy.modalSubtitle}</p>
          </div>
          <button
            type="button"
            aria-label={copy.closeModalAria}
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
                <img src={previewUrl} alt={copy.previewAlt(draft.name)} className="h-48 w-full object-cover sm:h-56" />
              ) : (
                <div className="flex h-48 w-full items-center justify-center bg-[radial-gradient(circle_at_top,#082457_0%,#011848_55%,#000f2e_100%)] text-white sm:h-56">
                  <div className="text-center">
                    <FiImage size={28} className="mx-auto opacity-80" />
                    <p className="mt-3 text-sm font-medium text-white/78">{copy.previewLabel}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) p-4">
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#fff) px-4 py-2.5 text-sm font-semibold text-(--tc-text,#0b1a3c) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)">
                  <FiPaperclip size={15} />
                  {copy.attachPhoto}
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
              <p className="mt-3 text-xs text-(--tc-text-muted,#6b7280)">{copy.attachNote}</p>
            </div>
          </div>

          <div className="min-w-0 space-y-4">
            <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">
              {copy.labelName}
              <input
                className="mt-1.5 w-full rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-input-bg,#eef4ff) px-4 py-3 text-sm text-(--tc-text,#0b1a3c) outline-none focus:ring-2 focus:ring-(--tc-accent,#ef0001)"
                value={draft.name}
                onChange={(event) => onDraftChange("name", event.target.value)}
                placeholder={copy.placeholderName}
              />
            </label>

            <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">
              {copy.labelImageLink}
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
              {copy.labelDescription}
              <textarea
                className="mt-1.5 w-full rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-input-bg,#eef4ff) px-4 py-3 text-sm text-(--tc-text,#0b1a3c) outline-none focus:ring-2 focus:ring-(--tc-accent,#ef0001)"
                value={draft.description}
                onChange={(event) => onDraftChange("description", event.target.value)}
                rows={6}
                placeholder={copy.placeholderDescription}
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
                {copy.cancel}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onSubmit}
                className="inline-flex items-center gap-2 rounded-2xl bg-(--tc-accent,#ef0001) px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
              >
                <FiSave size={14} />
                {busy ? copy.saving : submitLabel}
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
  const { language } = useI18n();
  const copy = COPY[language] ?? COPY["pt-BR"];
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
        if (!res.ok) throw new Error(copy.errLoadShort);
        if (!canceled) {
          setApps(Array.isArray(data?.items) ? data.items : []);
          setBlockedApps(Array.isArray(data?.blockedItems) ? data.blockedItems : []);
        }
      } catch {
        if (!canceled) {
          setApps([]);
          setBlockedApps([]);
          setError(copy.errLoad);
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
        ? await uploadApplicationImage(editImageFile, String(slug ?? "empresa"), copy.errUpload)
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
      if (!res.ok) throw new Error(copy.errSave);
      const data = await res.json().catch(() => null);
      if (data?.item) {
        setApps((prev) => prev.map((item) => (item.id === editingApp.id ? { ...item, ...data.item } : item)));
      }
      closeEditModal();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : copy.errSaveApp);
    } finally {
      setSaving(false);
    }
  }

  async function createManualApplication() {
    if (!slug) return;
    if (!createDraft.name.trim()) {
      setError(copy.errCreateName);
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const imageUrl = createImageFile
        ? await uploadApplicationImage(createImageFile, String(slug), copy.errUpload)
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
        throw new Error(copy.errCreate);
      }

      setApps((prev) => [payload.item as AppItem, ...prev]);
      closeCreateModal();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : copy.errCreateApp);
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
        <header className="overflow-hidden rounded-4xl border border-(--tc-border,#e5e7eb) bg-[linear-gradient(135deg,#011848_0%,#082457_38%,#4b0f2f_72%,#ef0001_100%)] px-5 py-5 text-white shadow-[0_24px_60px_rgba(15,23,42,0.24)] sm:px-6 sm:py-6">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">{copy.pageTitle}</h1>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
            <div className="rounded-3xl border border-white/12 bg-white/10 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/72">{copy.totalVisible}</p>
              <p className="mt-2 text-3xl font-extrabold text-white sm:text-4xl">{apps.length}</p>
              <p className="mt-2 text-sm text-white/78">{copy.totalVisibleDesc}</p>
            </div>
            <div className="rounded-3xl border border-white/12 bg-white/10 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/72">{copy.manual}</p>
              <p className="mt-2 text-3xl font-extrabold text-white sm:text-4xl">{manualAppsCount}</p>
              <p className="mt-2 text-sm text-white/78">{copy.manualDesc}</p>
            </div>
            <div className="rounded-3xl border border-white/12 bg-white/10 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/72">{copy.integrated}</p>
              <p className="mt-2 text-3xl font-extrabold text-white sm:text-4xl">{integratedAppsCount}</p>
              <p className="mt-2 text-sm text-white/78">{copy.integratedDesc}</p>
            </div>
            <div className="rounded-3xl border border-white/12 bg-white/10 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/72">{copy.blocked}</p>
              <p className="mt-2 text-3xl font-extrabold text-white sm:text-4xl">{blockedApps.length}</p>
              <p className="mt-2 text-sm text-white/78">{copy.blockedDesc}</p>
            </div>
          </div>
        </header>

        {error ? (
          <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
            <button type="button" className="ml-2 font-semibold underline" onClick={() => setError(null)}>
              {copy.close}
            </button>
          </div>
        ) : null}

        {blockedApps.length > 0 ? (
          <section className="rounded-4xl border border-amber-200 bg-amber-50/90 p-6 shadow-sm">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-amber-700">{copy.blockedKicker}</p>
                <h2 className="mt-2 text-2xl font-extrabold text-amber-950">{copy.blockedTitle}</h2>
                <p className="mt-2 text-sm text-amber-800">
                  {copy.blockedExplanation}
                </p>
              </div>
              <div className="rounded-full border border-amber-200 bg-white/70 px-4 py-2 text-sm font-semibold text-amber-900">
                {copy.blockedCount(blockedApps.length)}
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
                  <p className="mt-2 text-sm text-amber-900">{app.accessMessage || copy.blockedDefaultMsg}</p>
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
                  placeholder={copy.searchPlaceholder}
                />
              </label>
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-(--tc-accent,#ef0001) px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 sm:w-auto"
              >
                <FiPlus size={15} />
                {copy.newApp}
              </button>
            </div>
            <div className="w-fit max-w-full rounded-full border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f3f4f6) px-4 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
              {copy.itemsShown(filteredApps.length)}
            </div>
          </div>

          {loading ? (
            <div className="mt-6 rounded-3xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) p-8 text-center text-sm text-(--tc-text-muted,#6b7280)">
              {copy.loading}
            </div>
          ) : filteredApps.length === 0 && apps.length === 0 && blockedApps.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) p-8 text-center">
              <FiPackage size={32} className="mx-auto text-(--tc-text-muted,#6b7280)" />
              <p className="mt-3 text-sm text-(--tc-text-muted,#6b7280)">
                {copy.emptyAll}
              </p>
            </div>
          ) : filteredApps.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) p-8 text-center text-sm text-(--tc-text-muted,#6b7280)">
              {copy.emptyFilter}
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(21rem,1fr))] gap-4">
              {filteredApps.map((app) => {
                const sourceMeta = resolveSourceMeta(app, copy);
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
                            {app.active ? copy.active : copy.inactive}
                          </span>
                        </div>

                        {app.description ? (
                          <p className="mt-2 line-clamp-3 text-sm text-(--tc-text-secondary,#4b5563)">{app.description}</p>
                        ) : (
                          <p className="mt-2 text-sm text-(--tc-text-muted,#6b7280)">{copy.noDescription}</p>
                        )}

                        <div className="mt-4 flex flex-wrap gap-2">
                          <span className="rounded-full border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#fff) px-3 py-1.5 text-xs font-medium text-(--tc-text-secondary,#4b5563)">
                            Slug: {app.slug}
                          </span>
                          <span className="rounded-full border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#fff) px-3 py-1.5 text-xs font-medium text-(--tc-text-secondary,#4b5563)">
                            {copy.createdAt} {formatAppDate(app.createdAt, copy.noDate)}
                          </span>
                          {app.imageUrl ? (
                            <a
                              href={app.imageUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-full border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#fff) px-3 py-1.5 text-xs font-medium text-(--tc-text-secondary,#4b5563) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)"
                            >
                              <FiExternalLink size={12} />
                              {copy.openImage}
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
                        {copy.edit}
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
        title={copy.modalCreateTitle}
        eyebrow={copy.modalCreateEyebrow}
        busy={creating}
        draft={createDraft}
        previewUrl={createPreviewUrl || createDraft.imageUrl.trim() || null}
        fileName={createImageFile?.name ?? null}
        error={error}
        submitLabel={copy.saveApp}
        onClose={closeCreateModal}
        onSubmit={() => void createManualApplication()}
        onDraftChange={updateCreateDraft}
        onFileChange={handleCreateFileChange}
        onClearFile={() => setCreateImageFile(null)}
        copy={copy}
      />

      <ApplicationModal
        open={Boolean(editingApp)}
        title={copy.modalEditTitle}
        eyebrow={editingApp ? copy.modalEditEyebrow(editingApp.name) : copy.modalEditTitle}
        busy={saving}
        draft={editDraft}
        previewUrl={editPreviewUrl || editDraft.imageUrl.trim() || null}
        fileName={editImageFile?.name ?? null}
        error={error}
        submitLabel={copy.saveChanges}
        onClose={closeEditModal}
        onSubmit={() => void saveEdit()}
        onDraftChange={updateEditDraft}
        onFileChange={handleEditFileChange}
        onClearFile={() => setEditImageFile(null)}
        copy={copy}
        footer={
          editingApp?.imageUrl ? (
            <a
              href={editingApp.imageUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl border border-(--tc-border,#e5e7eb) px-4 py-2.5 text-sm font-semibold text-(--tc-text,#0b1a3c) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)"
            >
              <FiExternalLink size={14} />
              {copy.openCurrent}
            </a>
          ) : null
        }
      />
    </div>
  );
}
