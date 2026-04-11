import "server-only";

import { normalizeLegacyRole, SYSTEM_ROLES } from "@/lib/auth/roles";
import { hasPermissionAccess } from "@/lib/permissionMatrix";
import { resolveRoleDefaults } from "@/lib/permissions/roleDefaults";
import { readSessionUser, type AdminSession } from "@/lib/rbac/requireGlobalAdmin";

function canReviewAccessRequests(role?: string | null) {
  const normalizedRole = normalizeLegacyRole(role);
  return normalizedRole === SYSTEM_ROLES.LEADER_TC || hasPermissionAccess(resolveRoleDefaults(normalizedRole), "access_requests", "view");
}

export async function requireAccessRequestReviewer(
  req: Request,
  opts?: { token?: string | null },
): Promise<AdminSession | null> {
  const session = await readSessionUser(req);
  if (!session) return null;

  const role = session.role ?? null;
  const normalizedRole = normalizeLegacyRole(role);
  const isGlobalAdmin =
    normalizedRole !== SYSTEM_ROLES.TECHNICAL_SUPPORT &&
    (session.isGlobalAdmin === true || (session.globalRole ?? "").toLowerCase() === "global_admin");
  const isGlobalReviewer = isGlobalAdmin || canReviewAccessRequests(role);
  if (!isGlobalReviewer && !canReviewAccessRequests(role)) return null;

  return {
    id: session.userId ?? session.id ?? "",
    email: session.email ?? "",
    token: opts?.token ?? "",
    role,
    isGlobalAdmin,
    globalRole: session.globalRole ?? null,
    isGlobalReviewer,
  };
}

export async function requireAccessRequestReviewerWithStatus(
  req: Request,
  opts?: { token?: string | null },
): Promise<{ admin: AdminSession | null; status: 200 | 401 | 403 }> {
  const admin = await requireAccessRequestReviewer(req, opts);
  if (admin) return { admin, status: 200 };

  const session = await readSessionUser(req);
  if (!session) return { admin: null, status: 401 };
  return { admin: null, status: 403 };
}
