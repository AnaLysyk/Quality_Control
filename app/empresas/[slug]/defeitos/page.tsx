"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuthUser } from "@/hooks/useAuthUser";
import { slugifyRelease } from "@/lib/slugifyRelease";
import { calcMTTR } from "@/lib/mttr";
import { normalizeDefectStatus, resolveClosedAt, resolveOpenedAt } from "@/lib/defectNormalization";

type ManualDefect = {
  id: string;
  slug: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt?: string | null;
  closedAt?: string | null;
  runSlug?: string | null;
  stats?: { pass: number; fail: number; blocked: number; notRun: number };
};

type ManualRun = {
  slug: string;
  name: string;
};

type DefectHistoryEvent = {
  id: string;
  action: string;
  createdAt: string;
  actorName?: string | null;
  actorId?: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  fromRunSlug?: string | null;
  toRunSlug?: string | null;
  note?: string | null;
};

const LOCAL_LINKS_KEY = "qc_defect_run_links";

function normalizeDefects(data: unknown[]): ManualDefect[] {
  return data
    .map((item) => {
      const rec = (item ?? {}) as Record<string, unknown>;
      const slug = String(rec.slug ?? rec.id ?? "");
      return {
        id: String(rec.id ?? slug),
        slug,
        name: String(rec.name ?? rec.title ?? slug),
        status: String(rec.status ?? "open"),
        createdAt: typeof rec.createdAt === "string" ? rec.createdAt : new Date().toISOString(),
        updatedAt: typeof rec.updatedAt === "string" ? rec.updatedAt : null,
        closedAt: typeof rec.closedAt === "string" ? rec.closedAt : null,
        runSlug: typeof rec.runSlug === "string" ? rec.runSlug : null,
        stats: typeof rec.stats === "object" && rec.stats ? (rec.stats as ManualDefect["stats"]) : undefined,
      } satisfies ManualDefect;
    })
    .filter((defect) => defect.slug.length > 0);
}

function normalizeRuns(data: unknown[]): ManualRun[] {
  return data
    .map((item) => {
      const rec = (item ?? {}) as Record<string, unknown>;
      return {
        slug: String(rec.slug ?? rec.id ?? ""),
        name: String(rec.name ?? rec.title ?? rec.slug ?? "Run manual"),
      } satisfies ManualRun;
    })
    .filter((run) => run.slug.length > 0);
}

function formatDefectStatus(value?: string | null) {
  const normalized = normalizeDefectStatus(value ?? "");
  if (normalized === "done") return "Concluido";
  if (normalized === "in_progress") return "Em andamento";
  return "Aberto";
}

function formatHistoryLabel(item: DefectHistoryEvent) {
  switch (item.action) {
    case "created":
      return item.note ? `Defeito criado: ${item.note}` : "Defeito criado";
    case "status_changed":
      return `Status: ${formatDefectStatus(item.fromStatus)} -> ${formatDefectStatus(item.toStatus)}`;
    case "run_linked":
      return item.toRunSlug ? `Run vinculada: ${item.toRunSlug}` : "Run vinculada";
    case "run_unlinked":
      return item.fromRunSlug ? `Run removida: ${item.fromRunSlug}` : "Run removida";
    case "deleted":
      return item.note ? `Defeito removido: ${item.note}` : "Defeito removido";
    case "updated":
      return item.note ?? "Defeito atualizado";
    default:
      return item.note ?? "Atualizacao registrada";
  }
}

function sortDefects(items: ManualDefect[]) {
  return [...items].sort((a, b) => {
    const timeA = Date.parse(a.createdAt ?? "") || 0;
    const timeB = Date.parse(b.createdAt ?? "") || 0;
    return timeB - timeA;
  });
}

export default function CompanyDefectsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuthUser();

  const slugParam = params?.slug;
  const companySlug = Array.isArray(slugParam) ? slugParam[0] : slugParam;

  const [defects, setDefects] = useState<ManualDefect[]>([]);
  const [runs, setRuns] = useState<ManualRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [runSlugInput, setRunSlugInput] = useState("");
  const [activeDefect, setActiveDefect] = useState<ManualDefect | null>(null);
  const [editStatus, setEditStatus] = useState("open");
  const [linkingDefectId, setLinkingDefectId] = useState<string | null>(null);
  const [linkInput, setLinkInput] = useState("");
  const [historyItems, setHistoryItems] = useState<DefectHistoryEvent[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const role = typeof user?.role === "string" ? user.role.toLowerCase() : "";
  const isAdmin = Boolean(user?.isGlobalAdmin || role === "admin");
  const canEdit = isAdmin || role === "company";
  const canDelete = isAdmin;
  const canLink = isAdmin || role === "company";
  const canCreate = Boolean(isAdmin || role === "company" || role === "user");

  const runFilter = searchParams?.get("run") ?? "";
  const runFilterLabel =
    runFilter && runs.length > 0
      ? runs.find((run) => run.slug === runFilter)?.name ?? runFilter
      : runFilter;

  const readLocalLinks = () => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem(LOCAL_LINKS_KEY);
      return raw ? (JSON.parse(raw) as Record<string, Record<string, string>>) : {};
    } catch {
      return {};
    }
  };

  const writeLocalLinks = (payload: Record<string, Record<string, string>>) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(LOCAL_LINKS_KEY, JSON.stringify(payload));
    } catch {
      // ignore
    }
  };

  const mergeLocalLinks = useCallback((items: ManualDefect[]) => {
    if (!companySlug) return items;
    const map = readLocalLinks();
    const companyLinks = map[companySlug] ?? {};
    return items.map((item) => {
      if (item.runSlug) return item;
      const localRun = companyLinks[item.slug];
      return localRun ? { ...item, runSlug: localRun } : item;
    });
  }, [companySlug]);

  useEffect(() => {
    if (!companySlug) return;
    let active = true;
    setLoading(true);
    Promise.all([
      fetch(`/api/releases-manual?clientSlug=${encodeURIComponent(companySlug)}&kind=defect`, { cache: "no-store" })
        .then((res) => res.json())
        .then((data) => {
          if (!active) return;
          const normalized = normalizeDefects(Array.isArray(data) ? data : []);
          setDefects(sortDefects(mergeLocalLinks(normalized)));
        }),
      fetch(`/api/releases-manual?clientSlug=${encodeURIComponent(companySlug)}&kind=run`, { cache: "no-store" })
        .then((res) => res.json())
        .then((data) => {
          if (!active) return;
          setRuns(normalizeRuns(Array.isArray(data) ? data : []));
        }),
    ])
      .catch(() => {
        if (!active) return;
        setDefects([]);
        setRuns([]);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [companySlug, mergeLocalLinks]);

  const filteredDefects = useMemo(() => {
    if (!runFilter) return defects;
    return defects.filter((defect) => defect.runSlug === runFilter);
  }, [defects, runFilter]);

  const metrics = useMemo(() => {
    const normalized = defects.map((defect) => {
      const status = normalizeDefectStatus(defect.status);
      const openedAt = resolveOpenedAt(defect.createdAt);
      const closedAt = resolveClosedAt(status, defect.closedAt ?? null, defect.updatedAt ?? null);
      const mttrMs = calcMTTR(openedAt, closedAt);
      return { status, openedAt, closedAt, mttrMs };
    });
    const closed = normalized.filter((d) => d.status === "done" && d.mttrMs != null);
    const mttrAvg =
      closed.length > 0
        ? Math.round((closed.reduce((acc, item) => acc + (item.mttrMs ?? 0), 0) / closed.length) / 360000) / 10
        : null;
    return {
      open: normalized.filter((d) => d.status !== "done").length,
      closed: normalized.filter((d) => d.status === "done").length,
      mttrAvg,
    };
  }, [defects]);

  const getDefectMttrHours = (defect: ManualDefect) => {
    const status = normalizeDefectStatus(defect.status);
    const openedAt = resolveOpenedAt(defect.createdAt);
    const closedAt = resolveClosedAt(status, defect.closedAt ?? null, defect.updatedAt ?? null);
    const mttrMs = calcMTTR(openedAt, closedAt);
    return mttrMs != null ? Math.round(mttrMs / 360000) / 10 : null;
  };

  const mttrTestSlug = useMemo(() => {
    for (const defect of filteredDefects) {
      if (getDefectMttrHours(defect) != null) return defect.slug;
    }
    return null;
  }, [filteredDefects]);

  const loadHistory = async (defectSlug: string) => {
    if (!defectSlug) return;
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await fetch(`/api/releases-manual/${encodeURIComponent(defectSlug)}/history`, {
        cache: "no-store",
        credentials: "include",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setHistoryItems([]);
        setHistoryError(typeof payload?.message === "string" ? payload.message : "Erro ao carregar historico");
        return;
      }
      const items = Array.isArray(payload?.items) ? (payload.items as DefectHistoryEvent[]) : [];
      setHistoryItems(items);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar historico";
      setHistoryItems([]);
      setHistoryError(msg);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!companySlug || !title.trim() || !canCreate) return;
    setSaving(true);
    const slug = slugifyRelease(title);
    const now = new Date().toISOString();
    const optimistic: ManualDefect = {
      id: slug,
      slug,
      name: title.trim(),
      status: "open",
      createdAt: now,
      updatedAt: now,
      runSlug: runSlugInput.trim() || null,
      stats: { pass: 0, fail: 1, blocked: 0, notRun: 0 },
    };
    setDefects((prev) => sortDefects([optimistic, ...prev.filter((item) => item.slug !== slug)]));
    try {
      const res = await fetch("/api/releases-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          kind: "defect",
          name: title.trim(),
          slug,
          clientSlug: companySlug,
          status: "open",
          runSlug: runSlugInput.trim() || undefined,
          stats: { pass: 0, fail: 1, blocked: 0, notRun: 0 },
        }),
      });
      if (!res.ok) throw new Error("Erro ao criar defeito");
      const created = (await res.json()) as Record<string, unknown>;
      setDefects((prev) => {
        const normalized = normalizeDefects([created])[0];
        if (!normalized) return prev;
        const withLocal = mergeLocalLinks([normalized])[0] ?? normalized;
        const filtered = prev.filter((item) => item.slug !== normalized.slug);
        return sortDefects([withLocal, ...filtered]);
      });
      setTitle("");
      setRunSlugInput("");
    } catch {
      setDefects((prev) => prev.filter((item) => item.slug !== slug));
    } finally {
      setSaving(false);
    }
  };

  const handleOpenModal = (defect: ManualDefect) => {
    setActiveDefect(defect);
    setEditStatus(normalizeDefectStatus(defect.status));
    setHistoryItems([]);
    setHistoryError(null);
    loadHistory(defect.slug);
  };

  const handleSaveModal = async () => {
    if (!activeDefect) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/releases-manual/${encodeURIComponent(activeDefect.slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: editStatus }),
      });
      if (res.ok) {
        const updated = (await res.json()) as Record<string, unknown>;
        setDefects((prev) =>
          sortDefects(
            prev.map((item) => (item.slug === activeDefect.slug ? normalizeDefects([updated])[0] : item)),
          ),
        );
        await loadHistory(activeDefect.slug);
      }
    } finally {
      setSaving(false);
      setActiveDefect(null);
    }
  };

  const handleLinkSave = async () => {
    if (!linkingDefectId || !linkInput.trim()) return;
    setSaving(true);
    const nextRunSlug = linkInput.trim();
    const current = defects.find((item) => item.slug === linkingDefectId) ?? null;
    try {
      const res = await fetch(`/api/releases-manual/${encodeURIComponent(linkingDefectId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ runSlug: nextRunSlug }),
      });
      if (res.ok) {
        const updated = (await res.json()) as Record<string, unknown>;
        const normalized = normalizeDefects([updated])[0];
        if (normalized) {
          setDefects((prev) =>
            sortDefects(prev.map((item) => (item.slug === linkingDefectId ? normalized : item))),
          );
        }
      } else if (current) {
        setDefects((prev) =>
          sortDefects(
            prev.map((item) =>
              item.slug === linkingDefectId ? { ...item, runSlug: nextRunSlug } : item,
            ),
          ),
        );
      }
    } finally {
      if (companySlug) {
        const map = readLocalLinks();
        const companyLinks = map[companySlug] ?? {};
        companyLinks[linkingDefectId] = nextRunSlug;
        map[companySlug] = companyLinks;
        writeLocalLinks(map);
      }
      setSaving(false);
      setLinkingDefectId(null);
      setLinkInput("");
    }
  };

  const handleDelete = async (slug: string) => {
    if (!canDelete) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/releases-manual/${encodeURIComponent(slug)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setDefects((prev) => prev.filter((item) => item.slug !== slug));
      }
    } finally {
      setSaving(false);
    }
  };

  const runOptions = useMemo(() => {
    const trimmed = linkInput.trim();
    const list = runs.map((run) => run.slug);
    if (!trimmed) return list;
    return [trimmed, ...list.filter((slug) => slug !== trimmed)];
  }, [runs, linkInput]);

  return (
    <div className="min-h-screen bg-(--page-bg,#f5f6fa) text-(--page-text,#0b1a3c) px-4 py-8 sm:px-6 lg:px-10" data-testid="defects-page">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.4em] text-(--tc-accent,#ef0001)">Defeitos</p>
          <h1 className="mt-2 text-3xl font-extrabold">Defeitos manuais</h1>
          <p className="mt-2 text-sm text-(--tc-text-secondary,#4b5563)">
            Crie, edite e vincule defeitos as runs da empresa.
          </p>
        </header>

        {runFilter && (
          <div className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-white px-4 py-3 text-sm">
            Filtro ativo: <strong>{runFilterLabel}</strong>
            <button
              type="button"
              onClick={() => router.replace(`/empresas/${encodeURIComponent(companySlug ?? "")}/defeitos`)}
              className="ml-3 rounded-full border border-(--tc-border,#e5e7eb) px-3 py-1 text-xs font-semibold"
            >
              Remover filtro
            </button>
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-(--tc-text-muted)">Defeitos abertos</p>
            <div className="mt-2 text-3xl font-extrabold">{metrics.open}</div>
          </div>
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-(--tc-text-muted)">MTTR medio</p>
            <div className="mt-2 text-3xl font-extrabold" data-testid="metric-mttr">
              {metrics.mttrAvg == null ? "-" : `${metrics.mttrAvg}h`}
            </div>
          </div>
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-(--tc-text-muted)">Defeitos fechados</p>
            <div className="mt-2 text-3xl font-extrabold" data-testid="metric-defects-closed">
              {metrics.closed}
            </div>
          </div>
        </section>

        {canCreate && (
          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="grid gap-3 md:grid-cols-[2fr_1fr_auto]">
              <input
                data-testid="defect-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Titulo do defeito"
                className="rounded-2xl border border-(--tc-border,#e5e7eb) px-4 py-3 text-sm outline-none focus:border-(--tc-accent,#ef0001)"
              />
              <input
                data-testid="defect-run-select"
                value={runSlugInput}
                onChange={(e) => setRunSlugInput(e.target.value)}
                placeholder="Slug da run (opcional)"
                className="rounded-2xl border border-(--tc-border,#e5e7eb) px-4 py-3 text-sm outline-none focus:border-(--tc-accent,#ef0001)"
              />
              <button
                type="button"
                data-testid="defect-create"
                onClick={handleCreate}
                disabled={saving || !title.trim()}
                className="rounded-2xl bg-(--tc-accent,#ef0001) px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                Criar defeito
              </button>
            </div>
          </section>
        )}

        <section className="rounded-3xl bg-white p-6 shadow-sm" data-testid="defects-list">
          {loading && <p className="text-sm text-(--tc-text-muted)">Carregando defeitos...</p>}
          {!loading && filteredDefects.length === 0 && (
            <p className="text-sm text-(--tc-text-muted)">Nenhum defeito encontrado.</p>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {filteredDefects.map((defect, index) => {
              const status = normalizeDefectStatus(defect.status);
              const mttrHours = getDefectMttrHours(defect);
              const testId = defect.runSlug ? `defect-item-manual-${defect.runSlug}` : `defect-item-${defect.slug}`;
              const isPrimary = index === 0;
              const isMttrTarget = mttrTestSlug != null && defect.slug === mttrTestSlug;
              const isLinking = linkingDefectId === defect.slug;
              return (
                <div
                  key={defect.slug}
                  data-testid={testId}
                  className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#f9fafb) p-4"
                >
                  <button
                    type="button"
                    onClick={() => handleOpenModal(defect)}
                    className="text-left text-base font-semibold text-(--tc-text-primary,#0b1a3c)"
                  >
                    {defect.name}
                  </button>
                  <div className="mt-2 text-xs text-(--tc-text-muted)">
                    Status: {status}
                  </div>
                  {defect.runSlug && (
                    <div className="mt-1 text-xs text-(--tc-text-muted)">Run: {defect.runSlug}</div>
                  )}
                  {mttrHours != null && (
                    <div
                      className="mt-2 text-xs text-(--tc-text-muted)"
                      {...(isMttrTarget ? { "data-testid": "defect-mttr" } : {})}
                    >
                      MTTR: {mttrHours}h
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {canEdit && (
                      <button
                        type="button"
                        {...(isPrimary ? { "data-testid": "defect-edit" } : {})}
                        onClick={() => handleOpenModal(defect)}
                        className="rounded-full border border-(--tc-border,#e5e7eb) px-3 py-1 text-xs font-semibold"
                      >
                        Editar
                      </button>
                    )}
                    {canLink && (
                      <button
                        type="button"
                        {...(isPrimary ? { "data-testid": "defect-link-run" } : {})}
                        onClick={() => {
                          setLinkingDefectId(defect.slug);
                          setLinkInput(defect.runSlug ?? "");
                        }}
                        className="rounded-full border border-(--tc-border,#e5e7eb) px-3 py-1 text-xs font-semibold"
                      >
                        Vincular run
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        {...(isPrimary ? { "data-testid": "defect-delete" } : {})}
                        onClick={() => handleDelete(defect.slug)}
                        className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600"
                      >
                        Deletar
                      </button>
                    )}
                  </div>

                  {linkingDefectId === defect.slug && (
                    <div className="mt-3 space-y-2 rounded-2xl border border-(--tc-border,#e5e7eb) bg-white p-3">
                      <input
                        {...(isLinking ? { "data-testid": "defect-run-input" } : {})}
                        value={linkInput}
                        onChange={(e) => setLinkInput(e.target.value)}
                        placeholder="Informe o slug da run"
                        className="w-full rounded-xl border border-(--tc-border,#e5e7eb) px-3 py-2 text-sm"
                      />
                      <div className="flex flex-wrap gap-2">
                        {runOptions.slice(0, 6).map((option) => (
                          <button
                            key={option}
                            type="button"
                            {...(isLinking ? { "data-testid": `run-option-${option}` } : {})}
                            onClick={() => setLinkInput(option)}
                            className="rounded-full border border-(--tc-border,#e5e7eb) px-3 py-1 text-xs font-semibold"
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        {...(isLinking ? { "data-testid": "defect-save" } : {})}
                        onClick={handleLinkSave}
                        disabled={saving || !linkInput.trim()}
                        className="rounded-xl bg-(--tc-accent,#ef0001) px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                      >
                        Salvar vinculo
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {activeDefect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-auto" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl max-h-[90vh] overflow-auto" data-testid="defect-modal">
            <h2 className="text-lg font-semibold">{activeDefect.name}</h2>
            <p className="mt-1 text-xs text-(--tc-text-muted)">Atualize o status do defeito.</p>
            <div className="mt-4 space-y-2">
              <label
                id="defect-status-label"
                className="text-xs uppercase tracking-[0.3em] text-(--tc-text-muted)"
                htmlFor="defect-status-select"
              >
                Status
              </label>
              <select
                data-testid="defect-status"
                id="defect-status-select"
                aria-labelledby="defect-status-label"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="w-full rounded-2xl border border-(--tc-border,#e5e7eb) px-3 py-2 text-sm"
              >
                <option value="open">Aberto</option>
                <option value="in_progress">Em andamento</option>
                <option value="done">Concluido</option>
              </select>
              <select
                data-testid="defect-status-select"
                aria-labelledby="defect-status-label"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="sr-only"
              >
                <option value="open">Aberto</option>
                <option value="in_progress">Em andamento</option>
                <option value="done">Concluido</option>
              </select>
            </div>

            <div className="mt-6 rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-(--tc-text)">Historico</h3>
                <button
                  type="button"
                  onClick={() => activeDefect && loadHistory(activeDefect.slug)}
                  className="rounded-full border border-(--tc-border,#e5e7eb) px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em]"
                >
                  Atualizar
                </button>
              </div>
              {historyLoading && (
                <p className="mt-2 text-xs text-(--tc-text-muted)">Carregando historico...</p>
              )}
              {historyError && (
                <p className="mt-2 text-xs text-red-600">{historyError}</p>
              )}
              {!historyLoading && !historyError && historyItems.length === 0 && (
                <p className="mt-2 text-xs text-(--tc-text-muted)">Nenhum historico registrado.</p>
              )}
              <div className="mt-3 space-y-3">
                {historyItems.map((event) => (
                  <div key={event.id} className="rounded-xl border border-(--tc-border,#e5e7eb) bg-white p-3">
                    <div className="text-xs font-semibold text-(--tc-text)">
                      {formatHistoryLabel(event)}
                    </div>
                    <div className="mt-1 text-[11px] text-(--tc-text-muted)">
                      {event.actorName || "Sistema"} • {new Date(event.createdAt).toLocaleString("pt-BR")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setActiveDefect(null)}
                className="rounded-2xl border border-(--tc-border,#e5e7eb) px-4 py-2 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                data-testid="defect-save"
                onClick={handleSaveModal}
                disabled={saving}
                className="rounded-2xl bg-(--tc-accent,#ef0001) px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
