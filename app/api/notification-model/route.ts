import { NextRequest, NextResponse } from "next/server";

import { getNotificationOperationModel } from "@/data/notificationOperationModel";
import { buildNotificationBrianInsights } from "@/backend/notificationBrianInsights";
import { getNotificationEventsSummary, listNotificationEvents } from "@/backend/notificationEventsStore";
import { getNotificationPreferenceSummary, listNotificationPreferences, upsertNotificationPreference } from "@/backend/notificationPreferencesStore";
import { authenticateRequest } from "@/backend/jwtAuth";
import { NO_STORE_HEADERS } from "@/backend/http/noStore";
import { canAccessCompanyDefects, hasGlobalCompanyVisibility, resolveAllowedCompanySlugs } from "@/backend/companyDefectsAccess";

export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const companySlug = url.searchParams.get("companySlug")?.trim() || null;
  const projectSlug = url.searchParams.get("projectSlug")?.trim() || null;
  const sourceType = url.searchParams.get("sourceType")?.trim() || null;
  const limit = Number(url.searchParams.get("limit") ?? 50);

  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (companySlug && !canAccessCompanyDefects(user, companySlug)) {
    return NextResponse.json({ error: "Empresa fora do escopo permitido" }, { status: 403 });
  }
  const hasGlobalVisibility = hasGlobalCompanyVisibility(user);
  const effectiveCompanySlug = companySlug ?? (hasGlobalVisibility ? null : resolveAllowedCompanySlugs(user)[0] ?? "__none__");

  const [preferences, preferenceSummary, notificationEvents, notificationEventsSummary] = await Promise.all([
    listNotificationPreferences(),
    getNotificationPreferenceSummary(),
    listNotificationEvents({
      companySlug: effectiveCompanySlug,
      projectSlug,
      sourceType: sourceType === "release_calendar" || sourceType === "chat" || sourceType === "qa_operation" || sourceType === "manual" ? sourceType : null,
      limit: Number.isFinite(limit) ? limit : 50,
    }),
    getNotificationEventsSummary(),
  ]);

  const notificationBrianInsights = buildNotificationBrianInsights({
    events: notificationEvents.events,
    deliveries: notificationEvents.deliveries,
    limit: 20,
  });

  return NextResponse.json(
    {
      ...getNotificationOperationModel(),
      preferences,
      preferenceSummary,
      notificationEvents,
      notificationEventsSummary,
      notificationBrianInsights,
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
  const preference = await upsertNotificationPreference({
    target: body?.target,
    targetId: body?.targetId,
    workflowId: body?.workflowId,
    channel: body?.channel,
    decision: body?.decision,
    updatedBy: user.id,
  });

  return NextResponse.json({ preference }, { status: 201, headers: NO_STORE_HEADERS });
}

