import type { RequestRecord } from "@/data/requestsStore";
import { parseAccessRequestMessage } from "@/lib/accessRequestMessage";
import { normalizeLegacyRole, SYSTEM_ROLES } from "@/lib/auth/roles";
import { hasPermissionAccess } from "@/lib/permissionMatrix";
import { resolveRoleDefaults } from "@/lib/permissions/roleDefaults";
import {
  canAdminReviewQueue,
  normalizeRequestProfileType,
  resolveReviewQueue,
  type ReviewQueue,
} from "@/lib/requestRouting";

type ReviewerSession = {
  role?: string | null;
  isGlobalAdmin?: boolean;
};

export function isGlobalReviewer(session: ReviewerSession | null | undefined) {
  return canReviewAccessRequests(session);
}

export function canReviewAccessRequests(session: ReviewerSession | null | undefined) {
  if (!session) return false;
  const role = normalizeLegacyRole(session.role);
  if (role === SYSTEM_ROLES.TECHNICAL_SUPPORT) return false;
  if (session.isGlobalAdmin === true) return true;
  return role === SYSTEM_ROLES.LEADER_TC || hasPermissionAccess(resolveRoleDefaults(role), "access_requests", "view");
}

export function canReviewerAccessQueue(session: ReviewerSession | null | undefined, queue: ReviewQueue) {
  if (!canReviewAccessRequests(session)) return false;
  return queue === "global_only" || canAdminReviewQueue(queue);
}

export function resolveAccessRequestQueue(message: string, fallbackEmail: string) {
  return parseAccessRequestMessage(message, fallbackEmail).reviewQueue;
}

export function resolveGenericRequestQueue(request: Pick<RequestRecord, "payload">) {
  const payload = request.payload ?? {};
  const explicitQueue = typeof payload.reviewQueue === "string" ? payload.reviewQueue : null;
  if (explicitQueue === "admin_and_global" || explicitQueue === "global_only") return explicitQueue;

  const profileType = normalizeRequestProfileType(typeof payload.profileType === "string" ? payload.profileType : "");
  return resolveReviewQueue(profileType ?? "testing_company_user");
}
