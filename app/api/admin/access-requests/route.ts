import { NextRequest, NextResponse } from "next/server";

import { listAllRequests } from "@/data/requestsStore";
import { NO_STORE_HEADERS } from "@/backend/http/noStore";
import { mapPasswordResetRequestToAccessQueueItem } from "@/backend/passwordResetAccessQueue";
import { requireAccessRequestReviewerWithStatus } from "@/backend/rbac/requireAccessRequestReviewer";
import { listAccessRequestsV2 } from "@/backend/access-requests/repository";
import { mapV2ToLegacySupportRow } from "@/backend/access-requests/service";
import { normalizeLegacyRole, SYSTEM_ROLES } from "@/backend/auth/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const { admin, status } = await requireAccessRequestReviewerWithStatus(req);
  if (!admin) {
    return NextResponse.json(
      { error: status === 401 ? "Nao autenticado" : "Sem permissao" },
      { status, headers: NO_STORE_HEADERS },
    );
  }

  const [accessRequests, passwordResetRequests] = await Promise.all([
    listAccessRequestsV2(),
    listAllRequests({ type: "PASSWORD_RESET", sort: "createdAt_desc" }).catch(() => []),
  ]);

  const adminRole = normalizeLegacyRole(admin.role);
  const companyScoped =
    admin.isGlobalAdmin !== true &&
    adminRole !== SYSTEM_ROLES.LEADER_TC &&
    adminRole !== SYSTEM_ROLES.TECHNICAL_SUPPORT;
  const companyId = admin.companyId ?? null;
  const companySlug = (admin.companySlug ?? "").trim().toLowerCase();
  const scopedAccessRequests = companyScoped
    ? accessRequests.filter((item) => {
        if (companyId && item.requestedCompanyId === companyId) return true;
        if (!companySlug) return false;
        return (item.requestedCompanySlug ?? "").trim().toLowerCase() === companySlug;
      })
    : accessRequests;
  const scopedPasswordResetRequests = companyScoped ? [] : passwordResetRequests;

  const items = [
    ...scopedAccessRequests.map(mapV2ToLegacySupportRow),
    ...scopedPasswordResetRequests.map(mapPasswordResetRequestToAccessQueueItem),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at));

  return NextResponse.json(
    {
      items,
      scope: companyScoped ? "company" : "global",
      companyId: companyScoped ? companyId : null,
      companySlug: companyScoped ? companySlug || null : null,
    },
    { headers: NO_STORE_HEADERS },
  );
}
