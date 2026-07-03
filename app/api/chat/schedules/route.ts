
import { NextRequest, NextResponse } from "next/server";

import { getAccessContext } from "@/lib/auth/session";
import { registerChatSchedule } from "@/lib/chatPresenceStore";
import { NO_STORE_HEADERS } from "@/lib/http/noStore";

export const runtime = "nodejs";
export const revalidate = 0;

function readString(input: Record<string, unknown>, key: string) {
  const value = input[key];
  return typeof value === "string" ? value.trim() : "";
}

function readStringArray(input: Record<string, unknown>, key: string) {
  const value = input[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export async function POST(req: NextRequest) {
  const access = await getAccessContext(req);

  if (!access) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const payload = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

  const title = readString(payload, "title");
  const startAt = readString(payload, "startAt");
  const endAt = readString(payload, "endAt");

  if (!title || !startAt || !endAt) {
    return NextResponse.json({ error: "Titulo, inicio e fim sao obrigatorios" }, { status: 400 });
  }

  const userIds = Array.from(new Set([access.userId, ...readStringArray(payload, "userIds")]));

  const schedule = await registerChatSchedule({
    title,
    type: readString(payload, "type") === "run_delivery" ? "run_delivery" : readString(payload, "type") === "follow_up" ? "follow_up" : "meeting",
    startAt,
    endAt,
    userIds,
    companyName: readString(payload, "companyName") || null,
    projectName: readString(payload, "projectName") || null,
    notes: readString(payload, "notes") || null,
    meet: payload.meet === true,
    createdById: access.userId,
  });

  return NextResponse.json({ ok: true, schedule }, { headers: NO_STORE_HEADERS });
}
