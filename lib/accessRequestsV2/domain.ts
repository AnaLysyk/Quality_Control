import { normalizeLegacyRole, SYSTEM_ROLES, type SystemRole } from "@/lib/auth/roles";
import type { AuthUser } from "@/lib/jwtAuth";

export const ACCESS_REQUEST_V2_STATUSES = [
  "pending",
  "under_review",
  "approved",
  "rejected",
  "cancelled",
  "expired",
  "needs_more_info",
] as const;

export type AccessRequestV2Status = (typeof ACCESS_REQUEST_V2_STATUSES)[number];

export const ACCESS_REQUEST_V2_TYPES = [
  "company_access",
  "company_user",
  "testing_company_user",
  "leader_tc",
  "technical_support",
  "company_creation",
  "profile_change",
  "permission_change",
  "company_link",
] as const;

export type AccessRequestV2Type = (typeof ACCESS_REQUEST_V2_TYPES)[number];

export type AccessRequestV2Priority = "low" | "medium" | "high" | "critical";

export type AccessRequestV2 = {
  id: string;
  requesterUserId?: string;
  requesterEmail: string;
  requesterName?: string;
  requestType: AccessRequestV2Type;
  requestedRole?: string;
  requestedCompanySlug?: string;
  requestedCompanyId?: string;
  targetUserId?: string;
  status: AccessRequestV2Status;
  reason?: string;
  priority: AccessRequestV2Priority;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewComment?: string;
  createdAt: string;
  updatedAt: string;
};

export type AccessRequestReviewRecord = {
  requestId: string;
  previousStatus: AccessRequestV2Status;
  nextStatus: AccessRequestV2Status;
  reviewerUserId: string;
  comment?: string;
  createdAt: string;
};

export type AccessRequestAuditEvent = {
  action: string;
  actorUserId?: string | null;
  actorEmail?: string | null;
  at: string;
  metadata?: Record<string, unknown>;
};

export function normalizeAccessRequestV2Status(input?: string | null): AccessRequestV2Status | null {
  const value = (input ?? "").trim().toLowerCase();
  if (ACCESS_REQUEST_V2_STATUSES.includes(value as AccessRequestV2Status)) return value as AccessRequestV2Status;

  if (value === "open") return "pending";
  if (value === "in_progress") return "under_review";
  if (value === "closed") return "approved";
  return null;
}

export function normalizeAccessRequestV2Type(input?: string | null): AccessRequestV2Type | null {
  const value = (input ?? "").trim().toLowerCase();
  if (ACCESS_REQUEST_V2_TYPES.includes(value as AccessRequestV2Type)) return value as AccessRequestV2Type;

  if (value === "empresa" || value === "company") return "company_access";
  if (value === "company") return "company_access";
  if (value === "email_change" || value === "company_change") return "profile_change";
  if (value === "password_reset") return "permission_change";
  if (value === "profile_deletion") return "profile_change";
  return null;
}

export function normalizeAccessRequestV2Priority(input?: string | null): AccessRequestV2Priority {
  const value = (input ?? "").trim().toLowerCase();
  if (value === "low" || value === "medium" || value === "high" || value === "critical") return value;
  return "medium";
}

export function getEffectiveUserRole(user: Pick<AuthUser, "role" | "permissionRole" | "companyRole" | "isGlobalAdmin"> | null | undefined): SystemRole | null {
  if (!user) return null;
  if (user.isGlobalAdmin) return SYSTEM_ROLES.LEADER_TC;
  return (
    normalizeLegacyRole(user.permissionRole) ??
    normalizeLegacyRole(user.role) ??
    normalizeLegacyRole(user.companyRole) ??
    null
  );
}

export function canReviewAccessRequests(user: Pick<AuthUser, "role" | "permissionRole" | "companyRole" | "isGlobalAdmin"> | null | undefined) {
  const role = getEffectiveUserRole(user);
  return role === SYSTEM_ROLES.LEADER_TC || role === SYSTEM_ROLES.TECHNICAL_SUPPORT;
}

export function canApproveRequestedRole(
  reviewer: Pick<AuthUser, "role" | "permissionRole" | "companyRole" | "isGlobalAdmin"> | null | undefined,
  requestedRole?: string | null,
) {
  const reviewerRole = getEffectiveUserRole(reviewer);
  const normalizedRequestedRole = normalizeLegacyRole(requestedRole ?? null);

  if (!reviewerRole || !normalizedRequestedRole) return false;
  if (reviewerRole === SYSTEM_ROLES.LEADER_TC) return true;

  if (reviewerRole === SYSTEM_ROLES.TECHNICAL_SUPPORT) {
    return normalizedRequestedRole !== SYSTEM_ROLES.LEADER_TC;
  }

  return false;
}

export function canViewAccessRequest(
  user: Pick<AuthUser, "id" | "email" | "role" | "permissionRole" | "companyRole" | "isGlobalAdmin"> | null | undefined,
  request: Pick<AccessRequestV2, "requesterUserId" | "requesterEmail">,
) {
  if (!user?.id) return false;
  if (canReviewAccessRequests(user)) return true;

  const requesterEmail = (request.requesterEmail ?? "").trim().toLowerCase();
  const userEmail = (user.email ?? "").trim().toLowerCase();
  if (request.requesterUserId && request.requesterUserId === user.id) return true;
  if (requesterEmail && userEmail && requesterEmail === userEmail) return true;
  return false;
}
