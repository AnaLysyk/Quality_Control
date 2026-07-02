import "server-only";

import { findLocalUserByEmailOrId } from "@/lib/auth/localStore";
import type { AuthUser } from "@/lib/jwtAuth";
import { hasPermissionAccess, type PermissionMatrix } from "@/lib/permissionMatrix";
import { resolvePermissionAccessForUser } from "@/lib/serverPermissionAccess";
import type { AssistantAction, AssistantScreenContext } from "../types";
import { compactMultiline, normalizeText, sanitizeRoute } from "../helpers";
import { buildPromptActions, displayName, summarizePermissionMatrix } from "../data";
import type { AssistantExecutorResult } from "./types";

type PermissionExplanation = {
  label: string;
  allowed: boolean;
  reason: string;
  requiredPermissions: string[];
};

function buildRoutePermissionExplanation(route: string, permissions: PermissionMatrix | null | undefined): PermissionExplanation {
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
      requiredPermissions: ["tickets:view_all", "tickets:assign OU support:status"],
      reason: canViewGlobal
        ? "O perfil possui visÃ£o global de tickets e aÃ§Ã£o operacional de suporte."
        : "Para ver o Kanban global, precisa combinar tickets:view_all com assign/status.",
    };
  }

  if (normalizedRoute.startsWith("/admin/users/permissions")) {
    const allowed = hasPermissionAccess(permissions, "permissions", "view");
    return { 
      label: "GestÃ£o de permissÃµes", 
      allowed, 
      requiredPermissions: ["permissions:view"],
      reason: allowed ? "O perfil possui permissions:view." : "Requer permissions:view." 
    };
  }

  if (normalizedRoute.startsWith("/empresas") || normalizedRoute.startsWith("/admin/clients")) {
    const allowed = hasPermissionAccess(permissions, "applications", "view");
    return { 
      label: "Tela de empresas", 
      allowed, 
      requiredPermissions: ["applications:view"],
      reason: allowed ? "O perfil possui applications:view." : "Requer applications:view." 
    };
  }

  if (normalizedRoute.startsWith("/admin") || normalizedRoute.startsWith("/dashboard")) {
    const allowed = hasPermissionAccess(permissions, "dashboard", "view");
    return {
      label: "Painel administrativo",
      allowed,
      requiredPermissions: ["dashboard:view"],
      reason: allowed
        ? "O perfil possui dashboard:view."
        : "Requer dashboard:view.",
    };
  }

  return { 
    label: "Tela atual", 
    allowed: true, 
    requiredPermissions: [],
    reason: "NÃ£o hÃ¡ regra especializada para esta rota." 
  };
}

export async function toolExplainPermission(user: AuthUser, context: AssistantScreenContext, message: string): Promise<AssistantExecutorResult> {
  const canInspectOthers = hasPermissionAccess(user.permissions, "users", "view_all");
  const normalized = normalizeText(message);
  const targetIdentifierMatch = normalized.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|\b[0-9a-f]{8}-[0-9a-f-]{27}\b/i);
  let targetUser = null as Awaited<ReturnType<typeof findLocalUserByEmailOrId>>;
  let targetPermissions = user.permissions;
  let targetLabel = "Seu perfil";
  let isOwnProfile = true;

  if (canInspectOthers && targetIdentifierMatch?.[0]) {
    targetUser = await findLocalUserByEmailOrId(targetIdentifierMatch[0]);
    if (targetUser) {
      const resolved = await resolvePermissionAccessForUser(targetUser.id);
      targetPermissions = resolved.permissions;
      targetLabel = displayName(targetUser);
      isOwnProfile = false;
    }
  }

  const explanation = buildRoutePermissionExplanation(context.route, targetPermissions);
  const statusEmoji = explanation.allowed ? "âœ…" : "ðŸš«";
  const statusText = explanation.allowed ? "Acesso Permitido" : "Acesso Negado";

  const replyParts = [
    `## ðŸ” AnÃ¡lise de PermissÃµes`,
    "",
    `### ${statusEmoji} ${statusText}`,
    "",
    `| Campo | Valor |`,
    `|-------|-------|`,
    `| **UsuÃ¡rio** | ${targetLabel} |`,
    `| **Tela** | ${explanation.label} |`,
    `| **Rota** | \`${context.route}\` |`,
  ];

  if (explanation.requiredPermissions.length > 0) {
    replyParts.push(
      "",
      "### ðŸ“‹ PermissÃµes NecessÃ¡rias:",
      "",
      ...explanation.requiredPermissions.map((p) => {
        const hasIt = p.includes(" OU ") 
          ? "verificar manualmente" 
          : hasPermissionAccess(targetPermissions, p.split(":")[0], p.split(":")[1]);
        const emoji = hasIt === true ? "âœ…" : hasIt === false ? "âŒ" : "ðŸ”";
        return `- ${emoji} \`${p}\``;
      })
    );
  }

  replyParts.push(
    "",
    "### ðŸ’¡ ExplicaÃ§Ã£o:",
    "",
    explanation.reason,
  );

  // Mostrar permissÃµes atuais
  const permSummary = summarizePermissionMatrix(targetPermissions);
  if (permSummary !== "sem modulos liberados") {
    replyParts.push(
      "",
      "### ðŸ“Š PermissÃµes Atuais:",
      "",
      `\`${permSummary}\``,
    );
  }

  // SugestÃµes
  const actions: AssistantAction[] = [
    { kind: "prompt" as const, label: "ðŸ” Comparar perfis", prompt: "Comparar meu acesso com outro perfil" },
  ];

  if (!explanation.allowed && isOwnProfile) {
    actions.unshift({ kind: "prompt" as const, label: "â“ Por que nÃ£o tenho acesso?", prompt: `Por que nÃ£o tenho acesso a ${explanation.label}?` });
  }

  actions.push(...buildPromptActions(context).slice(0, 2));

  return {
    tool: "explain_permission",
    success: true,
    summary: `${statusText}: ${explanation.label}`,
    actions,
    reply: compactMultiline(replyParts.join("\n")),
  };
}

