"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./AuditLogs.module.css";

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

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Criado",
  USER_CREATED: "Usuário criado",
  CLIENT_CREATED: "Cliente criado",
  UPDATE: "Atualizado",
  USER_UPDATED: "Usuário atualizado",
  CLIENT_UPDATED: "Cliente atualizado",
  DELETE: "Removido",
  USER_DELETED: "Usuário removido",
  CLIENT_DELETED: "Cliente removido",
};

function badgeClass(action: string) {
  const a = action.toUpperCase();
  if (a.includes("CREATE")) return styles.badgeCreate;
  if (a.includes("UPDATE")) return styles.badgeUpdate;
  if (a.includes("DELETE")) return styles.badgeDelete;
  return styles.badgeDefault;
}

function ActionIcon({ action }: { action: string }) {
  const a = action.toUpperCase();
  if (a.includes("CREATE")) {
    return (
      <svg className={styles.actionIcon} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <circle cx="8" cy="8" r="6" />
        <path d="M8 5.5v5M5.5 8h5" />
      </svg>
    );
  }
  if (a.includes("UPDATE")) {
    return (
      <svg className={styles.actionIcon} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2.5 13.5l1.2-4.3L11 1.9a1.3 1.3 0 011.8 0l1.3 1.3a1.3 1.3 0 010 1.8L6.8 12.3z" />
        <path d="M9.5 3.5l3 3" />
      </svg>
    );
  }
  if (a.includes("DELETE")) {
    return (
      <svg className={styles.actionIcon} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M3 4h10M5.5 4V3a1 1 0 011-1h3a1 1 0 011 1v1M6 7v4M10 7v4" />
        <path d="M4 4l.7 8.5a1.5 1.5 0 001.5 1.5h3.6a1.5 1.5 0 001.5-1.5L12 4" />
      </svg>
    );
  }
  return (
    <svg className={styles.actionIcon} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 5v3l2 1.5" />
    </svg>
  );
}

function entityTypeLabel(type: string) {
  const map: Record<string, string> = {
    user: "Usuário",
    client: "Empresa",
    company: "Empresa",
    membership: "Vínculo",
    permission: "Permissão",
  };
  return map[type.toLowerCase()] ?? type;
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
    const set = new Set(items.map((i) => i.action));
    return Array.from(set).sort();
  }, [items]);

  const entityTypes = useMemo(() => {
    const set = new Set(items.map((i) => i.entity_type));
    return Array.from(set).sort();
  }, [items]);

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
      if (startDate) {
        const date = new Date(log.created_at);
        if (date < new Date(startDate)) return false;
      }
      if (endDate) {
        const date = new Date(log.created_at);
        if (date > new Date(endDate)) return false;
      }
      return true;
    });
  }, [items, action, actor, startDate, endDate, entityType, targetQuery]);

  const showSkeleton = loading && !items.length;

  return (
    <div className="min-h-screen bg-(--page-bg,#ffffff) text-(--page-text,#0b1a3c)">
      <div className="mx-auto max-w-6xl px-4 py-10 space-y-5">
        {/* Context line below cover — no card */}
        <p className={styles.contextLine}>
          Registro imutável das movimentações administrativas do sistema.
        </p>

        {error && (
          <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-700">
            {error}
          </div>
        )}

        {warning && !error && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
            {warning}
          </div>
        )}

        {/* ── Card principal ───────────────────────────────────── */}
        <div className={styles.card}>
          {/* Header */}
          <div className={styles.cardHeader}>
            <div className={styles.cardHeaderLeft}>
              <h2>Movimentações de usuários</h2>
              <p>Acompanhe criação, atualização e alterações relevantes no sistema.</p>
            </div>
            <div className={styles.cardHeaderRight}>
              <span className={styles.metaBadge}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 4h12M2 8h12M2 12h12" strokeLinecap="round"/></svg>
                {filteredItems.length} registro{filteredItems.length !== 1 ? "s" : ""}
              </span>
              <span className={styles.metaBadge}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="8" cy="8" r="6"/><path d="M8 4v4l2.5 1.5" strokeLinecap="round"/></svg>
                60 dias
              </span>
            </div>
          </div>

          {/* Filtros */}
          <div className={styles.filtersWrap}>
            <div className={styles.filtersGrid}>
              <label className={styles.filterLabel}>
                Ação
                <select value={action} onChange={(e) => setAction(e.target.value)} className={styles.filterSelect}>
                  <option value="">Todas</option>
                  {actions.map((opt) => (
                    <option key={opt} value={opt}>{ACTION_LABELS[opt] ?? opt}</option>
                  ))}
                </select>
              </label>
              <label className={styles.filterLabel}>
                Entidade
                <select value={entityType} onChange={(e) => setEntityType(e.target.value)} className={styles.filterSelect}>
                  <option value="">Todas</option>
                  {entityTypes.map((opt) => (
                    <option key={opt} value={opt}>{entityTypeLabel(opt)}</option>
                  ))}
                </select>
              </label>
              <label className={styles.filterLabel}>
                Ator
                <input type="text" value={actor} onChange={(e) => setActor(e.target.value)} placeholder="email ou uid" className={styles.filterInput} />
              </label>
              <label className={styles.filterLabel}>
                Alvo
                <input type="text" value={targetQuery} onChange={(e) => setTargetQuery(e.target.value)} placeholder="empresa, usuário, id" className={styles.filterInput} />
              </label>
              <label className={styles.filterLabel}>
                Data inicial
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={styles.filterInput} />
              </label>
              <label className={styles.filterLabel}>
                Data final
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={styles.filterInput} />
              </label>
            </div>
            <div className={styles.filtersActions}>
              <button onClick={load} disabled={loading} className={styles.btnPrimary}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M14 2v4h-4" /><path d="M13.5 10A6 6 0 113.3 4.5" />
                </svg>
                {loading ? "Atualizando…" : "Atualizar"}
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
                className={styles.btnGhost}
              >
                Limpar filtros
              </button>
            </div>
          </div>

          {/* Table header */}
          <div className={styles.tableHeader}>
            <div>Data / Hora</div>
            <div>Ação</div>
            <div>Alvo</div>
            <div>Ator</div>
          </div>

          {/* Skeleton */}
          {showSkeleton && (
            <div>
              {[...Array(5)].map((_, idx) => (
                <div key={idx} className={styles.skeletonRow}>
                  <div className={`${styles.skeletonBar} ${styles.skeletonDate}`} />
                  <div className={`${styles.skeletonBar} ${styles.skeletonAction}`} />
                  <div className={`${styles.skeletonBar} ${styles.skeletonTarget}`} />
                  <div className={`${styles.skeletonBar} ${styles.skeletonActor}`} />
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!showSkeleton && filteredItems.length === 0 && (
            <div className={styles.emptyState}>
              Nenhuma movimentação registrada com os filtros atuais.
            </div>
          )}

          {/* Rows */}
          <div>
            {filteredItems.map((item, idx) => (
              <div key={item.id} className={styles.rowDivider}>
                <button
                  type="button"
                  onClick={() => setExpandedId((prev) => (prev === item.id ? null : item.id))}
                  className={`${styles.row} ${idx % 2 === 0 ? "" : styles.rowEven}`}
                >
                  {/* Data */}
                  <div>
                    <span className={styles.mobileLabel}>Data / Hora</span>
                    <time className={styles.dateCell} title={new Date(item.created_at).toISOString()}>
                      {formatDate(item.created_at)}
                    </time>
                  </div>

                  {/* Ação */}
                  <div>
                    <span className={styles.mobileLabel}>Ação</span>
                    <span className={`${styles.badge} ${badgeClass(item.action)}`}>
                      <ActionIcon action={item.action} />
                      {ACTION_LABELS[item.action] ?? item.action.replace(/_/g, " ").toLowerCase()}
                    </span>
                  </div>

                  {/* Alvo */}
                  <div className={styles.cellMinW0}>
                    <span className={styles.mobileLabel}>Alvo</span>
                    <div className={styles.targetPrimary} title={`${entityTypeLabel(item.entity_type)}: ${item.entity_label || "—"}`}>
                      <span className={styles.targetEntityType}>{entityTypeLabel(item.entity_type)}: </span>
                      {item.entity_label || "—"}
                    </div>
                    {item.entity_id && <div className={styles.targetSecondary}>id: {item.entity_id}</div>}
                  </div>

                  {/* Ator */}
                  <div className={styles.cellMinW0}>
                    <span className={styles.mobileLabel}>Ator</span>
                    <div className={styles.actorEmail} title={item.actor_email || undefined}>{item.actor_email || "desconhecido"}</div>
                    {item.actor_user_id && <div className={styles.actorUid}>uid: {item.actor_user_id}</div>}
                  </div>
                </button>

                {expandedId === item.id && (
                  <div className={styles.expandedRow}>
                    <div className={styles.expandedGrid}>
                      <div>
                        <p className={styles.expandedLabel}>Origem</p>
                        <p className={styles.expandedValue}>UI · API · Sistema</p>
                      </div>
                      <div>
                        <p className={styles.expandedLabel}>Entidade</p>
                        <p className={styles.expandedValue}>
                          {entityTypeLabel(item.entity_type)} {item.entity_id ? `(${item.entity_id})` : ""}
                        </p>
                      </div>
                      <div>
                        <p className={styles.expandedLabel}>Metadata</p>
                        <pre className={styles.metadataPre}>
                          {JSON.stringify(item.metadata ?? {}, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
