import { NextResponse } from "next/server";

import { resolveBrainAccess } from "@/backend/brain/access";
import {
  brainCreateEvent,
  brainExplainRelation,
  brainGetContext,
  brainGetImpact,
  brainGetRelated,
} from "@/backend/brain/publicApi";

export async function POST(req: Request) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  const body = (await req.json().catch(() => ({}))) as {
    action?: "getContext" | "getImpact" | "getRelated" | "createEvent" | "explainRelation";
    entity?: string;
    edgeId?: string;
    eventType?: string;
    entityId?: string;
    payload?: Record<string, unknown>;
  };

  const action = body.action;
  if (!action) {
    return NextResponse.json({ error: "action é obrigatório" }, { status: 400 });
  }

  try {
    if (action === "getContext") {
      const result = await brainGetContext(String(body.entity ?? ""));
      return NextResponse.json({ result });
    }

    if (action === "getImpact") {
      const result = await brainGetImpact(String(body.entity ?? ""));
      return NextResponse.json({ result });
    }

    if (action === "getRelated") {
      const result = await brainGetRelated(String(body.entity ?? ""));
      return NextResponse.json({ result });
    }

    if (action === "explainRelation") {
      const result = await brainExplainRelation(String(body.edgeId ?? ""));
      return NextResponse.json({ result });
    }

    if (action === "createEvent") {
      if (!accessResult.context.canManage) {
        return NextResponse.json({ error: "Sem permissão para createEvent" }, { status: 403 });
      }
      const result = await brainCreateEvent({
        eventType: String(body.eventType ?? "custom.event"),
        entityId: String(body.entityId ?? body.entity ?? "unknown"),
        payload: body.payload,
        userId: accessResult.context.user.id,
      });
      return NextResponse.json({ result }, { status: 201 });
    }

    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  } catch (error) {
    console.error("[brain/internal] POST error:", error);
    return NextResponse.json({ error: "Erro ao executar API interna do Brain" }, { status: 500 });
  }
}

