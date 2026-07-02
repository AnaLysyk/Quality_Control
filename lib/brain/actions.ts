import type { BrainNode } from "@prisma/client";

import type { BrainAccessContext } from "@/lib/brain/access";
import { recordBrainAuditEvent } from "@/lib/brain/audit";
import type { SystemPermission } from "@/lib/navigation/navigation.types";
import { canAccess } from "@/lib/permissions/can-access";

export const BRAIN_NODE_ACTION_IDS = [
  "open",
  "navigate",
  "summarize",
  "inspect",
  "filter",
  "create",
  "edit",
  "export",
  "explain",
  "open_external",
  "link_defect",
  "create_run",
  "update_case",
  "comment",
  "transition",
  "link_qase_case",
] as const;

export type BrainNodeActionId = (typeof BRAIN_NODE_ACTION_IDS)[number];

export type BrainNavigationTarget = {
  label?: string;
  route: string;
  query?: Record<string, string>;
  params?: Record<string, string>;
};

export type BrainNodeAction = {
  id: BrainNodeActionId;
  label: string;
  description?: string;
  type: "navigate" | "query" | "mutate" | "export" | "explain" | "external";
  route?: string;
  query?: Record<string, string>;
  params?: Record<string, string>;
  requiredPermissions: SystemPermission[];
  provider?: "qase" | "jira";
  externalId?: string;
  externalUrl?: string;
};

export type BrainActionResolution =
  | {
      allowed: true;
      action: BrainNodeAction;
      type: BrainNodeAction["type"];
      route?: string;
      query?: Record<string, string>;
      params?: Record<string, string>;
      message: string;
    }
  | {
      allowed: false;
      action: BrainNodeAction;
      reason: "missing_permission" | "unknown_action";
      missingPermissions: string[];
      message: string;
    };

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parsePermissionRequirement(value: unknown): SystemPermission | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const moduleId = readString(record.moduleId);
    const action = readString(record.action);
    return moduleId && action ? { moduleId, action } : null;
  }

  const raw = readString(value);
  if (!raw) return null;
  const separator = raw.includes(":") ? ":" : raw.includes(".") ? "." : null;
  if (!separator) return null;
  const [moduleId, action] = raw.split(separator);
  return moduleId && action ? { moduleId, action } : null;
}

function readPermissionRequirements(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(parsePermissionRequirement).filter((item): item is SystemPermission => Boolean(item));
  }
  const parsed = parsePermissionRequirement(value);
  return parsed ? [parsed] : [];
}

function permissionToString(permission: SystemPermission) {
  return `${permission.moduleId}:${permission.action}`;
}

function inferViewPermissions(node: Pick<BrainNode, "type" | "refType" | "refId" | "metadata">): SystemPermission[] {
  const metadata = toRecord(node.metadata);
  const explicit = [
    ...readPermissionRequirements(metadata.requiredPermissions),
    ...readPermissionRequirements(metadata.requiredPermission),
    ...readPermissionRequirements(metadata.permission),
    ...readPermissionRequirements(metadata.canOpen),
  ];
  if (explicit.length) return explicit;

  const provider = readString(metadata.provider) ?? readString(toRecord(metadata.source).provider);
  if (provider === "qase") return [{ moduleId: "qase", action: "view" }];
  if (provider === "jira") return [{ moduleId: "jira", action: "view" }];

  const type = String(node.type ?? node.refType ?? "").toLowerCase();
  if (type.includes("defect")) return [{ moduleId: "defect_tracking", action: "read" }, { moduleId: "defects", action: "view" }];
  if (type.includes("run") || type.includes("execution")) return [{ moduleId: "test_run", action: "read" }, { moduleId: "runs", action: "view" }];
  if (type.includes("testcase") || type.includes("case")) return [{ moduleId: "test_repository", action: "read" }];
  if (type.includes("testplan") || type.includes("plan")) return [{ moduleId: "test_plan", action: "read" }];
  if (type.includes("ticket")) return [{ moduleId: "tickets", action: "view" }];
  if (type.includes("user")) return [{ moduleId: "users", action: "view" }];
  if (type.includes("permission") || type.includes("profile")) return [{ moduleId: "permissions", action: "view" }];
  if (type.includes("document")) return [{ moduleId: "documents", action: "view" }];
  if (type.includes("automation")) return [{ moduleId: "playwright", action: "read" }];
  if (type.includes("audit")) return [{ moduleId: "audit", action: "view" }];
  if (type.includes("module") || type.includes("screen") || type.includes("route")) return [{ moduleId: "brain", action: "view" }];

  return [{ moduleId: "brain", action: "read" }];
}

function inferRoute(node: Pick<BrainNode, "id" | "type" | "refType" | "refId" | "metadata">) {
  const metadata = toRecord(node.metadata);
  const explicit = readString(metadata.route) ?? readString(metadata.routePath) ?? readString(metadata.path);
  if (explicit) return explicit;

  const type = String(node.type ?? node.refType ?? "").toLowerCase();
  if (type.includes("permission") || type.includes("profile")) return "/admin/users/permissions";
  if (type.includes("defect")) return "/empresas/[slug]/defeitos";
  if (type.includes("run")) return "/empresas/[slug]/runs";
  if (type.includes("ticket")) return "/chamados";
  if (type.includes("document")) return "/documentos";
  if (type.includes("user")) return "/admin/users";
  if (type.includes("company")) return "/admin/clients";
  if (type.includes("qase") || readString(toRecord(metadata.source).provider) === "qase") return readString(metadata.externalUrl) ?? "/admin/clients";
  if (type.includes("jira") || readString(toRecord(metadata.source).provider) === "jira") return readString(metadata.externalUrl) ?? "/admin/clients";
  return `/brain?node=${encodeURIComponent(node.id)}`;
}

function readActionPermissionMap(metadata: Record<string, unknown>, actionId: BrainNodeActionId) {
  const actionPermissions = toRecord(metadata.actionPermissions);
  return readPermissionRequirements(actionPermissions[actionId]);
}

function actionLabel(actionId: BrainNodeActionId, nodeLabel: string) {
  const labels: Record<BrainNodeActionId, string> = {
    open: `Abrir ${nodeLabel}`,
    navigate: `Navegar para ${nodeLabel}`,
    summarize: `Resumir ${nodeLabel}`,
    inspect: `Inspecionar ${nodeLabel}`,
    filter: `Filtrar por ${nodeLabel}`,
    create: `Criar em ${nodeLabel}`,
    edit: `Editar ${nodeLabel}`,
    export: `Exportar ${nodeLabel}`,
    explain: `Explicar ${nodeLabel}`,
    open_external: `Abrir externo ${nodeLabel}`,
    link_defect: `Vincular defeito`,
    create_run: `Criar run`,
    update_case: `Atualizar caso`,
    comment: `Comentar`,
    transition: `Mover status`,
    link_qase_case: `Vincular caso Qase`,
  };
  return labels[actionId];
}

function inferMutationPermission(actionId: BrainNodeActionId, node: Pick<BrainNode, "type" | "metadata">): SystemPermission[] {
  const metadata = toRecord(node.metadata);
  const provider = readString(metadata.provider) ?? readString(toRecord(metadata.source).provider);
  if (provider === "qase") {
    if (actionId === "create_run" || actionId === "create") return [{ moduleId: "qase", action: "create_run" }];
    if (actionId === "update_case" || actionId === "edit") return [{ moduleId: "qase", action: "update_case" }];
    if (actionId === "link_defect") return [{ moduleId: "qase", action: "link_defect" }];
    return [{ moduleId: "qase", action: "view" }];
  }
  if (provider === "jira") {
    if (actionId === "comment") return [{ moduleId: "jira", action: "comment_issue" }];
    if (actionId === "transition") return [{ moduleId: "jira", action: "transition_issue" }];
    if (actionId === "create") return [{ moduleId: "jira", action: "create_issue" }];
    if (actionId === "edit") return [{ moduleId: "jira", action: "update_issue" }];
    return [{ moduleId: "jira", action: "view" }];
  }

  const type = String(node.type ?? "").toLowerCase();
  if (type.includes("defect")) return [{ moduleId: "defect_tracking", action: "update" }, { moduleId: "defects", action: "edit" }];
  if (type.includes("ticket")) return [{ moduleId: "tickets", action: "edit" }];
  if (type.includes("user")) return [{ moduleId: "users", action: "edit" }];
  if (type.includes("permission") || type.includes("profile")) return [{ moduleId: "permissions", action: "edit" }];
  return [{ moduleId: "brain", action: "use" }];
}

function defaultActionIdsForNode(node: Pick<BrainNode, "type" | "metadata">): BrainNodeActionId[] {
  const metadata = toRecord(node.metadata);
  const configured = Array.isArray(metadata.availableActions) ? metadata.availableActions : Array.isArray(metadata.actions) ? metadata.actions : [];
  const configuredIds = configured
    .map((item) => readString(item))
    .filter((item): item is BrainNodeActionId => Boolean(item && (BRAIN_NODE_ACTION_IDS as readonly string[]).includes(item)));
  if (configuredIds.length) return configuredIds;

  const provider = readString(metadata.provider) ?? readString(toRecord(metadata.source).provider);
  if (provider === "qase") return ["open_external", "summarize", "inspect", "link_defect", "create_run", "update_case", "explain"];
  if (provider === "jira") return ["open_external", "summarize", "inspect", "comment", "transition", "link_qase_case", "explain"];

  return ["open", "navigate", "summarize", "inspect", "filter", "explain", "export"];
}

export function hasBrainActionPermission(access: BrainAccessContext, action: Pick<BrainNodeAction, "requiredPermissions">) {
  if (access.user.isGlobalAdmin) return true;
  if (action.requiredPermissions.length === 0) return true;
  return action.requiredPermissions.some((permission) => canAccess(access.userAccess, permission));
}

export function buildBrainNodeActions(
  node: Pick<BrainNode, "id" | "type" | "label" | "refType" | "refId" | "metadata">,
): BrainNodeAction[] {
  const metadata = toRecord(node.metadata);
  const viewPermissions = inferViewPermissions(node);
  const route = inferRoute(node);
  const provider = readString(metadata.provider) ?? readString(toRecord(metadata.source).provider);
  const externalUrl = readString(metadata.externalUrl) ?? readString(toRecord(metadata.source).externalUrl);
  const externalId = readString(metadata.externalId) ?? readString(toRecord(metadata.source).externalId) ?? node.refId ?? undefined;

  return defaultActionIdsForNode(node).map((actionId) => {
    const configuredPermissions = readActionPermissionMap(metadata, actionId);
    const isMutation = ["create", "edit", "link_defect", "create_run", "update_case", "comment", "transition", "link_qase_case"].includes(actionId);
    const requiredPermissions = configuredPermissions.length
      ? configuredPermissions
      : isMutation
        ? inferMutationPermission(actionId, node)
        : viewPermissions;
    const isNavigation = actionId === "open" || actionId === "navigate" || actionId === "open_external";

    return {
      id: actionId,
      label: actionLabel(actionId, node.label),
      type: actionId === "export" ? "export" : actionId === "explain" ? "explain" : isMutation ? "mutate" : isNavigation ? "navigate" : "query",
      route: actionId === "open_external" ? externalUrl ?? route : isNavigation ? route : undefined,
      query: actionId === "navigate" || actionId === "open" ? toStringRecord(metadata.query) : undefined,
      params: actionId === "navigate" || actionId === "open" ? toStringRecord(metadata.params) : undefined,
      requiredPermissions,
      provider: provider === "qase" || provider === "jira" ? provider : undefined,
      externalId,
      externalUrl: externalUrl ?? undefined,
    } satisfies BrainNodeAction;
  });
}

function toStringRecord(value: unknown): Record<string, string> | undefined {
  const record = toRecord(value);
  const entries = Object.entries(record)
    .map(([key, item]) => [key, typeof item === "string" ? item : item == null ? "" : String(item)] as const)
    .filter(([, item]) => item.length > 0);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

export function explainBrainActionBlock(action: Pick<BrainNodeAction, "requiredPermissions">) {
  return action.requiredPermissions.map(permissionToString);
}

export async function resolveBrainAction(input: {
  node: Pick<BrainNode, "id" | "type" | "label" | "refType" | "refId" | "metadata">;
  actionId: string;
  access: BrainAccessContext;
  audit?: boolean;
}): Promise<BrainActionResolution> {
  const actions = buildBrainNodeActions(input.node);
  const action = actions.find((item) => item.id === input.actionId) ?? actions.find((item) => item.id === "open");

  if (!action) {
    const fallback = {
      id: "open",
      label: `Abrir ${input.node.label}`,
      type: "navigate",
      route: `/brain?node=${encodeURIComponent(input.node.id)}`,
      requiredPermissions: inferViewPermissions(input.node),
    } satisfies BrainNodeAction;
    return {
      allowed: false,
      action: fallback,
      reason: "unknown_action",
      missingPermissions: [],
      message: "Acao nao reconhecida para este no.",
    };
  }

  const allowed = hasBrainActionPermission(input.access, action);
  const missingPermissions = allowed ? [] : explainBrainActionBlock(action);

  if (input.audit) {
    await recordBrainAuditEvent({
      userId: input.access.user.id,
      profile: input.access.userAccess.permissionRole ?? input.access.userAccess.role,
      companyId: input.access.userAccess.companyId,
      action: action.provider ? `brain.${action.provider}.node.${action.id}` : `brain.node.${action.id}`,
      nodeId: input.node.id,
      actionId: action.id,
      provider: action.provider,
      externalId: action.externalId,
      allowed,
      reason: allowed ? "allowed" : "missing_permission",
      missingPermissions,
    });
  }

  if (!allowed) {
    return {
      allowed: false,
      action,
      reason: "missing_permission",
      missingPermissions,
      message: `Seu perfil nao possui acesso para executar "${action.label}". Permissoes necessarias: ${missingPermissions.join(", ")}.`,
    };
  }

  return {
    allowed: true,
    action,
    type: action.type,
    route: action.route,
    query: action.query,
    params: action.params,
    message: action.route
      ? `Voce tem acesso. Posso abrir ${action.route}.`
      : `Voce tem acesso para ${action.label}.`,
  };
}

