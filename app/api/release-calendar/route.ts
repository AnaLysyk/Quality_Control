import { NextRequest, NextResponse } from "next/server";

import { getReleaseCalendarModel } from "@/data/releaseCalendarModel";
import { getReleaseCalendarSummary, listReleaseCalendarEvents, upsertReleaseCalendarEvent } from "@/lib/releaseCalendarStore";
import { authenticateRequest } from "@/lib/jwtAuth";
import { NO_STORE_HEADERS } from "@/lib/http/noStore";

export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const companySlug = url.searchParams.get("companySlug")?.trim() || null;
  const projectSlug = url.searchParams.get("projectSlug")?.trim() || null;
  const releaseId = url.searchParams.get("releaseId")?.trim() || null;
  const status = url.searchParams.get("status")?.trim() || null;

  const [events, summary] = await Promise.all([
    listReleaseCalendarEvents({
      companySlug,
      projectSlug,
      releaseId,
      status: status === "planned" || status === "at_risk" || status === "blocked" || status === "done" || status === "cancelled" ? status : null,
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
