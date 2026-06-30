import { NextRequest, NextResponse } from "next/server";

import { getReleaseCalendarModel } from "@/data/releaseCalendarModel";
import { getReleaseCalendarSummary, listReleaseCalendarEvents, updateReleaseCalendarEventStatus, upsertReleaseCalendarEvent } from "@/lib/releaseCalendarStore";
import { authenticateRequest } from "@/lib/jwtAuth";
import { NO_STORE_HEADERS } from "@/lib/http/noStore";

export const runtime = "nodejs";
export const revalidate = 0;

const VALID_STATUSES = ["planned", "at_risk", "blocked", "done", "cancelled"] as const;

type ReleaseStatus = (typeof VALID_STATUSES)[number];

function normalizeStatus(value: unknown): ReleaseStatus | null {
  return typeof value === "string" && VALID_STATUSES.includes(value as ReleaseStatus) ? (value as ReleaseStatus) : null;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const companySlug = url.searchParams.get("companySlug")?.trim() || null;
  const projectSlug = url.searchParams.get("projectSlug")?.trim() || null;
  const releaseId = url.searchParams.get("releaseId")?.trim() || null;
  const status = normalizeStatus(url.searchParams.get("status")?.trim() || null);

  const [events, summary] = await Promise.all([
    listReleaseCalendarEvents({
      companySlug,
      projectSlug,
      releaseId,
      status,
    }),
    getReleaseCalendarSummary(),
  ]);

  return NextResponse.json(
    {
      ...getReleaseCalendarModel(),
      events,
      calendarSummary: summary,
    },
    { headers: NO_STORE_HEADERS },
  );
}

export async function POST(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const event = await upsertReleaseCalendarEvent({
    ...body,
    ownerId: body?.ownerId ?? user.id,
    ownerName: body?.ownerName ?? user.name ?? user.email,
  });

  return NextResponse.json({ event }, { status: 201, headers: NO_STORE_HEADERS });
}

export async function PATCH(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  const status = normalizeStatus(body?.status);

  if (!id || !status) {
    return NextResponse.json({ error: "Informe id e status valido." }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const event = await updateReleaseCalendarEventStatus(id, status);
  if (!event) {
    return NextResponse.json({ error: "Evento de agenda nao encontrado." }, { status: 404, headers: NO_STORE_HEADERS });
  }

  return NextResponse.json({ event }, { status: 200, headers: NO_STORE_HEADERS });
}
