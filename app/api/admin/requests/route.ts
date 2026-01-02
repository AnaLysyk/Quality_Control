import { NextResponse } from "next/server";
import { listAllRequests } from "@/data/requestsStore";
import { getSessionUser } from "@/lib/session";

export async function GET(request: Request) {
  const user = getSessionUser();
  if (user.role !== "admin") {
    return NextResponse.json({ message: "Sem permissão" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") as any;
  const type = searchParams.get("type") as any;
  const companyId = searchParams.get("companyId") || undefined;
  const sort = (searchParams.get("sort") as any) || "createdAt_desc";

  const items = listAllRequests({ status, type, companyId, sort });

  return NextResponse.json({ items, total: items.length });
}
