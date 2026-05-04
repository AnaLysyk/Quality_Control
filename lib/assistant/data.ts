/**
 * Shared data-access helpers and presenters used by multiple tools.
 * Server-only — uses stores and RBAC.
 */
import "server-only";

import { getLocalUserById, listLocalCompanies, listLocalMemberships, listLocalUsers } from "@/lib/auth/localStore";
import type { AuthUser } from "@/lib/jwtAuth";
import { hasPermissionAccess, type PermissionMatrix } from "@/lib/permissionMatrix";
import { canAccessGlobalTicketWorkspace } from "@/lib/rbac/tickets";
import { attachAssigneeInfo, attachAssigneeToTicket } from "@/lib/ticketsPresenter";
import { listAllTickets, listTicketsForUser, type TicketRecord } from "@/lib/ticketsStore";
import { normalizeSearch, formatDateTime } from "./helpers";
import { extractTicketReference } from "./pure/parsing";
import type { AssistantAction, AssistantScreenContext } from "./types";

/* ──────────────────── Constants ──────────────────── */

export const MAX_RESULTS = 6;
export { extractTicketReference };

/* ──────────────────── User helpers ──────────────────── */

export function displayRole(user: AuthUser) {
  return user.permissionRole ?? user.role ?? user.companyRole ?? "usuário";
}

export function displayName(user: { full_name?: string | null; name?: string | null; email?: string | null } | null | undefined) {
  return user?.full_name?.trim() || user?.name?.trim() || user?.email?.trim() || "usuário";
}

export function isSupportOperator(user: AuthUser) {
  const values = [user.permissionRole, user.role, user.companyRole]
    .map((v) => normalizeSearch(v ?? ""))
    .filter(Boolean);
  return values.some((v) => v === "support" || v === "it_dev" || v === "dev" || v === "developer" || v === "technical_support");
}

export function isAdminOperator(user: AuthUser) {
  const values = [user.permissionRole, user.role, user.companyRole]
    .map((v) => normalizeSearch(v ?? ""))
    .filter(Boolean);
  return values.some((v) => v === "admin" || v === "company_admin" || v === "leader_tc" || v === "empresa");
}

/**
 * Returns true for empresa/company-side users (not TC staff).
 * An empresa user has empresa or company_user role but is NOT a TC leader or support.
 */
export function isEmpresaUser(user: AuthUser) {
  if (user.isGlobalAdmin) return false;
  const values = [user.permissionRole, user.role, user.companyRole]
    .map((v) => normalizeSearch(v ?? ""))
    .filter(Boolean);
  return (
    values.some((v) => v === "empresa" || v === "company_user") &&
    !values.some((v) => v === "leader_tc" || v === "technical_support")
  );
}

export function isProtectedPlatformProfile(user: { globalRole?: string | null; role?: string | null }) {
  if (normalizeSearch(user.globalRole ?? "") === "global_admin" || normalizeSearch(user.globalRole ?? "") === "leader_tc") return true;
  const r = normalizeSearch(user.role ?? "");
  return r === "support" || r === "it_dev" || r === "dev" || r === "developer" || r === "technical_support";
}

/* ──────────────────── Permission helpers ──────────────────── */

export function summarizePermissionMatrix(permissions: PermissionMatrix | null | undefined) {
  const entries = Object.entries(permissions ?? {}).filter(([, actions]) => Array.isArray(actions) && actions.length > 0);
  if (!entries.length) return "sem módulos liberados";
  return entries
    .slice(0, 6)
    .map(([moduleId, actions]) => `${moduleId}: ${actions.join(", ")}`)
    .join(" | ");
}

/* ──────────────────── Ticket helpers ──────────────────── */

export function scoreTicketMatch(ticket: TicketRecord, text: string) {
  const query = normalizeSearch(text);
  const code = normalizeSearch(ticket.code);
  const title = normalizeSearch(ticket.title);
  const description = normalizeSearch(ticket.description);
  const creator = normalizeSearch(ticket.createdByName ?? "");

  if (!query) return 0;
  if (code === query) return 100;
  if (code.endsWith(query)) return 90;
  if (title.startsWith(query)) return 70;
  if (title.includes(query)) return 55;
  if (description.includes(query)) return 40;
  if (creator.includes(query)) return 25;
  return 0;
}

export function formatTicketCard(ticket: Awaited<ReturnType<typeof attachAssigneeToTicket>>) {
  if (!ticket) return "";
  return [
    `${ticket.code} — ${ticket.title}`,
    `status: ${ticket.status} | prioridade: ${ticket.priority} | tipo: ${ticket.type}`,
    `criador: ${ticket.createdByName ?? "não identificado"} | responsável: ${ticket.assignedToName ?? "não definido"}`,
    `atualizado em: ${formatDateTime(ticket.updatedAt)}`,
  ].join("\n");
}

export async function getVisibleTickets(user: AuthUser) {
  const items = canAccessGlobalTicketWorkspace(user) ? await listAllTickets() : await listTicketsForUser(user.id);
  return attachAssigneeInfo(items);
}

export async function findVisibleTicket(user: AuthUser, input: string) {
  const visible = await getVisibleTickets(user);
  const ref = extractTicketReference(input);

  if (ref?.type === "id") {
    const exact = visible.find((t) => t.id.toLowerCase() === ref.id);
    if (exact) return exact;
  }
  if (ref?.type === "code" || ref?.type === "numeric") {
    const exact = visible.find((t) => t.code.toLowerCase() === ref.code.toLowerCase());
    if (exact) return exact;
  }

  const query = normalizeSearch(input);
  return visible
    .map((t) => ({ ticket: t, score: scoreTicketMatch(t, query) }))
    .sort((a, b) => b.score - a.score)
    .find((e) => e.score > 0)?.ticket ?? null;
}

/* ──────────────────── Visible users ──────────────────── */

export type VisibleUsersContext = {
  users: Array<{ id: string; name: string; email: string; login: string; role: string }>;
  scope: "all" | "company" | "own" | "none";
};

export async function getVisibleUsers(user: AuthUser): Promise<VisibleUsersContext> {
  const canViewUsers =
    hasPermissionAccess(user.permissions, "users", "view") ||
    hasPermissionAccess(user.permissions, "users", "view_company") ||
    hasPermissionAccess(user.permissions, "users", "view_all") ||
    isSupportOperator(user);

  if (!canViewUsers) {
    const current = await getLocalUserById(user.id);
    return {
      users: current
        ? [{ id: current.id, name: displayName(current), email: current.email, login: current.user ?? current.email, role: displayRole(user) }]
        : [],
      scope: "own",
    };
  }

  const scope = hasPermissionAccess(user.permissions, "users", "view_all") || isSupportOperator(user)
    ? "all"
    : hasPermissionAccess(user.permissions, "users", "view_company")
      ? "company"
      : "own";

  const [users, companies, memberships] = await Promise.all([listLocalUsers(), listLocalCompanies(), listLocalMemberships()]);

  if (scope === "all") {
    return {
      scope,
      users: users
        .filter((u) => !(isAdminOperator(user) && !isSupportOperator(user) && isProtectedPlatformProfile(u)))
        .map((u) => ({ id: u.id, name: displayName(u), email: u.email, login: u.user ?? u.email, role: u.role ?? "user" })),
    };
  }

  if (scope === "company") {
    const allowedCompanyIds = new Set<string>();
    if (user.companyId) allowedCompanyIds.add(user.companyId);
    const allowedSlugs = new Set((user.companySlugs ?? []).map((s) => normalizeSearch(s)));
    for (const c of companies) {
      if (allowedSlugs.has(normalizeSearch(c.slug))) allowedCompanyIds.add(c.id);
    }
    const allowedUserIds = new Set(memberships.filter((m) => allowedCompanyIds.has(m.companyId)).map((m) => m.userId));
    allowedUserIds.add(user.id);

    return {
      scope,
      users: users
        .filter((u) => allowedUserIds.has(u.id))
        .map((u) => ({ id: u.id, name: displayName(u), email: u.email, login: u.user ?? u.email, role: u.role ?? "user" })),
    };
  }

  const current = users.find((u) => u.id === user.id);
  return {
    scope,
    users: current
      ? [{ id: current.id, name: displayName(current), email: current.email, login: current.user ?? current.email, role: current.role ?? "user" }]
      : [],
  };
}

/* ──────────────────── Visible companies ──────────────────── */

export async function getVisibleCompanies(user: AuthUser) {
  if (
    !hasPermissionAccess(user.permissions, "applications", "view") &&
    !isSupportOperator(user) &&
    !canAccessGlobalTicketWorkspace(user)
  ) return [];

  const companies = await listLocalCompanies();
  if (canAccessGlobalTicketWorkspace(user) || user.isGlobalAdmin || isSupportOperator(user)) return companies;

  const allowedIds = new Set<string>();
  if (user.companyId) allowedIds.add(user.companyId);
  const allowedSlugs = new Set((user.companySlugs ?? []).map((s) => normalizeSearch(s)));
  return companies.filter((c) => allowedIds.has(c.id) || allowedSlugs.has(normalizeSearch(c.slug)));
}

/* ──────────────────── Actions builder ──────────────────── */

export function buildPromptActions(context: AssistantScreenContext): AssistantAction[] {
  return context.suggestedPrompts.slice(0, 4).map((prompt) => ({ kind: "prompt", label: prompt, prompt }));
}

/* ──────────────────── Filter helpers ──────────────────── */

export function getStatusFilters(message: string) {
  const n = normalizeSearch(message);
  if (n.includes("concluido") || n.includes("concluído")) return new Set(["done"]);
  if (n.includes("revisao") || n.includes("revisão")) return new Set(["review"]);
  if (n.includes("andamento")) return new Set(["doing"]);
  if (n.includes("backlog")) return new Set(["backlog"]);
  return null;
}

export function getPriorityFilters(message: string) {
  const n = normalizeSearch(message);
  if (n.includes("urgente") || n.includes("alta")) return new Set(["high"]);
  if (n.includes("media") || n.includes("média")) return new Set(["medium"]);
  if (n.includes("baixa")) return new Set(["low"]);
  return null;
}
