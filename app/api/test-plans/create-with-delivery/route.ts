import { NextRequest, NextResponse } from "next/server";

import { NO_STORE_HEADERS } from "@/lib/http/noStore";
import { requirePermission } from "@/lib/rbac/requirePermission";

export const runtime = "nodejs";
export const revalidate = 0;

type CreatePlanWithDeliveryBody = {
  companySlug?: string;
  applicationId?: string;
  projectId?: string | null;
  projectCode?: string | null;
  source?: "manual" | "local" | "automation" | "qase";
  title?: string;
  description?: string | null;
  cases?: unknown[];
  testCaseIds?: string[];
  scheduleDelivery?: boolean;
  deliveryAt?: string | null;
  deliveryMinutes?: number | string | null;
  deliveryNotes?: string | null;
  participants?: string[];
};

function toStringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function buildAbsoluteUrl(req: NextRequest, path: string) {
  return new URL(path, req.url).toString();
}

function forwardAuthHeaders(req: NextRequest) {
  const headers = new Headers({ "Content-Type": "application/json" });
  const cookie = req.headers.get("cookie");
  const authorization = req.headers.get("authorization");
  if (cookie) headers.set("cookie", cookie);
  if (authorization) headers.set("authorization", authorization);
  return headers;
}

export async function POST(req: NextRequest) {
  const guard = await requirePermission(req, "test_plan", "create");
  if (!guard.ok) return guard.response;

  const body = (await req.json().catch(() => null)) as CreatePlanWithDeliveryBody | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const companySlug = toStringOrNull(body.companySlug);
  const applicationId = toStringOrNull(body.applicationId);
  const title = toStringOrNull(body.title);
  const source = body.source ?? "local";

  if (!companySlug || !applicationId || !title) {
    return NextResponse.json(
      { error: "Informe companySlug, applicationId e title para criar o plano." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const planResponse = await fetch(buildAbsoluteUrl(req, "/api/test-plans"), {
    method: "POST",
    headers: forwardAuthHeaders(req),
    body: JSON.stringify({
      companySlug,
      applicationId,
      source,
      title,
      description: body.description ?? null,
      projectId: body.projectId ?? null,
      projectCode: body.projectCode ?? null,
      cases: Array.isArray(body.cases) ? body.cases : [],
      testCaseIds: Array.isArray(body.testCaseIds) ? body.testCaseIds : [],
    }),
  });

  const planPayload = await planResponse.json().catch(() => null);
  if (!planResponse.ok) {
    return NextResponse.json(planPayload ?? { error: "Falha ao criar plano." }, {
      status: planResponse.status,
      headers: NO_STORE_HEADERS,
    });
  }

  const plan = planPayload?.plan;
  const deliveryAt = toStringOrNull(body.deliveryAt);
  const shouldSchedule = body.scheduleDelivery === true && Boolean(deliveryAt);

  if (!shouldSchedule || !plan?.id) {
    return NextResponse.json({ plan, deliveryEvent: null }, { status: 201, headers: NO_STORE_HEADERS });
  }

  const start = new Date(deliveryAt!);
  if (Number.isNaN(start.getTime())) {
    return NextResponse.json(
      { plan, deliveryEvent: null, warning: "Plano criado, mas a data de entrega é inválida." },
      { status: 201, headers: NO_STORE_HEADERS },
    );
  }

  const minutes = Number(body.deliveryMinutes) > 0 ? Number(body.deliveryMinutes) : 30;
  const end = new Date(start.getTime() + minutes * 60 * 1000);

  const calendarResponse = await fetch(buildAbsoluteUrl(req, "/api/release-calendar"), {
    method: "POST",
    headers: forwardAuthHeaders(req),
    body: JSON.stringify({
      id: `test-plan-delivery-${plan.id}`,
      title: `Entrega de plano de teste • ${plan.title ?? title}`,
      type: "release",
      status: "planned",
      criticality: "high",
      context: "delivery",
      markerLabel: "Plano",
      audienceProfiles: ["all", "leader_tc", "technical_support", "testing_company_user", "brain"],
      companyId: null,
      companySlug,
      companyName: companySlug,
      projectId: body.projectId ?? null,
      projectSlug: body.projectId ?? null,
      releaseId: plan.id,
      releaseName: `Plano ${plan.id}`,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      ownerId: null,
      ownerName: null,
      participantNames: Array.isArray(body.participants) ? body.participants.filter(Boolean) : [],
      description: body.deliveryNotes || `Entrega agendada automaticamente ao criar o plano ${plan.title ?? title}.`,
      checklist: ["Plano criado", "Casos podem ser vinculados depois", "Revisar escopo antes da entrega", "Comunicar entrega"],
      notificationRules: ["Avisar 5 minutos antes", "Exibir em Meus agendamentos", "Exibir na agenda da empresa"],
      brianRules: ["Relacionar plano com casos adicionados depois", "Relacionar plano com runs futuras", "Manter memória da entrega"],
    }),
  });

  const deliveryPayload = await calendarResponse.json().catch(() => null);

  return NextResponse.json(
    {
      plan,
      deliveryEvent: calendarResponse.ok ? deliveryPayload?.event ?? null : null,
      warning: calendarResponse.ok ? null : "Plano criado, mas não foi possível agendar a entrega.",
    },
    { status: 201, headers: NO_STORE_HEADERS },
  );
}
