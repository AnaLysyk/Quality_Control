import type { RequestRecord } from "@/data/requestsStore";
import { parseAccessRequestMessage } from "@/lib/accessRequestMessage";
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
  if (!session) return false;
  if (session.isGlobalAdmin === true) return true;
  const role = (session?.role ?? "").toLowerCase().trim();
  return (
    role === "it_dev" ||
    role === "itdev" ||
    role === "developer" ||
    role === "dev" ||
    role === "technical_support" ||
    role === "support" ||
    role === "tech_support" ||
    role === "support_tech"
  );
}

export function canReviewerAccessQueue(session: ReviewerSession | null | undefined, queue: ReviewQueue) {
  if (isGlobalReviewer(session)) return true;
  return canAdminReviewQueue(queue);
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
