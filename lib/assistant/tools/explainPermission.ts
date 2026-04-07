import "server-only";

import { findLocalUserByEmailOrId } from "@/lib/auth/localStore";
import type { AuthUser } from "@/lib/jwtAuth";
import { hasPermissionAccess, type PermissionMatrix } from "@/lib/permissionMatrix";
import { resolvePermissionAccessForUser } from "@/lib/serverPermissionAccess";
import type { AssistantScreenContext } from "../types";
import { compactMultiline, normalizeText, sanitizeRoute } from "../helpers";
import { buildPromptActions, displayName, summarizePermissionMatrix } from "../data";
import type { AssistantExecutorResult } from "./types";

function buildRoutePermissionExplanation(route: string, permissions: PermissionMatrix | null | undefined) {
  const normalizedRoute = sanitizeRoute(route);

  if (normalizedRoute.startsWith("/admin/support") || normalizedRoute.startsWith("/kanban-it")) {
    const canViewGlobal =
      hasPermissionAccess(permissions, "tickets", "view_all") &&
      (
        hasPermissionAccess(permissions, "tickets", "assign") ||
        hasPermissionAccess(permissions, "tickets", "status") ||
        hasPermissionAccess(permissions, "support", "assign") ||
        hasPermissionAccess(permissions, "support", "status")
      );
    return {
      label: "Kanban global de suporte",
      allowed: canViewGlobal,
      reason: canViewGlobal
        ? "O perfil possui visao global de tickets e acao operacional de suporte."
        : "Para ver o Kanban global, o perfil precisa combinar tickets:view_all com assign/status de tickets ou support.",
    };
  }

  if (normalizedRoute.startsWith("/admin/users/permissions")) {
    const allowed = hasPermissionAccess(permissions, "permissions", "view");
    return { label: "Gestao de permissoes por usuario", allowed, reason: allowed ? "O perfil possui permissions:view." : "Esse acesso depende de permissions:view." };
  }

  if (normalizedRoute.startsWith("/empresas") || normalizedRoute.startsWith("/admin/clients")) {
    const allowed = hasPermissionAccess(permissions, "applications", "view");
    return { label: "Tela de empresas", allowed, reason: allowed ? "O perfil possui applications:view." : "Esse acesso depende de applications:view." };
  }

  if (normalizedRoute.startsWith("/admin") || normalizedRoute.startsWith("/dashboard")) {
    const allowed = hasPermissionAccess(permissions, "dashboard", "view");
    return {
      label: "Painel administrativo",
      allowed,
      reason: allowed
        ? "O perfil possui dashboard:view e pode acessar o painel administrativo."
        : "Esse acesso depende de dashboard:view.",
    };
  }

  return { label: "Tela atual", allowed: true, reason: "Nao ha uma regra especializada mapeada para esta rota; o agente usa o escopo efetivo da sessao." };
}

export async function toolExplainPermission(user: AuthUser, context: AssistantScreenContext, message: string): Promise<AssistantExecutorResult> {
  const canInspectOthers = hasPermissionAccess(user.permissions, "users", "view_all");
  const normalized = normalizeText(message);
  const targetIdentifierMatch = normalized.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|\b[0-9a-f]{8}-[0-9a-f-]{27}\b/i);
  let targetUser = null as Awaited<ReturnType<typeof findLocalUserByEmailOrId>>;
  let targetPermissions = user.permissions;
  let targetLabel = "perfil atual";

  if (canInspectOthers && targetIdentifierMatch?.[0]) {
    targetUser = await findLocalUserByEmailOrId(targetIdentifierMatch[0]);
    if (targetUser) {
      const resolved = await resolvePermissionAccessForUser(targetUser.id);
      targetPermissions = resolved.permissions;
      targetLabel = displayName(targetUser);
    }
  }

  const explanation = buildRoutePermissionExplanation(context.route, targetPermissions);
  return {
    tool: "explain_permission",
    success: true,
    summary: explanation.label,
    actions: buildPromptActions(context),
    reply: compactMultiline([
      `${targetLabel} — ${explanation.label}`,
      explanation.allowed ? "Acesso permitido." : "Acesso nao permitido.",
      explanation.reason,
      "",
      `Permissoes consideradas: ${summarizePermissionMatrix(targetPermissions)}`,
    ].join("\n")),
  };
}
