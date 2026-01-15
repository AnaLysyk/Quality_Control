import { NextRequest, NextResponse } from "next/server";
import { listAllRequests, type RequestStatus, type RequestType } from "@/data/requestsStore";
import { authenticateRequest } from "@/lib/jwtAuth";

function isRequestStatus(value: string | null): value is RequestStatus {
  return value === "PENDING" || value === "APPROVED" || value === "REJECTED";
}

function isRequestType(value: string | null): value is RequestType {
  return value === "EMAIL_CHANGE" || value === "COMPANY_CHANGE";
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
  const statusParam = searchParams.get("status");
  const typeParam = searchParams.get("type");
  const status = isRequestStatus(statusParam) ? statusParam : undefined;
  const type = isRequestType(typeParam) ? typeParam : undefined;
  const companyId = searchParams.get("companyId") || undefined;
  const sortParam = searchParams.get("sort");
  const sort = isSort(sortParam) ? sortParam : "createdAt_desc";

  const items = listAllRequests({ status, type, companyId, sort });

  return NextResponse.json({ items, total: items.length });
}
