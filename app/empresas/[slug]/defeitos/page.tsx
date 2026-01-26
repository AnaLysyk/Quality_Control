"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { FiEdit3, FiSearch, FiTrash2 } from "react-icons/fi";
import { useParams } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import { useAuthUser } from "@/hooks/useAuthUser";

type DefectItem = {
  id: string;
  title: string;
  status: "open" | "in_progress" | "done";
  openedAt: string;
  closedAt: string | null;
  mttrMs: number | null;
  origin: "manual" | "qase";
  runSlug?: string;
  app?: string;
  severity?: string;
  link?: string;
  responsible?: string;
  created_at?: string;
  updated_at?: string;
  run?: { id: string; name: string; status?: string };
  release?: { id: string; version: string; status?: string };
};

type NewDefectForm = {
  title: string;
  description: string;
  status: DefectItem["status"];
  link: string;
  runSlug: string;
  responsible: string;
};

type RunOption = {
  slug: string;
  name?: string;
  runId?: number;
  status?: string;
  source?: "QASE" | "MANUAL";
  origin?: "automatico" | "manual";
};

const STATUS_OPTIONS: { id: DefectItem["status"]; label: string }[] = [
  { id: "open", label: "Aberto" },
  { id: "in_progress", label: "Em andamento" },
  { id: "done", label: "Concluído" },
];

const STATUS_COLOR_CLASSES: Record<DefectItem["status"], string> = {
  open: "border-rose-300/70 bg-rose-50 text-rose-700",
  in_progress: "border-sky-300/70 bg-sky-50 text-sky-700",
  done: "border-emerald-300/70 bg-emerald-50 text-emerald-700",
};

function getStatusColor(status: DefectItem["status"]) {
  return STATUS_COLOR_CLASSES[status] ?? "border-slate-300/70 bg-slate-50 text-slate-700";
}

const STATUS_TO_STATS: Record<DefectItem["status"], { fail: number; blocked: number; notRun: number; pass: number }> = {
  open: { fail: 1, blocked: 0, notRun: 0, pass: 0 },
  in_progress: { fail: 0, blocked: 0, notRun: 1, pass: 0 },
  done: { fail: 0, blocked: 0, notRun: 0, pass: 1 },
};

// No longer needed: deriveStatusFromStats

function formatMTTR(ms?: number | null) {
  if (!ms) return "—";
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

export default function DefeitosEmpresaPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const params = useParams();
  const slug = (params?.slug as string) || "empresa";
  const companyName =
    slug === "griaule"
      ? "Griaule"
      : slug
          .split("-")
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" ");

  const defaultForm: NewDefectForm = {
    title: "",
    description: "",
    status: "open",
    link: "",
    runSlug: "",
    responsible: "",
  };

  const { user } = useAuthUser();
  // Get run filter from query param
  const runFilter = searchParams?.get("run") || "";
  const [form, setForm] = useState<NewDefectForm>(defaultForm);

  useEffect(() => {
    const name = user?.name;
    if (typeof name === "string" && name.trim() && !form.responsible) {
      setForm((prev) => ({ ...prev, responsible: name }));
    }
  }, [user?.name, form.responsible]);

  const [defects, setDefects] = useState<DefectItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [originFilter, setOriginFilter] = useState<string>("all");
  const [creating, setCreating] = useState(false);
  const [createManualError, setCreateManualError] = useState<string | null>(null);
  const [runs, setRuns] = useState<RunOption[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [userList, setUserList] = useState<
    Array<{ user_id: string; name: string; email?: string; role?: string | null; active?: boolean }>
  >([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const runListId = useId();
  const [runQuery, setRunQuery] = useState("");
  const [editingDefect, setEditingDefect] = useState<DefectItem | null>(null);
  const [modalForm, setModalForm] = useState({
    title: "",
    status: "open" as DefectItem["status"],
    link: "",
    responsible: "",
    runSlug: "",
  });
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSaving, setModalSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL(`/api/empresas/${slug}/defeitos`, window.location.origin);
      if (runFilter) url.searchParams.set("run", runFilter);
      const res = await fetch(url.toString(), { cache: "no-store" });
      const json = await res.json().catch(() => null);
      const record = (json ?? null) as Record<string, unknown> | null;
      const errorMsg = typeof record?.error === "string" ? record.error : null;
      const items = Array.isArray(record?.items) ? (record.items as DefectItem[]) : [];
      setDefects(items);
      setError(errorMsg);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar defeitos");
      setDefects([]);
    } finally {
      setLoading(false);
    }
  }, [slug, runFilter]);

  const fetchUsers = useCallback(
    async (clientId: string | null) => {
      if (!clientId) {
        setUserList([]);
        return;
      }
      try {
        const params = new URLSearchParams();
        params.set("client_id", clientId);
        if (user?.isGlobalAdmin) params.set("all", "true");
        params.set("role", "USER");
        const res = await fetch(`/api/admin/users?${params.toString()}`, {
          credentials: "include",
        });
        const json = await res.json().catch(() => ({ items: [] }));
        const list = Array.isArray(json.items) ? json.items : [];
        setUserList(list);
      } catch {
        setUserList([]);
      }
    },
    [user?.isGlobalAdmin],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let canceled = false;
    const loadRuns = async () => {
      setLoadingRuns(true);
      setRunsError(null);
      try {
        const res = await fetch(`/api/empresas/${slug}/runs`, { cache: "no-store" });
        if (!res.ok) throw new Error("NÃƒÂ£o foi possÃƒÂ­vel carregar as runs");
        const data = (await res.json().catch(() => ({}))) as { runs?: RunOption[] };
        if (!canceled) {
          setRuns(Array.isArray(data.runs) ? data.runs : []);
        }
      } catch (err) {
        if (!canceled) {
          setRuns([]);
          setRunsError(err instanceof Error ? err.message : "Erro ao carregar runs");
        }
      } finally {
        if (!canceled) setLoadingRuns(false);
      }
    };
    loadRuns();
    return () => {
      canceled = true;
    };
  }, [slug]);

  useEffect(() => {
    fetchUsers(slug);
  }, [slug, fetchUsers]);

  const responsibleOptions = useMemo(
    () => userList.filter((entry) => (entry.role ?? "").toLowerCase() === "user" && entry.name),
    [userList],
  );

  const filteredRuns = useMemo(() => {
    const query = runQuery.trim().toLowerCase();
    if (!query) return runs;
    return runs.filter((run) => {
      const target = (run.name ?? run.slug ?? "").toLowerCase();
      return target.includes(query);
    });
  }, [runs, runQuery]);
  const modalRunSlug = modalForm.runSlug.trim();
  const hasModalRun = modalRunSlug
    ? runs.some((run) => run.slug === modalRunSlug)
    : false;
  const modalRunOptions = useMemo(() => {
    const query = modalRunSlug.trim().toLowerCase();
    if (!query) return runs;
    return runs.filter((run) => {
      const target = (run.name ?? run.slug ?? "").toLowerCase();
      return target.includes(query);
    });
  }, [runs, modalRunSlug]);

  const filtered = useMemo(() => {
    return defects.filter((d) => {
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (originFilter !== "all" && d.origin !== originFilter) return false;
      // runFilter is already applied in backend, but keep for clarity
      if (runFilter && d.runSlug !== runFilter) return false;
      return true;
    });
  }, [defects, statusFilter, originFilter, runFilter]);

  const role = user?.role;
  const isAdmin = role === "admin";
  const isCompany = role === "company";

  const closedCount = defects.filter((d) => d.closedAt).length;
  const openCount = defects.length - closedCount;
  const closedWithMttr = defects.filter((d) => d.mttrMs != null);
  const mttrMs = closedWithMttr.length ? closedWithMttr.reduce((acc, d) => acc + (d.mttrMs || 0), 0) / closedWithMttr.length : null;

  async function addManualDefect() {
    if (!form.title.trim()) return;
    setCreating(true);
    setCreateManualError(null);
    const manualApp = slug.toUpperCase();
    const responsibleValue = form.responsible.trim() || user?.name || "Manual";
    const isClosed = form.status === "done";
    try {
      const res = await fetch("/api/releases-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: form.title.trim(),
          app: manualApp,
          clientSlug: slug,
          stats: STATUS_TO_STATS[form.status],
          observations: form.description,
          slug: form.runSlug,
          responsible: responsibleValue,
          closedAt: isClosed ? new Date().toISOString() : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({} as any));
        const message = (data?.message || data?.error || "NÃƒÂ£o foi possÃƒÂ­vel criar o defeito manual") as string;
        setCreateManualError(message);
        return;
      }

      setForm({ ...defaultForm, responsible: user?.name ?? "" });
      await load();
    } catch (err) {
      console.error("Erro ao criar defeito manual", err);
      setCreateManualError(err instanceof Error ? err.message : "NÃƒÂ£o foi possÃƒÂ­vel criar o defeito manual");
    } finally {
      setCreating(false);
    }
  }

  async function deleteManualDefect(defect: DefectItem) {
    if (defect.origin !== "manual" || !defect.runSlug) return;
    setDeletingId(defect.id);
    try {
      const res = await fetch(`/api/releases-manual/${encodeURIComponent(defect.runSlug)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message ?? "NÃƒÂ£o foi possÃƒÂ­vel excluir o defeito");
      }
      await load();
    } catch (err) {
      console.error("Erro ao excluir defeito manual", err);
    } finally {
      setDeletingId(null);
    }
  }

  function openEditModal(defect: DefectItem) {
    setEditingDefect(defect);
    setModalForm({
      title: defect.title,
      status: defect.status,
      link: defect.link ?? "",
      responsible: defect.responsible ?? "",
      runSlug: defect.runSlug ?? "",
    });
    setModalError(null);
    setModalSaving(false);
  }

  function closeModal() {
    setEditingDefect(null);
    setModalError(null);
  }

  async function handleModalSave() {
    if (!editingDefect) return;
    if (!modalForm.title.trim()) {
      setModalError("Título obrigatório");
      return;
    }
    setModalSaving(true);
    setModalError(null);
    const slug = editingDefect.id.replace("manual-", "");
    try {
      const payload: Record<string, unknown> = { name: modalForm.title.trim() };
      const statusStats = STATUS_TO_STATS[modalForm.status] ?? STATUS_TO_STATS["open"];
      payload.stats = statusStats;
      if (modalForm.status === "done") {
        payload.closedAt = new Date().toISOString();
      } else {
        payload.closedAt = null;
      }
      const responsibleValue = modalForm.responsible.trim() || editingDefect.responsible || "";
      if (responsibleValue) payload.responsible = responsibleValue;
      if (modalForm.link.trim()) payload.observations = modalForm.link.trim();
      const runSlugValue = modalForm.runSlug.trim();
      if (runSlugValue) {
        payload.runSlug = runSlugValue;
        const runMatch = runs.find((run) => run.slug === runSlugValue);
        if (runMatch?.name) payload.runName = runMatch.name;
      } else {
        payload.runSlug = null;
      }
      const res = await fetch(`/api/releases-manual/${encodeURIComponent(slug ?? "")}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message ?? "Não foi possível atualizar o defeito");
      }
      // Após salvar, recarrega a lista do backend (fonte de verdade)
      await load();
      closeModal();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao salvar";
      setModalError(message);
    } finally {
      setModalSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-(--page-bg,#f7f9fb) text-(--page-text,#0b1a3c)" data-testid="defects-page">
      <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 sm:pt-6 lg:px-10 lg:pt-10 space-y-6">
        <Breadcrumb
          items={[
            { label: "Empresas", href: "/empresas" },
            {
              label: companyName,
              href: `/empresas/${encodeURIComponent(slug)}/home`,
              title: companyName,
            },
            { label: "Defeitos" },
          ]}
        />

        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.32em] text-(--tc-accent,#ef0001)">Defeitos</p>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-(--tc-text-primary,#0b1a3c) leading-tight">
            Controle de defeitos
          </h1>
          <p className="text-sm sm:text-base text-(--tc-text-secondary,#4b5563)">
            VisÃƒÂ£o consolidada da empresa {companyName}. Agrupa execuÃƒÂ§ÃƒÂµes com status crÃƒÂ­tico e links para investigaÃƒÂ§ÃƒÂ£o.
          </p>
        </header>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {loading && <p className="text-sm text-(--tc-text-muted,#6b7280)">Carregando defeitos...</p>}

        {!loading && (
          <>
            <section className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-white p-4 shadow-sm">
                <p className="text-xs uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">MTTR</p>
                <p className="mt-2 text-2xl font-extrabold text-(--tc-text-primary,#0b1a3c)" data-testid="metric-mttr">
                  {formatMTTR(mttrMs)}
                  <span className="sr-only" data-testid="defect-mttr">
                    {formatMTTR(mttrMs)}
                  </span>
                </p>
              </div>
              <div className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-white p-4 shadow-sm">
                <p className="text-xs uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">Defeitos abertos</p>
                <p className="mt-2 text-2xl font-extrabold text-(--tc-text-primary,#0b1a3c)" data-testid="metric-defects-open">
                  {openCount}
                </p>
              </div>
              <div className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-white p-4 shadow-sm">
                <p className="text-xs uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">Defeitos fechados</p>
                <p className="mt-2 text-2xl font-extrabold text-(--tc-text-primary,#0b1a3c)" data-testid="metric-defects-closed">
                  {closedCount}
                </p>
              </div>
            </section>

            <section className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) p-4 sm:p-6 shadow-sm space-y-4" data-testid="defects-create">
              <h2 className="text-lg sm:text-xl font-semibold text-(--tc-text-primary,#0b1a3c)">Criar defeito manual</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-sm">
                  TÃƒÂ­tulo
                  <input
                    data-testid="defect-title"
                    className="rounded-lg border border-(--tc-border,#e5e7eb) px-3 py-2 text-sm"
                    value={form.title}
                    onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                    placeholder="Ex.: Bug no checkout"
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  Status inicial
                  <select
                    className={`rounded-lg border px-3 py-2 text-sm transition ${getStatusColor(
                      form.status
                    )}`}
                    value={form.status}
                    onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as DefectItem['status'] }))}
                    aria-label="Status inicial"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm">
                  Link (opcional)
                  <input
                    className="rounded-lg border border-(--tc-border,#e5e7eb) px-3 py-2 text-sm"
                    value={form.link}
                    onChange={(e) => setForm((p) => ({ ...p, link: e.target.value }))}
                    placeholder="https://..."
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  Run associada (opcional)
                  {loadingRuns ? (
                    <div className="rounded-lg border border-(--tc-border,#e5e7eb) px-3 py-2 text-sm text-(--tc-text-muted,#6b7280)">
                      Carregando runs...
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        data-testid="defect-run-select"
                        list={runListId}
                        className="w-full rounded-lg border border-(--tc-border,#e5e7eb) px-3 py-2 pr-10 text-sm"
                        value={form.runSlug}
                        onChange={(e) => {
                          setRunQuery(e.target.value);
                          setForm((p) => ({ ...p, runSlug: e.target.value }));
                        }}
                        placeholder="Buscar run..."
                        aria-label="Run associada"
                      />
                      <FiSearch
                        size={16}
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-(--tc-text-muted,#6b7280)"
                      />
                      <datalist id={runListId}>
                        {filteredRuns.map((run) => (
                          <option key={run.slug} value={run.slug}>
                            {run.slug}
                          </option>
                        ))}
                      </datalist>
                    </div>
                  )}
                  {runsError && <span className="text-xs text-red-500">{runsError}</span>}
                </label>
                <label className="grid gap-1 text-sm">
                  ResponsÃƒÂ¡vel
                  <input
                    className="rounded-lg border border-(--tc-border,#e5e7eb) px-3 py-2 text-sm"
                    list="responsible-options"
                    value={form.responsible}
                    onChange={(e) => setForm((p) => ({ ...p, responsible: e.target.value }))}
                    placeholder="Nome do responsÃƒÂ¡vel"
                  />
                  <datalist id="responsible-options">
                    {responsibleOptions.map((item) => (
                      <option key={item.user_id} value={item.name}>
                        {item.email ?? ""}
                      </option>
                    ))}
                  </datalist>
                </label>
                <label className="grid gap-1 text-sm md:col-span-2">
                  DescriÃƒÂ§ÃƒÂ£o (opcional)
                  <textarea
                    className="rounded-lg border border-(--tc-border,#e5e7eb) px-3 py-2 text-sm"
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Contexto do defeito..."
                  />
                </label>
              </div>
                <button
                  data-testid="defect-create"
                  type="button"
                  onClick={addManualDefect}
                  className="inline-flex justify-center rounded-lg bg-(--tc-accent,#ef0001) px-4 py-2 text-sm font-semibold text-white shadow hover:brightness-110 disabled:opacity-60"
                  disabled={!form.title.trim() || creating}
                >
                  {creating ? "Incluindo..." : "Adicionar defeito manual"}
                </button>
                {createManualError && <p className="text-sm text-red-500">{createManualError}</p>}
            </section>

            <section className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) p-4 sm:p-6 shadow-sm space-y-4" data-testid="defects-list">
              {runFilter && (
                <div className="mb-2 flex items-center gap-2 text-xs bg-yellow-50 border border-yellow-200 rounded px-3 py-2">
                  <span className="font-semibold text-yellow-800">Filtro ativo:</span>
                  <span className="text-yellow-900">Run <b>{runFilter}</b></span>
                  <button
                    className="ml-2 rounded border border-yellow-300 px-2 py-0.5 text-yellow-800 hover:bg-yellow-100"
                    onClick={() => {
                      const params = new URLSearchParams(searchParams?.toString() || "");
                      params.delete("run");
                      router.replace(`?${params.toString()}`);
                    }}
                  >
                    Remover filtro
                  </button>
                </div>
              )}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg sm:text-xl font-semibold text-(--tc-text-primary,#0b1a3c)">Lista de defeitos</h2>
                <div className="flex flex-wrap gap-2 text-sm">
                  <select
                    className="rounded-lg border border-(--tc-border,#e5e7eb) px-3 py-2 text-sm"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    aria-label="Filtrar por status"
                  >
                    <option value="all">Status: todos</option>
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <select
                    className="rounded-lg border border-(--tc-border,#e5e7eb) px-3 py-2 text-sm"
                    value={originFilter}
                    onChange={(e) => setOriginFilter(e.target.value)}
                    aria-label="Filtrar por origem"
                  >
                    <option value="all">Origem: todas</option>
                    <option value="manual">Manuais</option>
                    <option value="automatico">AutomÃƒÂ¡ticos</option>
                  </select>
                </div>
              </div>
              {filtered.length === 0 ? (
                <p className="text-sm text-(--tc-text-muted,#6b7280)">Nenhum defeito encontrado.</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                      {filtered.map((d, index) => {
                        const isPrimaryAction = index === 0;
                        const canEdit = isAdmin || (isCompany && d.origin === "manual");
                        const canDelete = isAdmin && d.origin === "manual";
                        const canLinkRun = isAdmin || (isCompany && d.origin === "manual");
                        return (
                        <div
                          data-testid={d.origin === "manual" ? `defect-item-manual-${d.id}` : `defect-item-${d.id}`}
                          key={d.id}
                          className="rounded-xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) p-4 shadow-sm space-y-2 hover:shadow-md transition"
                        >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        {d.origin === "manual" ? (
                          <button
                            type="button"
                            onClick={() => openEditModal(d)}
                            className="min-w-0 text-left font-semibold text-(--tc-text-primary,#0b1a3c) truncate hover:underline"
                            title={d.title}
                          >
                            {d.title}
                          </button>
                        ) : (
                          <div className="min-w-0 font-semibold text-(--tc-text-primary,#0b1a3c) truncate" title={d.title}>
                            {d.title}
                          </div>
                        )}
                        <select
                          className={`shrink-0 rounded-md border px-2 py-1 text-[11px] font-semibold transition ${getStatusColor(
                            d.status
                          )}`}
                          value={d.status}
                          aria-label={`Status do defeito ${d.title}`}
                          disabled
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <p className="text-xs text-(--tc-text-secondary,#4b5563)">
                        <span data-testid="defect-run">
                          Run: {d.runSlug || d.run?.id || d.run?.name || "N?o informado"}
                          {d.run?.status ? ` (${d.run.status})` : ""}
                        </span>
                                            {d.release && (
                                              <span className="text-xs text-(--tc-text-secondary,#4b5563)" data-testid="defect-release">
                                                Release: {d.release.version || d.release.id}
                                                {d.release.status ? ` (${d.release.status})` : ""}
                                              </span>
                                            )}
                      </p>
                      <p className="text-xs text-(--tc-text-secondary,#4b5563)">Caso: {d.id}</p>
                      <p className="text-xs text-(--tc-text-secondary,#4b5563)">App: {d.app}</p>
                      <p className="text-xs text-(--tc-text-secondary,#4b5563)">Origem: {d.origin === "manual" ? "Manual" : "AutomÃƒÂ¡tica"}</p>
                      <p className="text-xs text-(--tc-text-secondary,#4b5563)">Responsável: {d.responsible ?? "N/D"}</p>
                      <span className="text-xs text-(--tc-text-secondary,#4b5563)">MTTR: {formatMTTR(d.mttrMs)}</span>
                      {d.link && d.link !== "#" && (
                        <a
                          href={d.link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-(--tc-accent,#ef0001) hover:underline"
                        >
                          Abrir link
                        </a>
                      )}
                      {d.origin === "manual" && (
                        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-(--tc-border,#e5e7eb) pt-3 text-xs">
                          {canLinkRun && (
                            <button
                              type="button"
                              data-testid={isPrimaryAction ? "defect-link-run" : undefined}
                              onClick={() => openEditModal(d)}
                              className="flex items-center gap-1 rounded-full border border-(--tc-border,#e5e7eb) px-3 py-1 text-(--tc-text-secondary,#4b5563) hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)"
                            >
                              Linkar a run
                            </button>
                          )}
                          {canEdit && (
                            <button
                              type="button"
                              data-testid={isPrimaryAction ? "defect-edit" : undefined}
                              onClick={() => openEditModal(d)}
                              className="flex items-center gap-1 rounded-full border border-(--tc-border,#e5e7eb) px-3 py-1 text-(--tc-text-secondary,#4b5563) hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)"
                            >
                              <FiEdit3 size={14} />
                              Editar
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              data-testid={isPrimaryAction ? "defect-delete" : undefined}
                              onClick={() => deleteManualDefect(d)}
                              disabled={deletingId === d.id}
                              className="flex items-center gap-1 rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                            >
                              <FiTrash2 size={14} />
                              {deletingId === d.id ? "Excluindo..." : "Excluir"}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )})}
                </div>
              )}
            </section>
          </>
        )}
      </div>
      {editingDefect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" data-testid="defect-modal">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-(--tc-text-muted,#6b7280)">Editar defeito</p>
                <h3 className="text-xl font-semibold text-(--tc-text-primary,#0b1a3c)">{editingDefect.title}</h3>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="text-sm font-semibold uppercase text-(--tc-text-muted,#6b7280)"
              >
                Fechar
              </button>
            </div>
            <div className="mt-4 space-y-4">
              {editingDefect.origin === "qase" && (
                <div className="rounded bg-yellow-50 border border-yellow-200 p-3 text-xs text-yellow-800 mb-2">
                  Defeito sincronizado do Qase (somente leitura)
                </div>
              )}
              <label className="block text-sm font-semibold text-(--tc-text-secondary,#4b5563)">
                Título
                <input
                  type="text"
                  value={modalForm.title}
                  onChange={(event) => setModalForm((prev) => ({ ...prev, title: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-(--tc-border,#e5e7eb) px-3 py-2 text-sm"
                  disabled={editingDefect.origin !== "manual"}
                />
              </label>
              <label className="block text-sm font-semibold text-(--tc-text-secondary,#4b5563)">
                Run associada
                <input
                  type="text"
                  data-testid="defect-run-input"
                  list="modal-run-list"
                  value={modalForm.runSlug ?? ''}
                  onChange={event => setModalForm(prev => ({ ...prev, runSlug: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-(--tc-border,#e5e7eb) px-3 py-2 text-sm"
                  placeholder="Buscar run..."
                  disabled={editingDefect.origin !== "manual"}
                />
                <datalist id="modal-run-list">
                  {runs.map(run => (
                    <option key={run.slug} value={run.slug}>
                      {run.slug}
                    </option>
                  ))}
                  {modalRunSlug && !hasModalRun && (
                    <option value={modalRunSlug}>{modalRunSlug}</option>
                  )}
                </datalist>
                {editingDefect.origin === "manual" && (modalRunSlug || modalRunOptions.length > 0) && (
                  <div className="mt-2 max-h-32 overflow-auto rounded-lg border border-(--tc-border,#e5e7eb) bg-white text-sm shadow-sm">
                    {modalRunOptions.map((run) => (
                      <button
                        key={run.slug}
                        type="button"
                        data-testid={`run-option-${run.slug}`}
                        onClick={() => setModalForm((prev) => ({ ...prev, runSlug: run.slug }))}
                        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-(--tc-surface,#f8fafc)"
                      >
                        <span className="font-medium text-(--tc-text-primary,#0b1a3c)">
                          {run.name ?? run.slug}
                        </span>
                        <span className="text-xs text-(--tc-text-muted,#6b7280)">{run.slug}</span>
                      </button>
                    ))}
                    {modalRunSlug && !hasModalRun && (
                      <button
                        type="button"
                        data-testid={`run-option-${modalRunSlug}`}
                        onClick={() => setModalForm((prev) => ({ ...prev, runSlug: modalRunSlug }))}
                        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-(--tc-surface,#f8fafc)"
                      >
                        <span className="font-medium text-(--tc-text-primary,#0b1a3c)">{modalRunSlug}</span>
                        <span className="text-xs text-(--tc-text-muted,#6b7280)">Usar run digitada</span>
                      </button>
                    )}
                  </div>
                )}
              </label>
              <label className="block text-sm font-semibold text-(--tc-text-secondary,#4b5563)">
                Status
                <select
                  data-testid="defect-status-select"
                  value={modalForm.status}
                  onChange={(event) => setModalForm((prev) => ({ ...prev, status: event.target.value as DefectItem["status"] }))}
                  className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${getStatusColor(modalForm.status)}`}
                  disabled={editingDefect.origin !== "manual"}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  aria-hidden="true"
                  tabIndex={-1}
                  data-testid="defect-status"
                  value={modalForm.status}
                  onChange={(event) => setModalForm((prev) => ({ ...prev, status: event.target.value as DefectItem["status"] }))}
                  className="sr-only"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold text-(--tc-text-secondary,#4b5563)">
                Link
                <input
                  type="text"
                  value={modalForm.link}
                  onChange={(event) => setModalForm((prev) => ({ ...prev, link: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-(--tc-border,#e5e7eb) px-3 py-2 text-sm"
                  placeholder="https://"
                  disabled={editingDefect.origin !== "manual"}
                />
              </label>
              <label className="block text-sm font-semibold text-(--tc-text-secondary,#4b5563)">
                Responsável
                <input
                  type="text"
                  value={modalForm.responsible}
                  onChange={(event) => setModalForm((prev) => ({ ...prev, responsible: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-(--tc-border,#e5e7eb) px-3 py-2 text-sm"
                  placeholder="Nome do responsável"
                  disabled={editingDefect.origin !== "manual"}
                />
              </label>
                <div className="text-xs text-gray-500">
                  <div>Abertura: {editingDefect.openedAt ? new Date(editingDefect.openedAt).toLocaleString() : "-"}</div>
                  <div>Fechamento: {editingDefect.closedAt ? new Date(editingDefect.closedAt).toLocaleString() : "-"}</div>
                  <div>MTTR: <span>{formatMTTR(editingDefect.mttrMs)}</span></div>
                </div>
            </div>
            {modalError && <p className="mt-2 text-xs text-rose-600">{modalError}</p>}
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg border border-(--tc-border,#e5e7eb) px-4 py-2 text-xs font-semibold text-(--tc-text-secondary,#4b5563)"
              >
                Cancelar
              </button>
              {editingDefect.origin === "manual" && (
                <button
                  type="button"
                  onClick={handleModalSave}
                  disabled={modalSaving}
                  data-testid="defect-save"
                  className="rounded-lg bg-(--tc-accent,#ef0001) px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white disabled:opacity-60"
                >
                  {modalSaving ? "Salvando..." : "Salvar alterações"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

