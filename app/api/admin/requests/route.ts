import { NextRequest, NextResponse } from "next/server";

import { listAllRequests, type RequestStatus, type RequestType } from "@/data/requestsStore";
import { authenticateRequest } from "@/lib/jwtAuth";

function isRequestStatus(value: string | null): value is RequestStatus {
  return value === "PENDING" || value === "APPROVED" || value === "REJECTED";
}

function isRequestType(value: string | null): value is RequestType {
  return value === "EMAIL_CHANGE" || value === "COMPANY_CHANGE" || value === "PASSWORD_RESET";
}

function isSort(value: string | null): value is "createdAt_desc" | "createdAt_asc" {
  return value === "createdAt_desc" || value === "createdAt_asc";
}

export async function GET(request: NextRequest) {
  const authUser = await authenticateRequest(request);
  if (!authUser) {
    return NextResponse.json({ message: "Não autenticado" }, { status: 401 });
  }
  if (!authUser.isGlobalAdmin) {
    return NextResponse.json({ message: "Sem permissao" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status")?.toUpperCase() ?? null;
  const typeParam = searchParams.get("type")?.toUpperCase() ?? null;
  const status = isRequestStatus(statusParam) ? statusParam : undefined;
  const type = isRequestType(typeParam) ? typeParam : undefined;
  const companyIdRaw = searchParams.get("companyId");
  const companyId = typeof companyIdRaw === "string" && companyIdRaw.trim().length > 0 ? companyIdRaw.trim() : undefined;
  const sortParam = searchParams.get("sort");
  const sort = isSort(sortParam) ? sortParam : "createdAt_desc";

  const items = await listAllRequests({ status, type, companyId, sort });

  const res = NextResponse.json({ items, total: items.length });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
