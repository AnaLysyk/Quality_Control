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
  // Auth
  "auth.login.success": "Login realizado",
  "auth.login.failure": "Tentativa de login falhou",
  "auth.logout": "Logout realizado",
  "auth.password.changed": "Senha alterada",
  "auth.password.reset": "Senha redefinida via token",
  // Tickets
  "ticket.created": "Chamado aberto",
  "ticket.updated": "Chamado atualizado",
  // Access requests
  "access_request.created": "Solicitação de acesso criada",
  // Defects
  "defect.created": "Defeito registrado",
  // Integrations
  "integration.updated": "Integração atualizada",
  // Exports
  "export.executed": "Exportação de dados",
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
  ticket: "Chamado",
  access_request: "Solicitação de acesso",
  defect: "Defeito",
  integration: "Integração",
  export: "Exportação",
};

const METADATA_KEY_LABELS: Record<string, string> = {
  slug: "Slug",
  active: "Status",
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
  // Auth
  reason: "Motivo",
  ip: "Endereço IP",
  method: "Método",
  sessionId: "Sessão",
  // Tickets
  type: "Tipo",
  priority: "Prioridade",
  // Access requests
  profileType: "Tipo de perfil",
  accessType: "Tipo de acesso",
  company: "Empresa",
  // Defects
  releaseManualId: "ID do release manual",
  // Integrations
  projectCodesChanged: "Projetos alterados",
  fieldsUpdated: "Campos atualizados",
  // Exports
  format: "Formato",
  project: "Projeto",
  runId: "ID da execução",
  rows: "Registros exportados",
  scope: "Escopo",
};

/** Keys that belong in the "summary" tier (not the operation details). */
const SUMMARY_META_KEYS = new Set(["companyLabel", "companySlug", "companyId", "userEmail", "userId", "ip", "sessionId"]);
/** Keys that are IDs / technical — go in tier 3. */
const TECHNICAL_META_KEYS = new Set(["companyId", "userId", "ip", "sessionId"]);

type ActionCategory = "create" | "update" | "delete" | "permission" | "link" | "auth" | "error" | "integration" | "default";

function getCategory(action: string): ActionCategory {
  const a = action.toLowerCase();
  if (a.includes("failure") || a.includes("fail")) return "error";
  if (a.includes("error")) return "error";
  if (a.includes("login") || a.includes("logout") || a.includes("auth") || a.includes("password")) return "auth";
  if (a.includes("export")) return "integration";
  if (a.includes("link") || a.includes("unlink") || a.includes("membership") || a.includes("access_request")) return "link";
  if (a.includes("integration") || a.includes("sync")) return "integration";
  if (a.includes("permission") || a.includes("reset")) return "permission";
  if (a.includes("ticket") || a.includes("defect")) {
    if (a.includes("create")) return "create";
    if (a.includes("update")) return "update";
    if (a.includes("delete")) return "delete";
  }
  if (a.includes("create")) return "create";
  if (a.includes("update")) return "update";
  if (a.includes("delete")) return "delete";
  return "default";
}

function iconClass(cat: ActionCategory) {
  const map: Record<ActionCategory, string> = {
    create: styles.iconCreate,
    update: styles.iconUpdate,
    delete: styles.iconDelete,
    permission: styles.iconPermission,
    link: styles.iconLink,
    auth: styles.iconAuth,
    error: styles.iconError,
    integration: styles.iconIntegration,
    default: styles.iconDefault,
  };
  return map[cat];
}

function badgeClass(cat: ActionCategory) {
  const map: Record<ActionCategory, string> = {
    create: styles.badgeCreate,
    update: styles.badgeUpdate,
    delete: styles.badgeDelete,
    permission: styles.badgePermission,
    link: styles.badgeLink,
    auth: styles.badgeAuth,
    error: styles.badgeError,
    integration: styles.badgeIntegration,
    default: styles.badgeDefault,
  };
  return map[cat];
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
    return (<svg {...common}><rect x="3" y="7" width="10" height="7" rx="1.5" /><path d="M5.5 7V5a2.5 2.5 0 015 0v2" /><circle cx="8" cy="10.5" r="1" fill="currentColor" stroke="none" /></svg>);
  }
  if (category === "link") {
    return (<svg {...common}><path d="M6.5 9.5l3-3" /><path d="M9 5h2a2 2 0 010 4h-1" /><path d="M7 11H5a2 2 0 010-4h1" /></svg>);
  }
  if (category === "auth") {
    return (<svg {...common}><circle cx="8" cy="5.5" r="2.5" /><path d="M3 14c0-2.8 2.2-5 5-5s5 2.2 5 5" /></svg>);
  }
  if (category === "error") {
    return (<svg {...common}><circle cx="8" cy="8" r="6" /><path d="M8 5v3.5" /><circle cx="8" cy="11" r="0.5" fill="currentColor" stroke="none" /></svg>);
  }
  if (category === "integration") {
    return (<svg {...common}><path d="M4 4l4 4-4 4" /><path d="M12 4l-4 4 4 4" /></svg>);
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
  return {
    create: "Criação", update: "Alteração", delete: "Exclusão",
    permission: "Permissão", link: "Vínculo", auth: "Autenticação",
    error: "Erro", integration: "Integração", default: "Evento",
  }[cat];
}

function getResultLabel(cat: ActionCategory): { label: string; cls: string } {
  if (cat === "error") return { label: "Erro", cls: styles.resultError };
  if (cat === "delete") return { label: "Executado", cls: styles.resultWarning };
  if (cat === "auth") return { label: "Registrado", cls: styles.resultSuccess };
  return { label: "Sucesso", cls: styles.resultSuccess };
}

function formatMetaValue(val: unknown): string {
  if (val === true) return "Sim";
  if (val === false) return "Não";
  if (val === null || val === undefined) return "—";
  if (Array.isArray(val)) return val.length ? val.join(", ") : "—";
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
  const [categoryFilter, setCategoryFilter] = useState<ActionCategory | "">("");

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
      if (categoryFilter && getCategory(log.action) !== categoryFilter) return false;
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
  }, [items, action, actor, startDate, endDate, entityType, searchQuery, categoryFilter]);

  /** Category breakdown for quick-filter chips. */
  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<ActionCategory, number>> = {};
    for (const item of items) {
      const cat = getCategory(item.action);
      counts[cat] = (counts[cat] ?? 0) + 1;
    }
    return counts;
  }, [items]);

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
              <p>Rastreie logins, alterações, chamados, permissões, integrações e exportações. Investigue quem fez o quê, quando e em qual entidade.</p>
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

          {/* Filtros rápidos por categoria */}
          <div className={styles.categoryChips}>
            <button
              type="button"
              className={`${styles.categoryChip} ${categoryFilter === "" ? styles.categoryChipActive : ""}`}
              onClick={() => setCategoryFilter("")}
            >Todos <span className={styles.chipCount}>{items.length}</span></button>
            {(["auth", "create", "update", "delete", "permission", "link", "integration", "error"] as ActionCategory[]).map((cat) => {
              const count = categoryCounts[cat] ?? 0;
              if (!count) return null;
              return (
                <button
                  key={cat}
                  type="button"
                  className={`${styles.categoryChip} ${badgeClass(cat)} ${categoryFilter === cat ? styles.categoryChipActive : ""}`}
                  onClick={() => setCategoryFilter((prev) => prev === cat ? "" : cat)}
                >
                  {getCategoryLabel(cat)} <span className={styles.chipCount}>{count}</span>
                </button>
              );
            })}
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
                onClick={() => { setAction(""); setEntityType(""); setActor(""); setSearchQuery(""); setStartDate(""); setEndDate(""); setCategoryFilter(""); }}
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
              const result = getResultLabel(cat);
              const isOpen = expandedId === item.id;
              const meta = (item.metadata && typeof item.metadata === "object" ? item.metadata : {}) as Record<string, unknown>;
              // Split metadata into contextual (summary enrichment) and operation details
              const beforeData = (meta._before && typeof meta._before === "object" && !Array.isArray(meta._before)) ? meta._before as Record<string, unknown> : null;
              const operationEntries = Object.entries(meta).filter(([k, v]) => v !== undefined && v !== null && k !== "_before" && !SUMMARY_META_KEYS.has(k) && !TECHNICAL_META_KEYS.has(k));
              // For diff: entries present in _before show as before→after; others show as regular kv
              const diffKeys = beforeData ? Object.keys(beforeData) : [];
              const diffEntries = operationEntries.filter(([k]) => diffKeys.includes(k));
              const regularEntries = operationEntries.filter(([k]) => !diffKeys.includes(k));
              const technicalEntries = Object.entries(meta).filter(([k, v]) => v !== undefined && v !== null && TECHNICAL_META_KEYS.has(k));

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
                        <span className={`${styles.badge} ${result.cls}`}>{result.label}</span>
                      </div>
                    </div>

                    {/* Time */}
                    <div className={styles.eventMeta}>
                      <span className={styles.eventTime}>{formatTime(item.created_at)}</span>
                      <span className={styles.eventTimeDate}>{formatDateOnly(item.created_at)}</span>
                      <svg className={`${styles.eventChevron} ${isOpen ? styles.eventChevronOpen : ""}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6l4 4 4-4" /></svg>
                    </div>
                  </button>

                  {/* ── Expanded detail — 3 tiers ────────────────── */}
                  {isOpen && (
                    <div className={styles.expandedPanel}>
                      {/* ── Tier 1: Resumo do evento ─────────────── */}
                      <div className={styles.tier}>
                        <p className={styles.tierTitle}>Resumo do evento</p>
                        <div className={styles.tierContentGrid}>
                          <div className={styles.kvRow}>
                            <span className={styles.kvLabel}>Evento</span>
                            <span className={styles.kvValue}>{title}</span>
                          </div>
                          <div className={styles.kvRow}>
                            <span className={styles.kvLabel}>Data e hora</span>
                            <span className={styles.kvValue}>{formatDate(item.created_at)}</span>
                          </div>
                          <div className={styles.kvRow}>
                            <span className={styles.kvLabel}>Executado por</span>
                            <span className={styles.kvValue}>{sub.actor}</span>
                          </div>
                          <div className={styles.kvRow}>
                            <span className={styles.kvLabel}>Entidade</span>
                            <span className={styles.kvValue}>{sub.entity}{sub.target ? `: ${sub.target}` : ""}</span>
                          </div>
                          <div className={styles.kvRow}>
                            <span className={styles.kvLabel}>Resultado</span>
                            <span className={`${styles.kvValue}`}>
                              <span className={`${styles.resultDot} ${result.cls}`} />
                              {result.label}
                            </span>
                          </div>
                          {typeof meta.companyLabel === "string" && meta.companyLabel && (
                            <div className={styles.kvRow}>
                              <span className={styles.kvLabel}>Empresa</span>
                              <span className={styles.kvValue}>{meta.companyLabel}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* ── Tier 2: Detalhes da alteração ────────── */}
                      {operationEntries.length > 0 && (
                        <div className={styles.tier}>
                          <p className={styles.tierTitle}>Detalhes da alteração</p>
                          <div className={styles.tierContent}>
                            {/* Before → After diff table */}
                            {diffEntries.length > 0 && beforeData && (
                              <table className={styles.diffTable}>
                                <thead>
                                  <tr>
                                    <th className={styles.diffHeader}>Campo</th>
                                    <th className={styles.diffHeader}>Antes</th>
                                    <th className={styles.diffHeaderArrow}></th>
                                    <th className={styles.diffHeader}>Depois</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {diffEntries.map(([key, val]) => {
                                    const before = formatMetaValue(beforeData[key]);
                                    const after = formatMetaValue(val);
                                    const changed = before !== after;
                                    return (
                                      <tr key={key} className={changed ? styles.diffRowChanged : styles.diffRow}>
                                        <td className={styles.diffCellLabel}>{METADATA_KEY_LABELS[key] ?? key}</td>
                                        <td className={styles.diffCellBefore}>{before}</td>
                                        <td className={styles.diffCellArrow}>{changed ? "→" : "="}</td>
                                        <td className={changed ? styles.diffCellAfter : styles.diffCellSame}>{after}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            )}
                            {/* Regular (non-diff) entries */}
                            {regularEntries.map(([key, val]) => (
                              <div key={key} className={styles.kvRow}>
                                <span className={styles.kvLabel}>{METADATA_KEY_LABELS[key] ?? key}</span>
                                <span className={styles.kvValue}>{formatMetaValue(val)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ── Tier 3: Informações técnicas ─────────── */}
                      <div className={styles.tier}>
                        <p className={styles.tierTitle}>Informações técnicas</p>
                        <div className={styles.tierContent}>
                          {item.entity_id && (
                            <div className={styles.kvRow}>
                              <span className={styles.kvLabel}>ID da entidade</span>
                              <span className={`${styles.kvValue} ${styles.kvValueMono}`}>{item.entity_id}</span>
                            </div>
                          )}
                          {item.actor_user_id && (
                            <div className={styles.kvRow}>
                              <span className={styles.kvLabel}>ID do ator</span>
                              <span className={`${styles.kvValue} ${styles.kvValueMono}`}>{item.actor_user_id}</span>
                            </div>
                          )}
                          {technicalEntries.map(([key, val]) => (
                            <div key={key} className={styles.kvRow}>
                              <span className={styles.kvLabel}>{METADATA_KEY_LABELS[key] ?? key}</span>
                              <span className={`${styles.kvValue} ${styles.kvValueMono}`}>{formatMetaValue(val)}</span>
                            </div>
                          ))}
                          <div className={styles.kvRow}>
                            <span className={styles.kvLabel}>ID do evento</span>
                            <span className={`${styles.kvValue} ${styles.kvValueMono}`}>{item.id}</span>
                          </div>
                          <div className={styles.kvRow}>
                            <span className={styles.kvLabel}>Ação (raw)</span>
                            <span className={`${styles.kvValue} ${styles.kvValueMono}`}>{item.action}</span>
                          </div>
                        </div>

                        {/* Collapsible raw JSON */}
                        <button
                          type="button"
                          className={`${styles.technicalToggle} ${showJson === item.id ? styles.technicalToggleOpen : ""}`}
                          onClick={() => setShowJson((prev) => (prev === item.id ? null : item.id))}
                        >
                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 4l4 4-4 4" /></svg>
                          Payload completo (JSON)
                        </button>
                        {showJson === item.id && (
                          <pre className={styles.technicalPre}>
                            {JSON.stringify({ id: item.id, action: item.action, entity_type: item.entity_type, entity_id: item.entity_id, entity_label: item.entity_label, actor_user_id: item.actor_user_id, actor_email: item.actor_email, created_at: item.created_at, metadata: item.metadata }, null, 2)}
                          </pre>
                        )}
                      </div>
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
