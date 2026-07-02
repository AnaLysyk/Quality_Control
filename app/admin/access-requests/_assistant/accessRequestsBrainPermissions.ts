import { hasPermissionAccess, resolveEffectivePermissionMatrix, type PermissionMatrix } from "@/lib/permissionMatrix";
import type { AccessRequestsBrainActionType } from "./accessRequestsBrain.types";

type Viewer = {
  permissions?: PermissionMatrix | null;
  permissionRole?: string | null;
  role?: string | null;
  companyRole?: string | null;
  globalRole?: string | null;
  isGlobalAdmin?: boolean | null;
  is_global_admin?: boolean | null;
} | null | undefined;

export function canRunAccessRequestsBrainAction(viewer: Viewer, action: AccessRequestsBrainActionType) {
  if (action === "view") return true;
  if (action === "pdf") return hasAccessRequestPermission(viewer, "view");
  if (action === "approve" || action === "reject" || action === "request_adjustment") {
    return hasAccessRequestPermission(viewer, action === "approve" ? "approve" : action === "reject" ? "reject" : "comment");
  }
  if (action === "remove") return hasAccessRequestPermission(viewer, "delete");
  return false;
}

export function hasAccessRequestPermission(viewer: Viewer, permission: string) {
  if (!viewer) return false;
  if (viewer.isGlobalAdmin === true || viewer.is_global_admin === true) return true;
  const matrix = resolveEffectivePermissionMatrix({
    permissions: viewer.permissions,
    permissionRole: viewer.permissionRole,
    role: viewer.role,
    companyRole: viewer.companyRole,
    globalRole: viewer.globalRole,
    isGlobalAdmin: viewer.isGlobalAdmin ?? viewer.is_global_admin ?? false,
  });
  return hasPermissionAccess(matrix, "access_requests", permission);
}

export function accessRequestsPermissionDeniedReply() {
  return "Eu encontrei a solicitação, mas não vou executar essa ação porque seu perfil não tem permissão para isso nesta tela.";
}


