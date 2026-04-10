import { NextResponse } from "next/server";

import { listAllRequests, listUserRequests, type RequestStatus, type RequestType } from "@/data/requestsStore";
import { authenticateRequest } from "@/lib/jwtAuth";
import { canReviewSelfServiceRequests, resolveSelfServiceRequestScope } from "@/lib/selfServiceRequestAccess";

function isRequestStatus(value: string | null): value is RequestStatus {
  return value === "PENDING" || value === "APPROVED" || value === "REJECTED";
}

function isRequestType(value: string | null): value is RequestType {
  return value === "EMAIL_CHANGE" || value === "COMPANY_CHANGE" || value === "PASSWORD_RESET" || value === "PROFILE_DELETION";
}

export async function GET(request: Request) {
  const authUser = await authenticateRequest(request);
  if (!authUser) {
    return NextResponse.json({ message: "Nao autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const typeParam = searchParams.get("type");
  const status = isRequestStatus(statusParam) ? statusParam : undefined;
  const type = isRequestType(typeParam) ? typeParam : undefined;
  const scope = resolveSelfServiceRequestScope(authUser);
  if (!scope) {
    return NextResponse.json({ message: "Nao autenticado" }, { status: 401 });
  }

  const items =
    scope === "all"
      ? await listAllRequests({ status, type, sort: "createdAt_desc" })
      : await listUserRequests(authUser.id, { status, type, sort: "createdAt_desc" });

  return NextResponse.json({
    items,
    total: items.length,
    scope,
    canReview: canReviewSelfServiceRequests(authUser),
  });
}
