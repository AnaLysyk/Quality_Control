import type { BrainAccessContext } from "@/backend/brain/access";
import type { PermissionMatrix } from "@/backend/permissionMatrix";

export type BrainConversationContext = {
  lastNodeId?: string | null;
  lastNodeType?: string | null;
  lastCompanyId?: string | null;
  lastProjectId?: string | null;
  lastRoute?: string | null;
  lastIntent?: string | null;
};

export type BrainRuntimeContext = {
  userId: string;
  role: string;
  companyId?: string | null;
  projectId?: string | null;
  visibleCompanyIds: string[];
  visibleProjectIds: string[];
  effectivePermissions: PermissionMatrix;
  permissionVersion: string;
  currentBrainContext: BrainConversationContext;
};

function stablePermissionVersion(permissions: PermissionMatrix) {
  const normalized = Object.keys(permissions)
    .sort((a, b) => a.localeCompare(b))
    .map((moduleId) => `${moduleId}:${[...(permissions[moduleId] ?? [])].sort((a, b) => a.localeCompare(b)).join(",")}`)
    .join("|");

  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16);
}

export function buildBrainRuntimeContext(
  access: BrainAccessContext,
  currentBrainContext: BrainConversationContext = {},
): BrainRuntimeContext {
  const role =
    access.userAccess.permissionRole ??
    access.userAccess.role ??
    access.user.permissionRole ??
    access.user.role ??
    "unknown";

  return {
    userId: access.userAccess.userId,
    role,
    companyId: access.userAccess.companyId,
    projectId: null,
    visibleCompanyIds: Array.from(access.allowedCompanyIds),
    visibleProjectIds: [],
    effectivePermissions: access.userAccess.permissions,
    permissionVersion: stablePermissionVersion(access.userAccess.permissions),
    currentBrainContext,
  };
}

export function updateBrainConversationContext(
  previous: BrainConversationContext,
  patch: BrainConversationContext,
): BrainConversationContext {
  return {
    lastNodeId: patch.lastNodeId ?? previous.lastNodeId ?? null,
    lastNodeType: patch.lastNodeType ?? previous.lastNodeType ?? null,
    lastCompanyId: patch.lastCompanyId ?? previous.lastCompanyId ?? null,
    lastProjectId: patch.lastProjectId ?? previous.lastProjectId ?? null,
    lastRoute: patch.lastRoute ?? previous.lastRoute ?? null,
    lastIntent: patch.lastIntent ?? previous.lastIntent ?? null,
  };
}

