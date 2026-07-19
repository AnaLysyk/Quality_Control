import { NextResponse } from "next/server";
import { resolveBrainAccess } from "@/backend/brain/access";
import { BrainModuleEvents, isAllowedBrainEvent } from "@/backend/brain/contracts";

const SUPPORTED_EVENTS = new Set([
  ...Object.values(BrainModuleEvents).flatMap((group) => Object.values(group)),
  "access_request.created",
  "access_request.approved",
  "access_request.rejected",
  "access_request.adjustment_requested",
  "access_request.pdf_generated",
  "access_request.email_sent",
  "defect.created",
  "defect.updated",
  "document.created",
  "document.updated",
  "automation.executed",
  "automation.run.finished",
  "test_case.created",
  "test_case.updated",
  "test_plan.created",
  "test_plan.case_linked",
  "support_request.created",
  "support_request.updated",
  "ticket.created",
  "ticket.updated",
  "user.created",
  "permission.changed",
  "audit_log.created",
  "comment.created",
  "log.created",
  "release.created",
  "run.failed",
]);

export async function POST(req: Request) {
  const accessResult = await resolveBrainAccess(req, { requireManage: true });
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  const body = await req.json().catch(() => ({}));
  const eventType = typeof body.eventType === "string" ? body.eventType : typeof body.type === "string" ? body.type : "";
  if (!SUPPORTED_EVENTS.has(eventType) && !isAllowedBrainEvent(eventType) && !eventType.startsWith("custom.")) {
    return NextResponse.json({
      error: "eventType fora do contrato de ingestao do Brain",
      supportedEvents: Array.from(SUPPORTED_EVENTS),
      graphIngestPath: "/api/brain/graph/ingest",
    }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    source: "contract",
    message: "Evento aceito pelo contrato central do Brain. Para persistir no grafo como nó, conexão ou memória, envie node/edge/memory para /api/brain/graph/ingest.",
    event: {
      id: `ingest:${Date.now()}`,
      eventType,
      receivedAt: new Date().toISOString(),
      entity: typeof body.entity === "object" && body.entity ? body.entity : null,
      context: typeof body.context === "object" && body.context ? body.context : null,
    },
    graphIngestPath: "/api/brain/graph/ingest",
    requiresConfirmation: false,
  });
}

