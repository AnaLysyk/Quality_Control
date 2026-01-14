"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { FiEdit3, FiSearch, FiTrash2 } from "react-icons/fi";
import { useParams } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import { useAuthUser } from "@/hooks/useAuthUser";

type DefectItem = {
  id: string;
  runSlug: string;
  title: string;
  app: string;
  status: "fail" | "blocked" | "pending" | "done" | string;
  severity: string;
  link?: string;
  origin?: "manual" | "automatico";
  createdBy?: string | null;
  responsible?: string | null;
  createdAt?: string | null;
  runName?: string;
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
  { id: "fail", label: "Em falha" },
  { id: "blocked", label: "Bloqueado" },
  { id: "pending", label: "Aguardando teste" },
  { id: "done", label: "Concluído" },
];

const STATUS_COLOR_CLASSES: Record<DefectItem["status"], string> = {
  fail: "border-rose-300/70 bg-rose-50 text-rose-700",
  blocked: "border-amber-300/70 bg-amber-50 text-amber-700",
  pending: "border-sky-300/70 bg-sky-50 text-sky-700",
  done: "border-emerald-300/70 bg-emerald-50 text-emerald-700",
};

function getStatusColor(status: DefectItem["status"]) {
  return STATUS_COLOR_CLASSES[status] ?? "border-slate-300/70 bg-slate-50 text-slate-700";
}

const STATUS_TO_STATS: Record<DefectItem["status"], { fail: number; blocked: number; notRun: number; pass: number }> = {
  fail: { fail: 1, blocked: 0, notRun: 0, pass: 0 },
  blocked: { fail: 0, blocked: 1, notRun: 0, pass: 0 },
  pending: { fail: 0, blocked: 0, notRun: 1, pass: 0 },
  done: { fail: 0, blocked: 0, notRun: 0, pass: 1 },
};

function deriveStatusFromStats(stats: { fail?: number; blocked?: number; notRun?: number }) {
  const { fail = 0, blocked = 0, notRun = 0 } = stats;
  if (blocked > 0) return "blocked";
  if (fail > 0) return "fail";
  if (notRun > 0) return "pending";
  return "done";
}

export default function DefeitosEmpresaPage() {
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
    status: "pending",
    link: "",
    runSlug: "",
    responsible: "",
  };

  const { user } = useAuthUser();
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
    status: "fail" as DefectItem["status"],
    link: "",
    responsible: "",
  });
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSaving, setModalSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [qaseRes, manualRes] = await Promise.all([
        fetch(`/api/empresas/${slug}/defeitos`, { cache: "no-store" }),
        fetch(`/api/releases-manual?clientSlug=${encodeURIComponent(slug)}`, { cache: "no-store" }),
      ]);
      const qaseJson = (await qaseRes.json().catch(() => null)) as unknown;
      const qaseRecord = (qaseJson ?? null) as Record<string, unknown> | null;
      const qaseError = typeof qaseRecord?.error === "string" ? qaseRecord.error : null;
      const qaseList =
        (Array.isArray(qaseRecord?.defects) ? (qaseRecord?.defects as unknown[]) : null) ??
        (Array.isArray(qaseRecord?.items) ? (qaseRecord?.items as unknown[]) : []);

      const manualJson = (await manualRes.json().catch(() => null)) as unknown;
      const manualList = Array.isArray(manualJson)
        ? (manualJson as {
            slug: string;
            name: string;
            app: string;
            stats: Record<string, number>;
            createdAt?: string;
            responsible?: string;
          }[])
        : [];

      const manualDefects: DefectItem[] = manualList.map((release) => {
        const { fail = 0, blocked = 0, notRun = 0 } = release.stats ?? {};
        const status =
          blocked > 0 ? "blocked" : fail > 0 ? "fail" : notRun > 0 ? "pending" : "done";
        const severity = blocked > 0 ? "Crítica" : fail > 0 ? "Alta" : "Média";
        return {
          id: `manual-${release.slug}`,
          runSlug: release.slug,
          title: release.name,
          app: release.app,
          status,
          severity,
          link: `/empresas/${encodeURIComponent(slug)}/runs/${encodeURIComponent(release.slug)}`,
          origin: "manual",
          createdBy: "Manual",
          responsible: release.responsible ?? "Manual",
          createdAt: release.createdAt,
        };
      });

      const qaseItems = Array.isArray(qaseList) ? (qaseList as DefectItem[]) : [];
      const merged = [...manualDefects, ...qaseItems];
      setDefects(merged);
      setError(qaseError);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar defeitos");
      setDefects([]);
    } finally {
      setLoading(false);
    }
  }, [slug]);

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
        if (!res.ok) throw new Error("Não foi possível carregar as runs");
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

  const filtered = useMemo(() => {
    return defects.filter((d) => {
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (originFilter !== "all" && d.origin !== originFilter) return false;
      return true;
    });
  }, [defects, statusFilter, originFilter]);

  async function addManualDefect() {
    if (!form.title.trim()) return;
    setCreating(true);
    const manualApp = slug.toUpperCase();
    const responsibleValue = form.responsible.trim() || user?.name || "Manual";
    try {
      await fetch("/api/releases-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.title.trim(),
          app: manualApp,
          clientSlug: slug,
          stats: { pass: 0, fail: form.status === "fail" ? 1 : 0, blocked: form.status === "blocked" ? 1 : 0, notRun: form.status === "pending" ? 1 : 0 },
          observations: form.description,
          slug: form.runSlug,
          responsible: responsibleValue,
        }),
      });
      setForm({ ...defaultForm, responsible: user?.name ?? "" });
      await load();
    } catch (err) {
      console.error("Erro ao criar defeito manual", err);
    } finally {
      setCreating(false);
    }
  }

  function updateStatus(id: string, next: DefectItem["status"]) {
    setDefects((prev) => prev.map((d) => (d.id === id ? { ...d, status: next } : d)));
  }

  async function deleteManualDefect(defect: DefectItem) {
    if (defect.origin !== "manual" || !defect.runSlug) return;
    setDeletingId(defect.id);
    try {
      const res = await fetch(`/api/releases-manual/${encodeURIComponent(defect.runSlug)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message ?? "Não foi possível excluir o defeito");
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
      responsible: defect.responsible ?? defect.createdBy ?? "",
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
    const slug =
      editingDefect.origin === "manual" ? editingDefect.runSlug : editingDefect.id.replace("manual-", "");
    try {
      const payload: Record<string, unknown> = { name: modalForm.title.trim() };
      const statusStats = STATUS_TO_STATS[modalForm.status] ?? STATUS_TO_STATS["fail"];
      payload.stats = statusStats;
      const responsibleValue =
        modalForm.responsible.trim() || editingDefect.responsible || editingDefect.createdBy || "";
      if (responsibleValue) {
        payload.responsible = responsibleValue;
      }
      if (modalForm.link.trim()) {
        payload.observations = modalForm.link.trim();
      }
      const res = await fetch(`/api/releases-manual/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message ?? "Não foi possível atualizar o defeito");
      }
      const updated = await res.json().catch(() => null);
      const nextStatus = updated?.stats ? deriveStatusFromStats(updated.stats) : modalForm.status;
      setDefects((prev) =>
        prev.map((d) =>
          d.id === editingDefect.id
          ? {
              ...d,
              title: modalForm.title.trim(),
              status: nextStatus,
              link: modalForm.link.trim() || d.link,
              responsible: responsibleValue || d.responsible,
            }
            : d
        )
      );
      closeModal();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao salvar";
      setModalError(message);
    } finally {
      setModalSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-(--page-bg,#f7f9fb) text-(--page-text,#0b1a3c)">
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
            Visão consolidada da empresa {companyName}. Agrupa execuções com status crítico e links para investigação.
          </p>
        </header>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {loading && <p className="text-sm text-(--tc-text-muted,#6b7280)">Carregando defeitos...</p>}

        {!loading && (
          <>
            <section className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) p-4 sm:p-6 shadow-sm space-y-4">
              <h2 className="text-lg sm:text-xl font-semibold text-(--tc-text-primary,#0b1a3c)">Criar defeito manual</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-sm">
                  Título
                  <input
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
                            {run.name ? `${run.name} (${run.slug})` : run.slug}
                          </option>
                        ))}
                      </datalist>
                    </div>
                  )}
                  {runsError && <span className="text-xs text-red-500">{runsError}</span>}
                </label>
                <label className="grid gap-1 text-sm">
                  Responsável
                  <input
                    className="rounded-lg border border-(--tc-border,#e5e7eb) px-3 py-2 text-sm"
                    list="responsible-options"
                    value={form.responsible}
                    onChange={(e) => setForm((p) => ({ ...p, responsible: e.target.value }))}
                    placeholder="Nome do responsável"
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
                  Descrição (opcional)
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
                  type="button"
                  onClick={addManualDefect}
                  className="inline-flex justify-center rounded-lg bg-(--tc-accent,#ef0001) px-4 py-2 text-sm font-semibold text-white shadow hover:brightness-110 disabled:opacity-60"
                  disabled={!form.title.trim() || creating}
                >
                  {creating ? "Incluindo..." : "Adicionar defeito manual"}
                </button>
            </section>

            <section className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) p-4 sm:p-6 shadow-sm space-y-4">
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
                    <option value="automatico">Automáticos</option>
                  </select>
                </div>
              </div>
              {filtered.length === 0 ? (
                <p className="text-sm text-(--tc-text-muted,#6b7280)">Nenhum defeito encontrado.</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {filtered.map((d) => (
                    <div
                      key={d.id}
                      className="rounded-xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) p-4 shadow-sm space-y-2 hover:shadow-md transition"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 font-semibold text-(--tc-text-primary,#0b1a3c) truncate" title={d.title}>
                          {d.title}
                        </div>
                        <select
                          className={`shrink-0 rounded-md border px-2 py-1 text-[11px] font-semibold transition ${getStatusColor(
                            d.status
                          )}`}
                          value={d.status}
                          onChange={(e) => updateStatus(d.id, e.target.value as DefectItem['status'])}
                          aria-label={`Atualizar status do defeito ${d.title}`}
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <p className="text-xs text-(--tc-text-secondary,#4b5563)">
                        Run: {(d.runName ?? d.runSlug) || "Não informado"}
                        {(d.runName && d.runSlug && d.runName !== d.runSlug) ? ` (${d.runSlug})` : ""}
                      </p>
                      <p className="text-xs text-(--tc-text-secondary,#4b5563)">Caso: {d.id}</p>
                      <p className="text-xs text-(--tc-text-secondary,#4b5563)">App: {d.app}</p>
                      <p className="text-xs text-(--tc-text-secondary,#4b5563)">Origem: {d.origin === "manual" ? "Manual" : "Automática"}</p>
                      <p className="text-xs text-(--tc-text-secondary,#4b5563)">Responsável: {d.responsible ?? d.createdBy ?? "N/D"}</p>
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
                          <button
                            type="button"
                            onClick={() => openEditModal(d)}
                            className="flex items-center gap-1 rounded-full border border-(--tc-border,#e5e7eb) px-3 py-1 text-(--tc-text-secondary,#4b5563) hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)"
                          >
                            <FiEdit3 size={14} />
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteManualDefect(d)}
                            disabled={deletingId === d.id}
                            className="flex items-center gap-1 rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                          >
                            <FiTrash2 size={14} />
                            {deletingId === d.id ? "Excluindo..." : "Excluir"}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
      {editingDefect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-(--tc-text-muted,#6b7280)">Editar defeito</p>
                <h3 className="text-xl font-semibold text-(--tc-text-primary,#0b1a3c)">
                  {editingDefect.title}
                </h3>
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
              <label className="block text-sm font-semibold text-(--tc-text-secondary,#4b5563)">
                Título
                <input
                  type="text"
                  value={modalForm.title}
                  onChange={(event) => setModalForm((prev) => ({ ...prev, title: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-(--tc-border,#e5e7eb) px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm font-semibold text-(--tc-text-secondary,#4b5563)">
                Status
                <select
                  value={modalForm.status}
                  onChange={(event) => setModalForm((prev) => ({ ...prev, status: event.target.value as DefectItem["status"] }))}
                  className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${getStatusColor(modalForm.status)}`}
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
                />
              </label>
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
              <button
                type="button"
                onClick={handleModalSave}
                disabled={modalSaving}
                className="rounded-lg bg-(--tc-accent,#ef0001) px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white disabled:opacity-60"
              >
                {modalSaving ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
