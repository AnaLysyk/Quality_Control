import { NextResponse } from "next/server";

import { listAuditLogs } from "@/data/auditLogRepository";
import { listBrainEmailFlow, isAccessRequestEmail, type BrainEmailFlowEntry } from "@/data/brainEmailFlowRepository";
import { resolveBrainAccess } from "@/backend/brain/access";
import { listAccessRequestsV2 } from "@/backend/accessRequestsV2/repository";

const PUBLIC_ROUTES = [
  {
    id: "create-public-request",
    method: "POST",
    path: "/api/access-requests/public",
    label: "Criação pública da solicitação",
    expectedLog: "access_request.created",
    expectedEmailKind: "access_request.received",
  },
  {
    id: "lookup-by-key",
    method: "GET",
    path: "/api/access-requests/by-key/[key]",
    label: "Consulta pública por código",
    expectedLog: "access_request.updated",
    expectedEmailKind: null,
  },
  {
    id: "resubmit-by-key",
    method: "POST",
    path: "/api/access-requests/by-key/[key]",
    label: "Reenvio público de ajuste",
    expectedLog: "access_request.updated",
    expectedEmailKind: null,
  },
  {
    id: "admin-accept",
    method: "POST",
    path: "/api/admin/access-requests/[id]/accept",
    label: "Aprovação administrativa",
    expectedLog: "access_request.accepted",
    expectedEmailKind: "access_request.approved",
  },
  {
    id: "admin-reject",
    method: "POST",
    path: "/api/admin/access-requests/[id]/reject",
    label: "Rejeição administrativa",
    expectedLog: "access_request.rejected",
    expectedEmailKind: "access_request.rejected",
  },
  {
    id: "admin-adjustment",
    method: "POST",
    path: "/api/admin/access-requests/[id]/request-adjustment",
    label: "Solicitação de ajuste",
    expectedLog: "access_request.updated",
    expectedEmailKind: "access_request.adjustment",
  },
];

function routeHealth(logActions: Set<string>, emailKinds: Set<string>) {
  return PUBLIC_ROUTES.map((route) => {
    const logOk = route.expectedLog ? logActions.has(route.expectedLog) : true;
    const emailOk = route.expectedEmailKind ? emailKinds.has(route.expectedEmailKind) : true;
    return {
      ...route,
      logOk,
      emailOk,
      status: logOk && emailOk ? "mapped" : "attention",
    };
  });
}

function sanitizeEmail(entry: BrainEmailFlowEntry) {
  return {
    id: entry.id,
    createdAt: entry.createdAt,
    kind: entry.kind,
    to: entry.to,
    subject: entry.subject,
    html: entry.html,
    text: entry.text,
    accessKey: entry.accessKey,
    lookupUrl: entry.lookupUrl,
    requestId: entry.requestId,
    source: entry.source,
  };
}

function emailMatchesRequest(email: BrainEmailFlowEntry, request: Awaited<ReturnType<typeof listAccessRequestsV2>>[number]) {
  if (email.requestId && email.requestId === request.id) return true;
  if (email.accessKey && request.accessKey && email.accessKey === request.accessKey) return true;
  return email.to.toLowerCase() === request.requesterEmail.toLowerCase();
}

function buildEmailTimeline(emails: BrainEmailFlowEntry[], request: Awaited<ReturnType<typeof listAccessRequestsV2>>[number]) {
  return emails
    .filter((email) => emailMatchesRequest(email, request))
    .sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1))
    .map(sanitizeEmail);
}

export async function GET(req: Request) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  if (!accessResult.context.hasGlobalVisibility) {
    return NextResponse.json({ error: "Sem permissão para abrir o fluxo público de solicitações no Brain" }, { status: 403 });
  }

  const url = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 30)));

  try {
    const [requests, auditLogs, allEmails] = await Promise.all([
      listAccessRequestsV2(),
      listAuditLogs({ entityType: "access_request", limit: 200 }),
      listBrainEmailFlow(300),
    ]);

    const accessRequestEmails = allEmails.filter(isAccessRequestEmail);
    const logActions = new Set(auditLogs.map((log) => log.action));
    const emailKinds = new Set(accessRequestEmails.map((email) => email.kind));

    const recentRequests = requests.slice(0, limit).map((request) => {
      const requestLogs = auditLogs.filter((log) => log.entity_id === request.id);
      const emails = buildEmailTimeline(accessRequestEmails, request);
      const adjustmentRounds = request.adjustmentHistory ?? [];

      return {
        id: request.id,
        accessKey: request.accessKey ?? null,
        requesterName: request.requesterName ?? null,
        requesterEmail: request.requesterEmail,
        requestedRole: request.requestedRole ?? null,
        requestedCompanySlug: request.requestedCompanySlug ?? null,
        requestedCompanyId: request.requestedCompanyId ?? null,
        status: request.status,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
        reviewedAt: request.reviewedAt ?? null,
        reviewComment: request.reviewComment ?? null,
        adjustmentRounds: adjustmentRounds.length,
        pendingAdjustmentFields: request.adjustmentFields ?? [],
        lastAdjustmentDiff: request.lastAdjustmentDiff ?? [],
        logs: requestLogs.map((log) => ({
          id: log.id,
          createdAt: log.created_at,
          actorEmail: log.actor_email,
          action: log.action,
          metadata: log.metadata,
        })),
        emails,
        validation: {
          hasCreationLog: requestLogs.some((log) => log.action === "access_request.created"),
          hasReceivedEmail: emails.some((email) => email.kind === "access_request.received"),
          hasDecisionEmail:
            request.status === "approved"
              ? emails.some((email) => email.kind === "access_request.approved")
              : request.status === "rejected"
                ? emails.some((email) => email.kind === "access_request.rejected")
                : true,
          hasAdjustmentEmail: adjustmentRounds.length
            ? emails.some((email) => email.kind === "access_request.adjustment")
            : true,
        },
      };
    });

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      routes: routeHealth(logActions, emailKinds),
      summary: {
        requests: requests.length,
        auditLogs: auditLogs.length,
        capturedAccessRequestEmails: accessRequestEmails.length,
        mappedRoutes: routeHealth(logActions, emailKinds).filter((route) => route.status === "mapped").length,
      },
      requests: recentRequests,
      emails: accessRequestEmails.slice(0, 50).map(sanitizeEmail),
      notes: [
        "Para abrir o HTML real do e-mail no Brain, ative EMAIL_CAPTURE_MODE=file ou ACCESS_REQUEST_EMAIL_BYPASS=true em ambiente local/teste.",
        "O Brain usa auditoria, solicitações e outbox capturado para montar a validação ponta a ponta.",
      ],
    });
  } catch (error) {
    console.error("[brain/access-requests/email-flow] GET error", error);
    return NextResponse.json({ error: "Erro ao montar fluxo de e-mails das solicitações" }, { status: 500 });
  }
}

