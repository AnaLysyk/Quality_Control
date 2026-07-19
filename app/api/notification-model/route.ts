import { NextRequest, NextResponse } from "next/server";

import { getNotificationOperationModel } from "@/data/notificationOperationModel";
import { buildNotificationBrianInsights } from "@/backend/notifications/brainInsights";
import { getNotificationEventsSummary, listNotificationEvents } from "@/backend/notificationEventsStore";
import { listNotificationPreferences, upsertNotificationPreference } from "@/backend/notificationPreferencesStore";
import { authenticateRequest } from "@/backend/jwtAuth";
import { NO_STORE_HEADERS } from "@/backend/http/noStore";
import { canAccessCompanyDefects, hasGlobalCompanyVisibility, resolveAllowedCompanySlugs } from "@/backend/companyDefectsAccess";
import { resolveOperationalContext } from "@/backend/context/operationalContext";

export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const companySlug = url.searchParams.get("companySlug")?.trim() || null;
  const projectSlug = url.searchParams.get("projectSlug")?.trim() || null;
  const sourceType = url.searchParams.get("sourceType")?.trim() || null;
  const limit = Number(url.searchParams.get("limit") ?? 50);

  const contextResult = await resolveOperationalContext(req, {
    moduleId: "notifications",
    action: "view",
    companySlug,
  });
  if (!contextResult.ok) return contextResult.response;

  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (companySlug && !canAccessCompanyDefects(user, companySlug)) {
    return NextResponse.json({ error: "Empresa fora do escopo permitido" }, { status: 403 });
  }
  const hasGlobalVisibility = hasGlobalCompanyVisibility(user);
  const effectiveCompanySlug = companySlug ?? (hasGlobalVisibility ? null : resolveAllowedCompanySlugs(user)[0] ?? "__none__");

  const [allPreferences, notificationEvents, notificationEventsSummary] = await Promise.all([
    listNotificationPreferences(),
    listNotificationEvents({
      companySlug: effectiveCompanySlug,
      projectSlug,
      sourceType: sourceType === "release_calendar" || sourceType === "chat" || sourceType === "qa_operation" || sourceType === "manual" ? sourceType : null,
      limit: Number.isFinite(limit) ? limit : 50,
    }),
    getNotificationEventsSummary(),
  ]);

  const allowedCompanyTargets = new Set([
    ...contextResult.context.allowedCompanyIds,
    ...contextResult.context.allowedCompanySlugs,
  ]);
  const preferences = contextResult.context.scope === "global"
    ? allPreferences
    : allPreferences.filter((preference) =>
        (preference.target === "company" && allowedCompanyTargets.has(preference.targetId)) ||
        (preference.target === "user" && preference.targetId === user.id),
      );
  const disabledPreferences = preferences.filter((preference) => preference.decision === "disabled");
  const preferenceSummary = {
    total: preferences.length,
    disabled: disabledPreferences.length,
    enabled: preferences.length - disabledPreferences.length,
    company: preferences.filter((preference) => preference.target === "company").length,
    profile: preferences.filter((preference) => preference.target === "profile").length,
    user: preferences.filter((preference) => preference.target === "user").length,
  };

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
  const contextResult = await resolveOperationalContext(req, {
    moduleId: "notifications",
    action: "create",
  });
  if (!contextResult.ok) return contextResult.response;

  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const target = body?.target;
  const targetId = typeof body?.targetId === "string" ? body.targetId.trim() : "";
  if (contextResult.context.scope !== "global") {
    const allowedCompanyTargets = new Set([
      ...contextResult.context.allowedCompanyIds,
      ...contextResult.context.allowedCompanySlugs,
    ]);
    const ownsTarget =
      (target === "company" && allowedCompanyTargets.has(targetId)) ||
      (target === "user" && targetId === user.id);
    if (!ownsTarget) {
      return NextResponse.json({ error: "Alvo de notificação fora do escopo permitido" }, { status: 403 });
    }
  }

  const preference = await upsertNotificationPreference({
    target,
    targetId,
    workflowId: body?.workflowId,
    channel: body?.channel,
    decision: body?.decision,
    updatedBy: user.id,
  });

  return NextResponse.json({ preference }, { status: 201, headers: NO_STORE_HEADERS });
}
