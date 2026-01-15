import { NextResponse } from "next/server";
import { listUserRequests, type RequestStatus, type RequestType } from "@/data/requestsStore";
import { authenticateRequest } from "@/lib/jwtAuth";

function isRequestStatus(value: string | null): value is RequestStatus {
  return value === "PENDING" || value === "APPROVED" || value === "REJECTED";
}

function isRequestType(value: string | null): value is RequestType {
  return value === "EMAIL_CHANGE" || value === "COMPANY_CHANGE";
}

export async function GET(request: Request) {
  const authUser = await authenticateRequest(request);
  if (!authUser) {
    return NextResponse.json({ message: "Não autenticado" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const typeParam = searchParams.get("type");
  const status = isRequestStatus(statusParam) ? statusParam : undefined;
  const type = isRequestType(typeParam) ? typeParam : undefined;

  const items = listUserRequests(authUser.id, {
    status,
    type,
  });

  return NextResponse.json({ items, total: items.length });
}
