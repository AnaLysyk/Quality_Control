import { NextRequest, NextResponse } from "next/server";

import { listAllRequests, type RequestStatus, type RequestType } from "@/data/requestsStore";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import { canReviewerAccessQueue, resolveGenericRequestQueue } from "@/lib/requestReviewAccess";

function isRequestStatus(value: string | null): value is RequestStatus {
  return value === "PENDING" || value === "APPROVED" || value === "REJECTED";
}

function isRequestType(value: string | null): value is RequestType {
  return value === "EMAIL_CHANGE" || value === "COMPANY_CHANGE" || value === "PASSWORD_RESET" || value === "PROFILE_DELETION";
}

function isSort(value: string | null): value is "createdAt_desc" | "createdAt_asc" {
  return value === "createdAt_desc" || value === "createdAt_asc";
}

export async function GET(request: NextRequest) {
  const { admin, status } = await requireGlobalAdminWithStatus(request);
  if (!admin) {
    return NextResponse.json({ message: status === 401 ? "Nao autenticado" : "Sem permissao" }, { status });
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const typeParam = searchParams.get("type");
  const statusFilter = isRequestStatus(statusParam) ? statusParam : undefined;
  const typeFilter = isRequestType(typeParam) ? typeParam : undefined;
  const companyId = searchParams.get("companyId") || undefined;
  const sortParam = searchParams.get("sort");
  const sort = isSort(sortParam) ? sortParam : "createdAt_desc";

  const items = (await listAllRequests({ status: statusFilter, type: typeFilter, companyId, sort })).filter((item) =>
    canReviewerAccessQueue(admin, resolveGenericRequestQueue(item)),
  );
  return NextResponse.json({ items, total: items.length });
}
