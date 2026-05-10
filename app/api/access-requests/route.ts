import { NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/jwtAuth";
import { createAccessRequestFromPayload, listAccessRequestsForUser } from "@/lib/accessRequestsV2/service";

export async function GET(req: Request) {
  const authUser = await authenticateRequest(req);
  if (!authUser) {
    return NextResponse.json({ message: "Não autenticado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const requestType = url.searchParams.get("requestType") ?? url.searchParams.get("type");

  const result = await listAccessRequestsForUser(authUser, { status, requestType });
  return NextResponse.json(result, { status: 200 });
}

export async function POST(req: Request) {
  const authUser = await authenticateRequest(req);
  if (!authUser) {
    return NextResponse.json({ message: "Não autenticado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const result = await createAccessRequestFromPayload(body, req, authUser);
  return NextResponse.json(result.body, { status: result.status });
}
