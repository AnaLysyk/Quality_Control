import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { listUserRequests, type RequestStatus, type RequestType } from "@/data/requestsStore";

function isRequestStatus(value: string | null): value is RequestStatus {
  return value === "PENDING" || value === "APPROVED" || value === "REJECTED";
}

function isRequestType(value: string | null): value is RequestType {
  return value === "EMAIL_CHANGE" || value === "COMPANY_CHANGE";
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const typeParam = searchParams.get("type");
  const status = isRequestStatus(statusParam) ? statusParam : undefined;
  const type = isRequestType(typeParam) ? typeParam : undefined;

  const items = listUserRequests(user.id, {
    status,
    type,
  });

  return NextResponse.json({ items, total: items.length });
}
