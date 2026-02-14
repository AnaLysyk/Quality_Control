"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type AuditLog = {
  id: string;
  created_at: string;
  actor_user_id: string | null;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_label: string | null;
  metadata: unknown;
};

const ACTION_BADGE: Record<string, string> = {
  CREATE: "bg-emerald-50 text-emerald-700",
  UPDATE: "bg-amber-50 text-amber-700",
  DELETE: "bg-rose-50 text-rose-700",
  LOGIN: "bg-sky-50 text-sky-700",
  ACCESS: "bg-violet-50 text-violet-700",
};

const DEFAULT_BADGE = "bg-slate-100 text-slate-900";

function resolveActionBadge(action: string | null | undefined): string {
  const normalized = (action ?? "").toUpperCase();
  if (ACTION_BADGE[normalized]) return ACTION_BADGE[normalized];
  if (normalized.includes("CREATE") || normalized.includes("ADD") || normalized.includes("INSERT")) {
    return ACTION_BADGE.CREATE;
  }
  if (normalized.includes("DELETE") || normalized.includes("REMOVE") || normalized.includes("DESTROY")) {
    return ACTION_BADGE.DELETE;
  }
  if (normalized.includes("UPDATE") || normalized.includes("EDIT") || normalized.includes("PATCH")) {
    return ACTION_BADGE.UPDATE;
  }
  if (normalized.includes("LOGIN") || normalized.includes("AUTH")) {
    return ACTION_BADGE.LOGIN;
  }
  return DEFAULT_BADGE;
}

function resolveSourceLabel(metadata: unknown): string {
  if (metadata && typeof metadata === "object") {
    const record = metadata as Record<string, unknown>;
    const sourceCandidate = record.source ?? record.origin ?? record.trigger;
    if (typeof sourceCandidate === "string" && sourceCandidate.trim().length > 0) {
      return sourceCandidate;
    }
  }
  return "Origem não informada";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default function AdminAuditLogsPage() {
  const [items, setItems] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [actor, setActor] = useState("");
  const [targetQuery, setTargetQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setWarning(null);
    try {
      const url = new URL("/api/admin/audit-logs", window.location.origin);
      url.searchParams.set("limit", "300");
      const res = await fetch(url.toString(), { credentials: "include", cache: "no-store" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(typeof json?.error === "string" ? json.error : "Não foi possível carregar o histórico");
      }
      const json = await res.json().catch(() => ({}));
      setItems(Array.isArray(json?.items) ? (json.items as AuditLog[]) : []);
      setWarning(typeof json?.warning === "string" ? json.warning : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar histórico");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const actions = useMemo(() => {
    const set = new Set(items.map((i) => i.action).filter((value): value is string => typeof value === "string" && value.length > 0));
    return Array.from(set).sort();
  }, [items]);

  const entityTypes = useMemo(() => {
    const set = new Set(
      items.map((i) => i.entity_type).filter((value): value is string => typeof value === "string" && value.length > 0),
    );
    return Array.from(set).sort();
  }, [items]);

  const startBoundary = useMemo(() => {
    if (!startDate) return null;
    const iso = `${startDate}T00:00:00.000`;
    const parsed = new Date(iso);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [startDate]);

  const endBoundary = useMemo(() => {
    if (!endDate) return null;
    const iso = `${endDate}T23:59:59.999`;
    const parsed = new Date(iso);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [endDate]);

  const filteredItems = useMemo(() => {
    return items.filter((log) => {
      if (action && log.action !== action) return false;
      if (entityType && log.entity_type !== entityType) return false;
      if (actor && !(log.actor_email ?? "").toLowerCase().includes(actor.toLowerCase())) return false;
      if (targetQuery) {
        const q = targetQuery.toLowerCase();
        const label = (log.entity_label ?? "").toLowerCase();
        const id = (log.entity_id ?? "").toLowerCase();
        const type = (log.entity_type ?? "").toLowerCase();
        if (!label.includes(q) && !id.includes(q) && !type.includes(q)) return false;
      }
      if (startBoundary) {
        const createdAt = new Date(log.created_at);
        if (createdAt < startBoundary) return false;
      }
      if (endBoundary) {
        const createdAt = new Date(log.created_at);
        if (createdAt > endBoundary) return false;
      }
      return true;
    });
  }, [items, action, actor, startBoundary, endBoundary, entityType, targetQuery]);

  const showSkeleton = loading && !items.length;

  return (
    <div className="min-h-screen bg-(--page-bg,#ffffff) text-(--page-text,#0b1a3c)">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-10">
        <header className="rounded-3xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) p-6 shadow-lg shadow-black/10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-(--tc-text-muted)">Painel</p>
              <h1 className="text-3xl font-bold text-(--tc-text)">Histórico de Ações</h1>
              <p className="text-sm text-(--tc-text-secondary)">Registro imutável de ações administrativas no sistema</p>
            </div>
            <span className="rounded-full border border-(--tc-accent,#ef0001)/30 bg-(--tc-accent,#ef0001) px-3 py-1 text-xs font-semibold tracking-[0.3em] text-white">
              ADMIN ONLY
            </span>
          </div>
        </header>

        <section className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) p-4 space-y-4 shadow shadow-black/5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            <FilterSelect label="Ação" value={action} onChange={setAction} options={actions} />
            <FilterSelect label="Entidade" value={entityType} onChange={setEntityType} options={entityTypes} />
            <FilterInput label="Ator" value={actor} onChange={setActor} placeholder="email ou uid" />
            <FilterInput label="Alvo" value={targetQuery} onChange={setTargetQuery} placeholder="empresa, usuário, id" />
            <FilterInput label="Data inicial" value={startDate} onChange={setStartDate} type="date" />
            <FilterInput label="Data final" value={endDate} onChange={setEndDate} type="date" />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={load}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-full border border-(--tc-accent,#ef0001)/70 bg-(--tc-accent,#ef0001)/10 px-5 py-2 text-sm font-semibold text-(--tc-accent,#ef0001) shadow-sm transition hover:bg-(--tc-accent,#ef0001)/20 disabled:opacity-50"
            >
              {loading ? "Atualizando..." : "Atualizar"}
            </button>
            <button
              onClick={() => {
                setAction("");
                setEntityType("");
                setActor("");
                setTargetQuery("");
                setStartDate("");
                setEndDate("");
              }}
              className="inline-flex items-center justify-center rounded-full border border-(--tc-border) bg-(--tc-surface) px-4 py-2 text-xs font-semibold text-(--tc-text) transition hover:bg-(--tc-surface-2)"
            >
              Limpar filtros
            </button>
            <span className="text-xs text-(--tc-text-muted,#6b7280)">Exibindo até 300 registros · retenção: 60 dias</span>
          </div>
        </section>

        {error && (
          <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-700">
            {error}
          </div>
        )}

        {warning && !error && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
            {warning}
          </div>
        )}

        <section className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) shadow shadow-black/5">
          <div className="hidden sm:grid grid-cols-[200px_140px_1fr_220px] gap-3 border-b border-(--tc-border,#e5e7eb) px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-(--tc-text-muted)">
            <div>Data / Hora</div>
            <div>Ação</div>
            <div>Alvo</div>
            <div>Ator</div>
          </div>

          {showSkeleton && (
            <div className="space-y-3 px-4 py-4">
              {[...Array(4)].map((_, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row animate-pulse items-start sm:items-center justify-between gap-3 rounded-2xl bg-(--tc-surface-2) px-4 py-3">
                  <div className="h-4 w-20 rounded-full bg-(--tc-border)" />
                  <div className="h-4 w-12 rounded-full bg-(--tc-border)" />
                  <div className="flex-1 rounded-full bg-(--tc-border) py-2" />
                  <div className="h-4 w-32 rounded-full bg-(--tc-border)" />
                </div>
              ))}
            </div>
          )}

          {!showSkeleton && filteredItems.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-(--tc-text-muted,#6b7280)">
                Nenhuma ação registrada com os filtros atuais.
              </div>
            )}

          <div className="divide-y divide-(--tc-border)">
            {filteredItems.map((item) => (
              <div key={item.id}>
                <button
                  type="button"
                  onClick={() => setExpandedId((prev) => (prev === item.id ? null : item.id))}
                  className="group grid w-full grid-cols-1 sm:grid-cols-[200px_140px_1fr_220px] gap-3 px-4 py-3 text-left text-sm text-(--tc-text) hover:bg-(--tc-surface-2)"
                >
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-[0.3em] text-(--tc-text-muted) sm:hidden">Data / Hora</span>
                    <time className="text-(--tc-text-muted)" title={new Date(item.created_at).toISOString()}>
                      {formatDate(item.created_at)}
                    </time>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-[0.3em] text-(--tc-text-muted) sm:hidden">Ação</span>
                    <span className="flex items-center">
                      <span
                        className={`rounded-full px-3 py-0.5 text-[11px] font-semibold tracking-[0.25em] uppercase ${
                          resolveActionBadge(item.action)
                        }`}
                      >
                        {item.action}
                      </span>
                    </span>
                  </div>
                  <div className="min-w-0 flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-[0.3em] text-(--tc-text-muted) sm:hidden">Alvo</span>
                    <div className="truncate font-semibold text-(--tc-text)">
                      {item.entity_type}
                      {item.entity_label ? `: ${item.entity_label}` : ""}
                    </div>
                    {item.entity_id && <div className="text-xs text-(--tc-text-muted)">id: {item.entity_id}</div>}
                  </div>
                  <div className="min-w-0 flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-[0.3em] text-(--tc-text-muted) sm:hidden">Ator</span>
                    <div className="truncate text-(--tc-text)">{item.actor_email || "desconhecido"}</div>
                    {item.actor_user_id && <div className="text-xs text-(--tc-text-muted)">uid: {item.actor_user_id}</div>}
                  </div>
                </button>
                {expandedId === item.id && (
                  <div className="border-t border-(--tc-border,#e5e7eb) bg-(--tc-surface-2) px-4 sm:px-8 py-4 text-xs text-(--tc-text-muted)">
                    <div className="grid gap-4 lg:grid-cols-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.35em] text-(--tc-text-muted)">Origem</p>
                        <p className="text-sm text-(--tc-text)">{resolveSourceLabel(item.metadata)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.35em] text-(--tc-text-muted)">Entidade</p>
                        <p className="text-sm text-(--tc-text)">
                          {item.entity_type} {item.entity_id ? `(id: ${item.entity_id})` : ""}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.35em] text-(--tc-text-muted)">Metadata</p>
                        <pre className="max-h-32 overflow-auto rounded-xl border border-(--tc-border) bg-(--tc-surface) p-3 text-[11px] text-(--tc-text)">
                          {JSON.stringify(item.metadata ?? {}, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (val: string) => void; options: string[] }) {
  return (
    <label className="text-xs font-semibold uppercase tracking-[0.4em] text-(--tc-text-muted)">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-input-bg) px-3 py-2 text-sm text-(--tc-text) focus:outline-none focus:ring-2 focus:ring-(--tc-accent)/30"
      >
        <option value="">Todas</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}

function FilterInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="text-xs font-semibold uppercase tracking-[0.4em] text-(--tc-text-muted)">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-input-bg) px-3 py-2 text-sm text-(--tc-text) placeholder:text-(--tc-text-muted) focus:outline-none focus:ring-2 focus:ring-(--tc-accent)/30"
      />
    </label>
  );
}
