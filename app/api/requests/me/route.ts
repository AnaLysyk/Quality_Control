import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { listUserRequests } from "@/data/requestsStore";

export async function GET(request: Request) {
  const user = getSessionUser();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") as any;
  const type = searchParams.get("type") as any;

  const items = listUserRequests(user.id, {
    status: status || undefined,
    type: type || undefined,
  });

  return NextResponse.json({ items, total: items.length });
}
