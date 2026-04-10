import type { RequestRecord } from "@/data/requestsStore";
import { isTechnicalSupportUser } from "@/lib/supportAccess";

type SelfServiceRequestUser = {
  id?: string | null;
  role?: string | null;
  permissionRole?: string | null;
  companyRole?: string | null;
  isGlobalAdmin?: boolean;
} | null | undefined;

export type SelfServiceRequestScope = "all" | "own";

export function canReviewSelfServiceRequests(user: SelfServiceRequestUser) {
  return isTechnicalSupportUser(user);
}

export function resolveSelfServiceRequestScope(user: SelfServiceRequestUser): SelfServiceRequestScope | null {
  if (!user?.id) return null;
  return canReviewSelfServiceRequests(user) ? "all" : "own";
}

export function canAccessSelfServiceRequest(
  user: SelfServiceRequestUser,
  request: Pick<RequestRecord, "userId">,
) {
  const scope = resolveSelfServiceRequestScope(user);
  if (!scope || !user?.id) return false;
  return scope === "all" || request.userId === user.id;
}
