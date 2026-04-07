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
  // Users
  "user.created": "Usuário criado",
  "user.updated": "Usuário atualizado",
  "user.deleted": "Usuário removido",
  "user.permissions.updated": "Permissões atualizadas",
  "user.permissions.reset": "Permissões restauradas",
  "user.activated": "Usuário ativado",
  "user.deactivated": "Usuário inativado",
  "user.role.changed": "Papel alterado",
  "user.email.changed": "E-mail alterado",
  "user.avatar.changed": "Avatar atualizado",
  "user.profile.updated": "Perfil atualizado",
  // Companies
  "client.created": "Empresa criada",
  "client.updated": "Empresa atualizada",
  "client.deleted": "Empresa removida",
  "client.logo.changed": "Logo da empresa alterado",
  "client.user.linked": "Usuário vinculado à empresa",
  "client.user.unlinked": "Usuário desvinculado da empresa",
  // Runs
  "run.created": "Execução criada",
  "run.deleted": "Execução removida",
  // Auth
  "auth.login.success": "Login realizado",
  "auth.login.failure": "Tentativa de login falhou",
  "auth.logout": "Logout realizado",
  "auth.password.changed": "Senha alterada",
  "auth.password.reset": "Senha redefinida",
  "auth.password.reset_requested": "Reset de senha solicitado",
  "auth.access.denied": "Acesso negado",
  // Tickets / Chamados
  "ticket.created": "Chamado aberto",
  "ticket.updated": "Chamado atualizado",
  "ticket.deleted": "Chamado removido",
  "ticket.assigned": "Chamado atribuído",
  "ticket.status.changed": "Status do chamado alterado",
  "ticket.closed": "Chamado fechado",
  "ticket.commented": "Comentário no chamado",
  // Access requests / Solicitações
  "access_request.created": "Solicitação de acesso criada",
  "access_request.accepted": "Solicitação aprovada",
  "access_request.rejected": "Solicitação recusada",
  "access_request.updated": "Solicitação ajustada",
  "access_request.commented": "Comentário na solicitação",
  // Self-service requests
  "request.email_change": "Solicitação de alteração de e-mail",
  "request.profile_deletion": "Solicitação de exclusão de perfil",
  "request.company_change": "Solicitação de mudança de empresa",
  // Defects
  "defect.created": "Defeito registrado",
  // Integrations
  "integration.updated": "Integração atualizada",
  "integration.activated": "Integração ativada",
  "integration.deactivated": "Integração desativada",
  "integration.failed": "Falha de integração",
  // Exports
  "export.executed": "Exportação de dados",
  // System
  "system.error": "Erro de sistema",
  "audit.purged": "Logs de auditoria limpos",
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
  access_request: "Solicitação",
  defect: "Defeito",
  integration: "Integração",
  export: "Exportação",
  request: "Solicitação",
  system: "Sistema",
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
  username: "Usuário (login)",
  // Auth
  reason: "Motivo",
  ip: "Endereço IP",
  method: "Método",
  sessionId: "Sessão",
  // Tickets
  type: "Tipo",
  priority: "Prioridade",
  status: "Status",
  from: "De",
  to: "Para",
  // Access requests
  profileType: "Tipo de perfil",
  accessType: "Tipo de acesso",
  company: "Empresa",
  comment: "Comentário",
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
  // Requests
  newEmail: "Novo e-mail",
  newCompanyName: "Nova empresa",
};

/** Standardized role labels for audit display. */
const ROLE_LABELS: Record<string, string> = {
  admin: "Admin global", global_admin: "Admin global",
  company: "Admin da empresa", company_admin: "Admin da empresa", client_admin: "Admin da empresa", client_owner: "Admin da empresa", client_manager: "Admin da empresa", empresa: "Admin da empresa",
  user: "Usuário da empresa", viewer: "Usuário da empresa", client_user: "Usuário da empresa", client_viewer: "Usuário da empresa", company_user: "Usuário da empresa",
  testing_company_user: "Usuário TC", dev: "Usuário TC", it_dev: "Usuário TC", developer: "Usuário TC", itdev: "Usuário TC",
  leader_tc: "Líder TC", tc_leader: "Líder TC", lider_tc: "Líder TC",
  support: "Suporte técnico", technical_support: "Suporte técnico", tech_support: "Suporte técnico", support_tech: "Suporte técnico",
};
/** Metadata keys that contain role values. */
const ROLE_META_KEYS = new Set(["role", "permissionRole", "targetPermissionRole", "actorRole", "membershipRole", "profileType"]);

/** Keys that belong in the "summary" tier (not the operation details). */
const SUMMARY_META_KEYS = new Set(["companyLabel", "companySlug", "companyId", "userEmail", "userId", "ip", "sessionId"]);
/** Keys that are IDs / technical — go in tier 3. */
const TECHNICAL_META_KEYS = new Set(["companyId", "userId", "ip", "sessionId", "_payload"]);

type ActionCategory = "create" | "update" | "delete" | "permission" | "link" | "auth" | "error" | "integration" | "export" | "default";

function getCategory(action: string): ActionCategory {
  const a = action.toLowerCase();
  if (a.includes("failure") || a.includes("fail") || a.includes("system.error") || a.includes("denied")) return "error";
  if (a.includes("error")) return "error";
  if (a.includes("login") || a.includes("logout") || a.includes("auth") || a.includes("password")) return "auth";
  if (a.includes("export")) return "export";
  if (a.includes("request.") || a.includes("access_request")) return "link";
  if (a.includes("link") || a.includes("unlink") || a.includes("membership")) return "link";
  if (a.includes("integration") || a.includes("sync")) return "integration";
  if (a.includes("permission") || a.includes("role") || a.includes("activated") || a.includes("deactivated")) return "permission";
  if (a.includes("ticket") || a.includes("defect")) {
    if (a.includes("create")) return "create";
    if (a.includes("delete")) return "delete";
    if (a.includes("closed")) return "delete";
    return "update";
  }
  if (a.includes("create")) return "create";
  if (a.includes("update") || a.includes("changed") || a.includes("logo") || a.includes("avatar") || a.includes("profile")) return "update";
  if (a.includes("delete") || a.includes("removed")) return "delete";
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
    export: styles.iconExport,
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
    export: styles.badgeExport,
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
  if (category === "export") {
    return (<svg {...common}><path d="M8 3v7" /><path d="M5 7l3 3 3-3" /><path d="M3 13h10" /></svg>);
  }
  return (<svg {...common}><circle cx="8" cy="8" r="6" /><path d="M8 5v3l2 1.5" /></svg>);
}

function entityTypeLabel(type: string) {
  return ENTITY_LABELS[type.toLowerCase()] ?? type;
}

function getEventTitle(item: AuditLog): string {
  return ACTION_TITLES[item.action] ?? item.action.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getEventSubtitle(item: AuditLog, actorNames: Record<string, string>): { actor: string; target: string; entity: string } {
  const meta = (item.metadata && typeof item.metadata === "object" ? item.metadata : {}) as Record<string, unknown>;
  const actor = (item.actor_user_id && actorNames[item.actor_user_id]) || item.actor_email || "sistema";
  const entity = entityTypeLabel(item.entity_type);
  let target = item.entity_label || "";
  if (!target && meta.companyLabel) target = String(meta.companyLabel);
  if (!target && meta.companySlug) target = String(meta.companySlug);
  if (!target && meta.userEmail) target = String(meta.userEmail);
  if (!target && item.entity_id) target = item.entity_id;
  return { actor, target, entity };
}

function getActorInitials(email: string | null): string {
  if (!email) return "S";
  const local = email.split("@")[0];
  const parts = local.split(/[._-]/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return local.slice(0, 2).toUpperCase();
}

function getCategoryLabel(cat: ActionCategory): string {
  return {
    create: "Criação", update: "Alteração", delete: "Exclusão",
    permission: "Permissão", link: "Vínculo", auth: "Autenticação",
    error: "Erro", integration: "Integração", export: "Exportação", default: "Evento",
  }[cat];
}

function getResultLabel(cat: ActionCategory): { label: string; cls: string } {
  if (cat === "error") return { label: "Erro", cls: styles.resultError };
  if (cat === "delete") return { label: "Executado", cls: styles.resultWarning };
  if (cat === "auth") return { label: "Registrado", cls: styles.resultSuccess };
  if (cat === "export") return { label: "Exportado", cls: styles.resultSuccess };
  return { label: "Sucesso", cls: styles.resultSuccess };
}

function formatMetaValue(val: unknown, key?: string): string {
  if (val === true) return "Sim";
  if (val === false) return "Não";
  if (val === null || val === undefined) return "—";
  if (Array.isArray(val)) return val.length ? val.join(", ") : "—";
  if (typeof val === "object") return JSON.stringify(val);
  const str = String(val);
  if (key && ROLE_META_KEYS.has(key)) return ROLE_LABELS[str.toLowerCase()] ?? str;
  return str;
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

type ResultFilter = "" | "success" | "error" | "warning";
type DatePreset = "" | "today" | "yesterday" | "7d" | "30d" | "thisMonth" | "lastMonth" | "custom";

function applyDatePreset(preset: DatePreset): { start: string; end: string } {
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const now = new Date();
  const today = fmt(now);
  switch (preset) {
    case "today": return { start: today, end: today };
    case "yesterday": { const y = new Date(now); y.setDate(y.getDate() - 1); return { start: fmt(y), end: fmt(y) }; }
    case "7d": { const d = new Date(now); d.setDate(d.getDate() - 7); return { start: fmt(d), end: today }; }
    case "30d": { const d = new Date(now); d.setDate(d.getDate() - 30); return { start: fmt(d), end: today }; }
    case "thisMonth": { const d = new Date(now.getFullYear(), now.getMonth(), 1); return { start: fmt(d), end: today }; }
    case "lastMonth": { const s = new Date(now.getFullYear(), now.getMonth() - 1, 1); const e = new Date(now.getFullYear(), now.getMonth(), 0); return { start: fmt(s), end: fmt(e) }; }
    default: return { start: "", end: "" };
  }
}

const RESULT_CATEGORIES: Record<ResultFilter, ActionCategory[]> = {
  "": [],
  success: ["create", "update", "permission", "link", "auth", "export", "default"],
  error: ["error"],
  warning: ["delete"],
};

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "", label: "Qualquer período" },
  { value: "today", label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "thisMonth", label: "Este mês" },
  { value: "lastMonth", label: "Mês passado" },
  { value: "custom", label: "Personalizado" },
];

const PAGE_SIZES = [25, 50, 100];

export default function AdminAuditLogsPage() {
  const [items, setItems] = useState<AuditLog[]>([]);
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  const [actorNames, setActorNames] = useState<Record<string, string>>({});
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
  const [showTech, setShowTech] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<ActionCategory | "">("");

  // Result & date preset filters
  const [resultFilter, setResultFilter] = useState<ResultFilter>("");
  const [datePreset, setDatePreset] = useState<DatePreset>("");

  // Pagination
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);

  // Purge state
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [purgeStart, setPurgeStart] = useState("");
  const [purgeEnd, setPurgeEnd] = useState("");
  const [purging, setPurging] = useState(false);
  const [purgeResult, setPurgeResult] = useState<string | null>(null);
  const [purgeError, setPurgeError] = useState<string | null>(null);

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
      setAvatars(json?.avatars && typeof json.avatars === "object" ? json.avatars as Record<string, string> : {});
      setActorNames(json?.actorNames && typeof json.actorNames === "object" ? json.actorNames as Record<string, string> : {});
      setWarning(typeof json?.warning === "string" ? json.warning : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar histórico");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handlePurge = useCallback(async () => {
    if (!purgeStart || !purgeEnd) return;
    setPurging(true);
    setPurgeError(null);
    setPurgeResult(null);
    try {
      const res = await fetch("/api/admin/audit-logs", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: purgeStart, endDate: purgeEnd }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Falha ao limpar logs");
      setPurgeResult(`${json?.deleted ?? 0} registros removidos com sucesso.`);
      load();
    } catch (err) {
      setPurgeError(err instanceof Error ? err.message : "Erro ao limpar logs");
    } finally {
      setPurging(false);
    }
  }, [purgeStart, purgeEnd, load]);

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
      if (resultFilter) {
        const cats = RESULT_CATEGORIES[resultFilter];
        if (!cats.includes(getCategory(log.action))) return false;
      }
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
        const endD = new Date(endDate);
        endD.setHours(23, 59, 59, 999);
        if (date > endD) return false;
      }
      return true;
    });
  }, [items, action, actor, startDate, endDate, entityType, searchQuery, categoryFilter, resultFilter]);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [action, entityType, categoryFilter, resultFilter, actor, searchQuery, startDate, endDate]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredItems.length / pageSize)), [filteredItems.length, pageSize]);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

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
      <div className="px-4 py-4 space-y-3">

        {error && (
          <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
        )}
        {warning && !error && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">{warning}</div>
        )}

        {/* ── Card principal ─────────────────────────────────── */}
        <div className={styles.card}>

          {/* Filtros rápidos por categoria */}
          <div className={styles.categoryChips}>
            <button
              type="button"
              className={`${styles.categoryChip} ${categoryFilter === "" ? styles.categoryChipActive : ""}`}
              onClick={() => setCategoryFilter("")}
            >Todos <span className={styles.chipCount}>{items.length}</span></button>
            {(["auth", "create", "update", "delete", "permission", "link", "integration", "export", "error"] as ActionCategory[]).map((cat) => {
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
                Resultado
                <select value={resultFilter} onChange={(e) => setResultFilter(e.target.value as ResultFilter)} className={styles.filterSelect}>
                  <option value="">Todos</option>
                  <option value="success">Sucesso</option>
                  <option value="error">Erro / Negado</option>
                  <option value="warning">Exclusão / Alerta</option>
                </select>
              </label>
            </div>
            <div className={styles.filtersRow2}>
              <label className={styles.filterLabel}>
                Ator
                <input type="text" value={actor} onChange={(e) => setActor(e.target.value)} placeholder="email do responsável" className={styles.filterInput} />
              </label>
              <label className={styles.filterLabel}>
                Período
                <select
                  value={datePreset}
                  onChange={(e) => {
                    const preset = e.target.value as DatePreset;
                    setDatePreset(preset);
                    if (preset && preset !== "custom") {
                      const { start, end } = applyDatePreset(preset);
                      setStartDate(start);
                      setEndDate(end);
                    }
                  }}
                  className={styles.filterSelect}
                >
                  {DATE_PRESETS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </label>
              {(datePreset === "custom" || datePreset === "") && (
                <>
                  <label className={styles.filterLabel}>
                    Data inicial
                    <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setDatePreset("custom"); }} className={styles.filterInput} />
                  </label>
                  <label className={styles.filterLabel}>
                    Data final
                    <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setDatePreset("custom"); }} className={styles.filterInput} />
                  </label>
                </>
              )}
            </div>
            <div className={styles.filtersActions}>
              <button onClick={load} disabled={loading} className={styles.btnPrimary}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M14 2v4h-4" /><path d="M13.5 10A6 6 0 113.3 4.5" />
                </svg>
                {loading ? "Atualizando…" : "Atualizar"}
              </button>
              <button
                onClick={() => { setAction(""); setEntityType(""); setActor(""); setSearchQuery(""); setStartDate(""); setEndDate(""); setCategoryFilter(""); setResultFilter(""); setDatePreset(""); }}
                className={styles.btnGhost}
              >
                Limpar filtros
              </button>
              <button
                onClick={() => { setPurgeOpen(true); setPurgeResult(null); setPurgeError(null); }}
                className={styles.btnDanger}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M3 4h10M5.5 4V3a1 1 0 011-1h3a1 1 0 011 1v1M6 7v4M10 7v4" /><path d="M4 4l.7 8.5a1.5 1.5 0 001.5 1.5h3.6a1.5 1.5 0 001.5-1.5L12 4" />
                </svg>
                Limpar logs
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
              <svg className={styles.emptyStateIcon} width="32" height="32" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
                <circle cx="8" cy="8" r="6" /><path d="M8 5v3.5" /><circle cx="8" cy="11" r="0.5" fill="currentColor" stroke="none" />
              </svg>
              Não há logs para o filtro selecionado.
            </div>
          )}

          {/* ── Event timeline ─────────────────────────────────── */}
          {!showSkeleton && filteredItems.length > 0 && (
            <div className={styles.listHeader}>
              <span className={styles.listHeaderLabel}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M2 4h12M2 8h12M2 12h12" /></svg>
                Eventos
              </span>
              <span className={styles.listHeaderCount}>{filteredItems.length} resultado{filteredItems.length !== 1 ? "s" : ""} · Página {currentPage} de {totalPages}</span>
            </div>
          )}
          {/* ── Pagination ─────────────────────────────────── */}
          {filteredItems.length > 0 && (
            <div className={styles.paginationBar}>
              <div className={styles.paginationInfo}>
                <span>{filteredItems.length} resultado{filteredItems.length !== 1 ? "s" : ""}</span>
                <span className={styles.paginationSep}>·</span>
                <span>Página {currentPage} de {totalPages}</span>
              </div>
              <div className={styles.paginationControls}>
                <label className={styles.paginationLabel}>
                  Por página
                  <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} className={styles.paginationSelect}>
                    {PAGE_SIZES.map((s) => (<option key={s} value={s}>{s}</option>))}
                  </select>
                </label>
                <div className={styles.paginationButtons}>
                  <button type="button" disabled={currentPage <= 1} onClick={() => setCurrentPage(1)} className={styles.paginationBtn} title="Primeira página">«</button>
                  <button type="button" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)} className={styles.paginationBtn} title="Página anterior">‹</button>
                  <button type="button" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)} className={styles.paginationBtn} title="Próxima página">›</button>
                  <button type="button" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(totalPages)} className={styles.paginationBtn} title="Última página">»</button>
                </div>
              </div>
            </div>
          )}
          <div className={styles.eventList}>
            {paginatedItems.map((item) => {
              const cat = getCategory(item.action);
              const title = getEventTitle(item);
              const sub = getEventSubtitle(item, actorNames);
              const result = getResultLabel(cat);
              const isOpen = expandedId === item.id;
              const meta = (item.metadata && typeof item.metadata === "object" ? item.metadata : {}) as Record<string, unknown>;
              // Split metadata into contextual (summary enrichment) and operation details
              const beforeData = (meta._before && typeof meta._before === "object" && !Array.isArray(meta._before)) ? meta._before as Record<string, unknown> : null;
              const operationEntries = Object.entries(meta).filter(([k, v]) => v !== undefined && v !== null && k !== "_before" && !SUMMARY_META_KEYS.has(k) && !TECHNICAL_META_KEYS.has(k));
              // For diff: merge keys from _before and current operation entries for full before→after view
              const allDiffKeys = beforeData ? [...new Set([...Object.keys(beforeData), ...operationEntries.map(([k]) => k)])] : [];
              const diffEntries = allDiffKeys.map((k) => {
                const after = meta[k] ?? null;
                const before = beforeData ? beforeData[k] ?? null : null;
                return [k, after, before] as [string, unknown, unknown];
              });
              const diffKeySet = new Set(allDiffKeys);
              const regularEntries = operationEntries.filter(([k]) => !diffKeySet.has(k));              const technicalEntries = Object.entries(meta).filter(([k, v]) => v !== undefined && v !== null && TECHNICAL_META_KEYS.has(k));

              return (
                <div key={item.id} className={`${styles.eventRow} ${isOpen ? styles.eventRowExpanded : ""}`}>
                  <button
                    type="button"
                    onClick={() => setExpandedId((prev) => (prev === item.id ? null : item.id))}
                    className={styles.eventButton}
                  >
                    {/* Avatar */}
                    <div className={`${styles.eventAvatar} ${iconClass(cat)}`}>
                      {avatars[item.actor_user_id ?? ""] ? (
                        <img
                          src={avatars[item.actor_user_id!]}
                          alt={item.actor_email ?? ""}
                          className={styles.eventAvatarImg}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).nextElementSibling && ((e.target as HTMLImageElement).nextElementSibling as HTMLElement).style.removeProperty("display"); }}
                        />
                      ) : null}
                      <span style={avatars[item.actor_user_id ?? ""] ? { display: "none" } : undefined}>
                        {getActorInitials(item.actor_email)}
                      </span>
                    </div>

                    {/* Content */}
                    <div className={styles.eventContent}>
                      <p className={styles.eventTitle}>{title}{sub.target ? <span className={styles.eventTargetInline}> · {sub.target}</span> : null}</p>
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
                            <span className={styles.kvLabel}>Resultado</span>
                            <span className={`${styles.kvValue}`}>
                              <span className={`${styles.resultDot} ${result.cls}`} />
                              {result.label}
                            </span>
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
                          {typeof meta.companyLabel === "string" && meta.companyLabel && (
                            <div className={styles.kvRow}>
                              <span className={styles.kvLabel}>Empresa</span>
                              <span className={styles.kvValue}>{meta.companyLabel}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* ── Tier 2: Detalhes da alteração ────────── */}
                      {(diffEntries.length > 0 || regularEntries.length > 0) && (
                        <div className={styles.tier}>
                          <p className={styles.tierTitle}>Alterações</p>
                          <div className={styles.tierContent}>
                            {/* Before → After diff table */}
                            {diffEntries.length > 0 && (
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
                                  {diffEntries.map(([key, afterVal, beforeVal]) => {
                                    const before = formatMetaValue(beforeVal, key);
                                    const after = formatMetaValue(afterVal, key);
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
                                <span className={styles.kvValue}>{formatMetaValue(val, key)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ── Tier 3: Informações técnicas (collapsible) ── */}
                      <div className={styles.tier}>
                        <button
                          type="button"
                          className={`${styles.technicalToggle} ${showTech === item.id ? styles.technicalToggleOpen : ""}`}
                          onClick={() => setShowTech((prev) => prev === item.id ? null : item.id)}
                        >
                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 4l4 4-4 4" /></svg>
                          <span className={styles.tierTitleInline}>Informações técnicas</span>
                        </button>
                        {showTech === item.id && (
                        <div className={styles.tierContentCollapsible}>
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
                              <span className={`${styles.kvValue} ${styles.kvValueMono}`}>{formatMetaValue(val, key)}</span>
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

      {/* Purge modal */}
      {purgeOpen && (
        <div className={styles.modalOverlay} onClick={() => !purging && setPurgeOpen(false)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalIconWrap}>
                <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <circle cx="8" cy="8" r="6" /><path d="M8 5.5v3" /><circle cx="8" cy="11" r="0.5" fill="currentColor" stroke="none" />
                </svg>
              </div>
              <span className={styles.modalTitle}>Limpar registros de auditoria</span>
            </div>

            <p className={styles.modalBody}>
              Selecione o período dos registros que deseja remover permanentemente do banco de dados.
              Registros de limpeza de logs são preservados e não podem ser removidos por esta operação.
            </p>

            <div className={styles.modalDateRow}>
              <label className={styles.modalDateLabel}>
                Data inicial
                <input type="date" value={purgeStart} onChange={(e) => setPurgeStart(e.target.value)} className={styles.modalDateInput} />
              </label>
              <label className={styles.modalDateLabel}>
                Data final
                <input type="date" value={purgeEnd} onChange={(e) => setPurgeEnd(e.target.value)} className={styles.modalDateInput} />
              </label>
            </div>

            {purgeStart && purgeEnd && !purgeResult && (
              <div className={styles.modalWarning}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M8 1.5L1 14h14L8 1.5z" /><path d="M8 6.5v3" /><circle cx="8" cy="12" r="0.5" fill="currentColor" stroke="none" />
                </svg>
                <span>
                  Todos os registros entre <strong>{new Date(purgeStart + "T00:00:00").toLocaleDateString("pt-BR")}</strong> e <strong>{new Date(purgeEnd + "T00:00:00").toLocaleDateString("pt-BR")}</strong> serão
                  apagados <strong>permanentemente</strong>. Esta ação não pode ser desfeita.
                </span>
              </div>
            )}

            {purgeError && (
              <div className={styles.modalWarning}>
                <span>{purgeError}</span>
              </div>
            )}

            {purgeResult && (
              <div className={styles.purgeResult}>{purgeResult}</div>
            )}

            <div className={styles.modalActions}>
              <button
                onClick={() => { setPurgeOpen(false); setPurgeStart(""); setPurgeEnd(""); setPurgeResult(null); setPurgeError(null); }}
                className={styles.modalCancel}
                disabled={purging}
              >
                {purgeResult ? "Fechar" : "Cancelar"}
              </button>
              {!purgeResult && (
                <button
                  onClick={handlePurge}
                  disabled={purging || !purgeStart || !purgeEnd}
                  className={styles.btnDangerFilled}
                >
                  {purging ? "Removendo…" : "Confirmar exclusão"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
