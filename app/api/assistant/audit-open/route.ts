import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { authenticateRequest } from "@/lib/jwtAuth";
import { prisma } from "@/lib/prismaClient";

/**
 * Rota leve de audit: registra quando o assistente é aberto com contexto.
 * Chamada fire-and-forget pelo ChatButton — falha silenciosamente no cliente.
 */
export const runtime = "nodejs";

export async function POST(req: Request) {
  const authUser = await authenticateRequest(req);
  if (!authUser) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({})) as {
      source?: string;
      route?: string;
      nodeId?: string;
      entityId?: string;
      agentMode?: string;
    };

    await prisma.brainAuditLog.create({
      data: {
        action: "ASSISTANT_OPENED",
        entityType: "Assistant",
        entityId: body.nodeId ?? body.entityId ?? body.route ?? "assistant",
        userId: authUser.id ?? "unknown",
        reason: `source=${body.source ?? "unknown"} agentMode=${body.agentMode ?? "auto"}`,
        after: {
          source: body.source ?? null,
          route: body.route ?? null,
          nodeId: body.nodeId ?? null,
          entityId: body.entityId ?? null,
          agentMode: body.agentMode ?? null,
        } as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    // Falha silenciosa — audit não deve bloquear UX
    return NextResponse.json({ ok: false });
  }
}
