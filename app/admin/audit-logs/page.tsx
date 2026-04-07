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

/* ── Translation layer ──────────────────────────────────── */

const ACTION_TITLES: Record<string, string> = {
  "user.created": "Usuário criado",
  "user.updated": "Usuário atualizado",
  "user.deleted": "Usuário removido",
  "user.permissions.updated": "Permissões atualizadas",
  "user.permissions.reset": "Permissões restauradas",
  "client.created": "Empresa criada",
  "client.updated": "Empresa atualizada",
  "client.deleted": "Empresa removida",
  "run.created": "Execução criada",
  "run.deleted": "Execução removida",
  // legacy uppercase keys
  CREATE: "Registro criado",
  USER_CREATED: "Usuário criado",
  CLIENT_CREATED: "Empresa criada",
  UPDATE: "Registro atualizado",
  USER_UPDATED: "Usuário atualizado",
  CLIENT_UPDATED: "Empresa atualizada",
  DELETE: "Registro removido",
  USER_DELETED: "Usuário removido",
  CLIENT_DELETED: "Empresa removida",
};

const ENTITY_LABELS: Record<string, string> = {
  user: "Usuário",
  client: "Empresa",
  company: "Empresa",
  membership: "Vínculo",
  permission: "Permissão",
  run: "Execução",
};

const METADATA_KEY_LABELS: Record<string, string> = {
  slug: "Slug",
  active: "Ativo",
  role: "Papel",
  permissionRole: "Papel de permissão",
  companyId: "ID da empresa",
  companySlug: "Slug da empresa",
  companyLabel: "Empresa",
  membershipRole: "Papel no vínculo",
  user_origin: "Origem do usuário",
  user_scope: "Escopo",
  integrationMode: "Modo de integração",
  allowCount: "Permissões concedidas",
  denyCount: "Permissões negadas",
  effectiveCount: "Permissões efetivas",
  restored: "Restaurado",
  targetPermissionRole: "Papel do alvo",
  actorRole: "Papel do ator",
  userEmail: "Email do usuário",
  userId: "ID do usuário",
};

type ActionCategory = "create" | "update" | "delete" | "permission" | "default";

function getCategory(action: string): ActionCategory {
  const a = action.toLowerCase();
  if (a.includes("permission") || a.includes("reset")) return "permission";
  if (a.includes("create")) return "create";
  if (a.includes("update")) return "update";
  if (a.includes("delete")) return "delete";
  return "default";
}

function iconClass(cat: ActionCategory) {
  return {
    create: styles.iconCreate,
    update: styles.iconUpdate,
    delete: styles.iconDelete,
    permission: styles.iconPermission,
    default: styles.iconDefault,
  }[cat];
}

function badgeClass(cat: ActionCategory) {
  return {
    create: styles.badgeCreate,
    update: styles.badgeUpdate,
    delete: styles.badgeDelete,
    permission: styles.badgePermission,
    default: styles.badgeDefault,
  }[cat];
}

function CategoryIcon({ category }: { category: ActionCategory }) {
  const common = { viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.6", strokeLinecap: "round" as const };
  if (category === "create") {
    return (<svg {...common}><circle cx="8" cy="8" r="6" /><path d="M8 5.5v5M5.5 8h5" /></svg>);
  }
  if (category === "update") {
    return (<svg {...common} strokeLinejoin="round"><path d="M2.5 13.5l1.2-4.3L11 1.9a1.3 1.3 0 011.8 0l1.3 1.3a1.3 1.3 0 010 1.8L6.8 12.3z" /><path d="M9.5 3.5l3 3" /></svg>);
  }
  if (category === "delete") {
    return (<svg {...common}><path d="M3 4h10M5.5 4V3a1 1 0 011-1h3a1 1 0 011 1v1M6 7v4M10 7v4" /><path d="M4 4l.7 8.5a1.5 1.5 0 001.5 1.5h3.6a1.5 1.5 0 001.5-1.5L12 4" /></svg>);
  }
  if (category === "permission") {
    return (<svg {...common}><path d="M8 1.5v3M12.6 3.4l-2.1 2.1M14.5 8h-3M12.6 12.6l-2.1-2.1M8 14.5v-3M3.4 12.6l2.1-2.1M1.5 8h3M3.4 3.4l2.1 2.1" /></svg>);
  }
  return (<svg {...common}><circle cx="8" cy="8" r="6" /><path d="M8 5v3l2 1.5" /></svg>);
}

function entityTypeLabel(type: string) {
  return ENTITY_LABELS[type.toLowerCase()] ?? type;
}

function getEventTitle(item: AuditLog): string {
  return ACTION_TITLES[item.action] ?? item.action.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getEventSubtitle(item: AuditLog): { actor: string; target: string; entity: string } {
  const meta = (item.metadata && typeof item.metadata === "object" ? item.metadata : {}) as Record<string, unknown>;
  const actor = item.actor_email || "sistema";
  const entity = entityTypeLabel(item.entity_type);
  let target = item.entity_label || "";
  if (!target && meta.companyLabel) target = String(meta.companyLabel);
  if (!target && meta.companySlug) target = String(meta.companySlug);
  if (!target && meta.userEmail) target = String(meta.userEmail);
  if (!target && item.entity_id) target = item.entity_id;
  return { actor, target, entity };
}

function getCategoryLabel(cat: ActionCategory): string {
  return { create: "Criação", update: "Alteração", delete: "Exclusão", permission: "Permissão", default: "Evento" }[cat];
}

function formatMetaValue(val: unknown): string {
  if (val === true) return "Sim";
  if (val === false) return "Não";
  if (val === null || val === undefined) return "—";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", { timeStyle: "short" });
}

function formatDateOnly(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AdminAuditLogsPage() {
  const [items, setItems] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [actor, setActor] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showJson, setShowJson] = useState<string | null>(null);

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

  useEffect(() => { load(); }, [load]);

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
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const label = (log.entity_label ?? "").toLowerCase();
        const id = (log.entity_id ?? "").toLowerCase();
        const type = (log.entity_type ?? "").toLowerCase();
        const email = (log.actor_email ?? "").toLowerCase();
        const title = getEventTitle(log).toLowerCase();
        const metaStr = JSON.stringify(log.metadata ?? {}).toLowerCase();
        if (!label.includes(q) && !id.includes(q) && !type.includes(q) && !email.includes(q) && !title.includes(q) && !metaStr.includes(q)) return false;
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
  }, [items, action, actor, startDate, endDate, entityType, searchQuery]);

  const showSkeleton = loading && !items.length;

  return (
    <div className="min-h-screen bg-(--page-bg,#ffffff) text-(--page-text,#0b1a3c)">
      <div className="mx-auto max-w-6xl px-4 py-10 space-y-5">
        <p className={styles.contextLine}>
          Consulte movimentações, alterações administrativas, vínculos, permissões e eventos do sistema.
        </p>

        {error && (
          <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
        )}
        {warning && !error && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">{warning}</div>
        )}

        {/* ── Card principal ─────────────────────────────────── */}
        <div className={styles.card}>
          {/* Header */}
          <div className={styles.cardHeader}>
            <div className={styles.cardHeaderLeft}>
              <h2>Central de Auditoria</h2>
              <p>Rastreie quem fez o quê, quando e em qual entidade. Investigue alterações, vínculos e permissões com detalhe.</p>
            </div>
            <div className={styles.cardHeaderRight}>
              <span className={styles.metaBadge}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 4h12M2 8h12M2 12h12" strokeLinecap="round"/></svg>
                {filteredItems.length} evento{filteredItems.length !== 1 ? "s" : ""}
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
                Busca textual
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="nome, email, id, campo…" className={styles.filterInput} />
              </label>
              <label className={styles.filterLabel}>
                Tipo de evento
                <select value={action} onChange={(e) => setAction(e.target.value)} className={styles.filterSelect}>
                  <option value="">Todos</option>
                  {actions.map((opt) => (
                    <option key={opt} value={opt}>{ACTION_TITLES[opt] ?? opt}</option>
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
                <input type="text" value={actor} onChange={(e) => setActor(e.target.value)} placeholder="email do responsável" className={styles.filterInput} />
              </label>
            </div>
            <div className={styles.filtersRow2}>
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
                onClick={() => { setAction(""); setEntityType(""); setActor(""); setSearchQuery(""); setStartDate(""); setEndDate(""); }}
                className={styles.btnGhost}
              >
                Limpar filtros
              </button>
            </div>
          </div>

          {/* Skeleton */}
          {showSkeleton && (
            <div className={styles.eventList}>
              {[...Array(5)].map((_, idx) => (
                <div key={idx} className={styles.skeletonRow}>
                  <div className={styles.skeletonCircle} />
                  <div className={styles.skeletonLines}>
                    <div className={`${styles.skeletonBar} ${styles.skeletonBarMed}`} />
                    <div className={`${styles.skeletonBar} ${styles.skeletonBarLong}`} />
                    <div className={`${styles.skeletonBar} ${styles.skeletonBarShort}`} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!showSkeleton && filteredItems.length === 0 && (
            <div className={styles.emptyState}>
              Nenhum evento encontrado com os filtros atuais.
            </div>
          )}

          {/* ── Event timeline ─────────────────────────────────── */}
          <div className={styles.eventList}>
            {filteredItems.map((item) => {
              const cat = getCategory(item.action);
              const title = getEventTitle(item);
              const sub = getEventSubtitle(item);
              const isOpen = expandedId === item.id;
              const meta = (item.metadata && typeof item.metadata === "object" ? item.metadata : {}) as Record<string, unknown>;
              const metaEntries = Object.entries(meta).filter(([, v]) => v !== undefined && v !== null);

              return (
                <div key={item.id} className={`${styles.eventRow} ${isOpen ? styles.eventRowExpanded : ""}`}>
                  <button
                    type="button"
                    onClick={() => setExpandedId((prev) => (prev === item.id ? null : item.id))}
                    className={styles.eventButton}
                  >
                    {/* Icon */}
                    <div className={`${styles.eventIcon} ${iconClass(cat)}`}>
                      <CategoryIcon category={cat} />
                    </div>

                    {/* Content */}
                    <div className={styles.eventContent}>
                      <p className={styles.eventTitle}>{title}</p>
                      <p className={styles.eventSubtitle}>
                        por <strong>{sub.actor}</strong>
                        {sub.target ? <> · em <strong>{sub.target}</strong></> : null}
                      </p>
                      <div className={styles.eventBadges}>
                        <span className={`${styles.badge} ${badgeClass(cat)}`}>{getCategoryLabel(cat)}</span>
                        <span className={`${styles.badge} ${styles.badgeEntity}`}>{sub.entity}</span>
                      </div>
                    </div>

                    {/* Time */}
                    <div className={styles.eventMeta}>
                      <span className={styles.eventTime}>{formatTime(item.created_at)}</span>
                      <span className={styles.eventTimeDate}>{formatDateOnly(item.created_at)}</span>
                      <svg className={`${styles.eventChevron} ${isOpen ? styles.eventChevronOpen : ""}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6l4 4 4-4" /></svg>
                    </div>
                  </button>

                  {/* ── Expanded detail ───────────────────────────── */}
                  {isOpen && (
                    <div className={styles.expandedPanel}>
                      {/* Summary grid */}
                      <div className={styles.summaryGrid}>
                        <div className={styles.summaryItem}>
                          <p className={styles.summaryLabel}>O que aconteceu</p>
                          <p className={styles.summaryValue}>{title}</p>
                        </div>
                        <div className={styles.summaryItem}>
                          <p className={styles.summaryLabel}>Executado por</p>
                          <p className={styles.summaryValue}>{sub.actor}</p>
                        </div>
                        <div className={styles.summaryItem}>
                          <p className={styles.summaryLabel}>Entidade</p>
                          <p className={styles.summaryValue}>{sub.entity}{sub.target ? `: ${sub.target}` : ""}</p>
                        </div>
                        <div className={styles.summaryItem}>
                          <p className={styles.summaryLabel}>Data e hora</p>
                          <p className={styles.summaryValue}>{formatDate(item.created_at)}</p>
                        </div>
                        {item.entity_id && (
                          <div className={styles.summaryItem}>
                            <p className={styles.summaryLabel}>ID da entidade</p>
                            <p className={`${styles.summaryValue} ${styles.summaryValueMono}`}>{item.entity_id}</p>
                          </div>
                        )}
                        {item.actor_user_id && (
                          <div className={styles.summaryItem}>
                            <p className={styles.summaryLabel}>ID do ator</p>
                            <p className={`${styles.summaryValue} ${styles.summaryValueMono}`}>{item.actor_user_id}</p>
                          </div>
                        )}
                      </div>

                      {/* Metadata table */}
                      {metaEntries.length > 0 && (
                        <div className={styles.changesSection}>
                          <p className={styles.changesSectionTitle}>Detalhes da operação</p>
                          <table className={styles.changesTable}>
                            <thead>
                              <tr><th>Campo</th><th>Valor</th></tr>
                            </thead>
                            <tbody>
                              {metaEntries.map(([key, val]) => (
                                <tr key={key}>
                                  <td className={styles.changesKey}>{METADATA_KEY_LABELS[key] ?? key}</td>
                                  <td className={styles.changesVal}>{formatMetaValue(val)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Collapsible raw JSON */}
                      <hr className={styles.expandedDivider} />
                      <button
                        type="button"
                        className={`${styles.technicalToggle} ${showJson === item.id ? styles.technicalToggleOpen : ""}`}
                        onClick={() => setShowJson((prev) => (prev === item.id ? null : item.id))}
                      >
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 4l4 4-4 4" /></svg>
                        Payload técnico (JSON)
                      </button>
                      {showJson === item.id && (
                        <pre className={styles.technicalPre}>
                          {JSON.stringify({ id: item.id, action: item.action, entity_type: item.entity_type, entity_id: item.entity_id, entity_label: item.entity_label, actor_user_id: item.actor_user_id, actor_email: item.actor_email, created_at: item.created_at, metadata: item.metadata }, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
